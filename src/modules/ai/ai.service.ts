import { readFile } from "node:fs/promises";

import { HistoryRepository } from "../history/history.repository";
import { ConflictError, NotFoundError } from "../../common/errors/app-error";
import { ObjectRepository } from "../objects/object.repository";
import { ObjectEntity } from "../objects/object.model";
import { UpdateObjectInput } from "../objects/object.schemas";
import { PhotoRepository } from "../photos/photo.repository";
import { PhotoStorageService } from "../photos/photo.storage";

import {
  AiInputError,
  AiInvalidOutputError,
  AiNotConfiguredError,
  AiProviderError,
  AiRefusalError
} from "./ai.errors";
import {
  AiGenerationInputSnapshot,
  AiGenerationRecord,
  AiGenerationTriggerType,
  AiProviderImageInput,
  AiSuggestion
} from "./ai.model";
import { ObjectGenerationProvider } from "./ai.provider";
import { AiGenerationRepository } from "./ai.repository";

interface AiLogger {
  info(payload: Record<string, unknown>, message?: string): void;
  warn(payload: Record<string, unknown>, message?: string): void;
  error(payload: Record<string, unknown>, message?: string): void;
}

function normalizeHashtags(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim().toLowerCase();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function hasChanges(patch: UpdateObjectInput): boolean {
  return Object.values(patch).some((value) => value !== undefined);
}

function buildRollbackPatch(
  currentObject: ObjectEntity,
  patch: UpdateObjectInput
): UpdateObjectInput {
  const rollbackPatch: UpdateObjectInput = {};
  const mutableRollbackPatch = rollbackPatch as Record<string, unknown>;

  for (const key of Object.keys(patch) as Array<keyof UpdateObjectInput>) {
    if (patch[key] === undefined) {
      continue;
    }

    mutableRollbackPatch[key] = currentObject[key];
  }

  return rollbackPatch;
}

function buildObjectDiff(
  currentObject: ObjectEntity,
  patch: UpdateObjectInput
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};

  for (const key of Object.keys(patch) as Array<keyof UpdateObjectInput>) {
    if (patch[key] === undefined) {
      continue;
    }

    diff[key] = {
      from: currentObject[key],
      to: patch[key]
    };
  }

  return diff;
}

function buildSuggestedObjectPatch(suggestion: AiSuggestion): UpdateObjectInput {
  const patch: UpdateObjectInput = {};

  if (suggestion.titreSuggere !== null) {
    patch.titreInterne = suggestion.titreSuggere;
  }

  if (suggestion.descriptionSuggeree !== null) {
    patch.descriptionInterne = suggestion.descriptionSuggeree;
  }

  if (suggestion.categorieSuggeree !== null) {
    patch.categorieInterne = suggestion.categorieSuggeree;
  }

  if (suggestion.etatSuggere !== null) {
    patch.etat = suggestion.etatSuggere;
  }

  if (suggestion.prixSuggere !== null) {
    patch.prixReference = suggestion.prixSuggere;
  }

  return patch;
}

function buildChangedPatch(
  currentObject: ObjectEntity,
  patch: UpdateObjectInput
): UpdateObjectInput {
  const result: UpdateObjectInput = {};
  const mutableResult = result as Record<string, unknown>;

  for (const key of Object.keys(patch) as Array<keyof UpdateObjectInput>) {
    const nextValue = patch[key];

    if (nextValue === undefined || currentObject[key] === nextValue) {
      continue;
    }

    mutableResult[key] = nextValue;
  }

  return result;
}

function computeFinalConfidence(
  modelConfidence: number,
  input: AiGenerationInputSnapshot,
  uncertainCount: number
): number {
  const penalties: number[] = [];

  if (input.selectedPhotoCount === 0) {
    penalties.push(0.18);
  } else if (input.selectedPhotoCount === 1) {
    penalties.push(0.05);
  }

  if (!input.noteRapide) {
    penalties.push(0.05);
  }

  penalties.push(Math.min(uncertainCount * 0.06, 0.3));

  const finalValue = Math.max(
    0,
    Math.min(1, modelConfidence - penalties.reduce((sum, value) => sum + value, 0))
  );

  return roundConfidence(finalValue);
}

export class AiService {
  constructor(
    private readonly aiGenerationRepository: AiGenerationRepository,
    private readonly objectRepository: ObjectRepository,
    private readonly photoRepository: PhotoRepository,
    private readonly photoStorageService: PhotoStorageService,
    private readonly historyRepository: HistoryRepository,
    private readonly provider: ObjectGenerationProvider,
    private readonly maxInputPhotos: number,
    private readonly logger?: AiLogger
  ) {}

  async generate(objectId: string): Promise<AiGenerationRecord> {
    return this.runGeneration(objectId, "MANUAL");
  }

  async retry(objectId: string): Promise<AiGenerationRecord> {
    return this.runGeneration(objectId, "RETRY");
  }

  applyGeneration(objectId: string, generationId: number): {
    objectId: string;
    generationId: number;
    appliedFields: string[];
    skippedFields: string[];
  } {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const generation = this.aiGenerationRepository.findById(generationId);

    if (!generation || generation.objectId !== objectId) {
      throw new NotFoundError(`Generation IA introuvable: ${generationId}`);
    }

    if (generation.generationStatus !== "COMPLETED" || !generation.output) {
      throw new ConflictError(
        "Cette generation IA n'est pas exploitable pour une application sur la fiche"
      );
    }

    const suggestedPatch = buildSuggestedObjectPatch(generation.output);
    const patch = buildChangedPatch(object, suggestedPatch);

    if (!hasChanges(patch)) {
      throw new ConflictError("Aucun changement IA applicable sur cette fiche");
    }

    const now = new Date().toISOString();
    const rollbackPatch = buildRollbackPatch(object, patch);
    const diff = buildObjectDiff(object, patch);
    const updatedObject = this.objectRepository.update(objectId, patch, now);

    if (!updatedObject) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const appliedFields = Object.keys(patch);
    const skippedFields =
      generation.output.hashtagsSuggeres.length > 0 ? ["hashtagsSuggeres"] : [];

    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_AI_SUGGESTION_APPLIED",
      sourceType: "AI",
      summary: `Suggestion IA appliquee (${appliedFields.join(", ")})`,
      payload: {
        generationId,
        appliedFields,
        skippedFields,
        changes: diff
      },
      rollbackData: {
        kind: "OBJECT_PATCH",
        patch: rollbackPatch
      },
      createdAt: now
    });

    this.logger?.info(
      {
        objectId,
        generationId,
        appliedFields,
        skippedFields
      },
      "Suggestion IA appliquee a la fiche objet"
    );

    return {
      objectId: updatedObject.objectId,
      generationId,
      appliedFields,
      skippedFields
    };
  }

  listForObject(objectId: string): AiGenerationRecord[] {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    return this.aiGenerationRepository.listByObjectId(objectId);
  }

  private async runGeneration(
    objectId: string,
    triggerType: AiGenerationTriggerType
  ): Promise<AiGenerationRecord> {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const photos = this.photoRepository.listByObjectId(objectId);
    const orderedPhotos = [...photos].sort((left, right) => {
      if (left.photoId === object.mainPhotoId) {
        return -1;
      }

      if (right.photoId === object.mainPhotoId) {
        return 1;
      }

      return left.position - right.position;
    });
    const selectedPhotos = orderedPhotos.slice(0, this.maxInputPhotos);

    if (!object.noteRapide && selectedPhotos.length === 0 && !object.etat && !object.typeObjet) {
      throw new AiInputError(
        "Generation impossible sans photo, note rapide, etat ou type objet"
      );
    }

    const inputSnapshot: AiGenerationInputSnapshot = {
      objectId: object.objectId,
      noteRapide: object.noteRapide,
      etat: object.etat,
      typeObjet: object.typeObjet,
      mainPhotoId: object.mainPhotoId,
      totalPhotoCount: photos.length,
      selectedPhotoCount: selectedPhotos.length,
      photos: selectedPhotos.map((photo) => ({
        photoId: photo.photoId,
        position: photo.position,
        mimeType: photo.mimeType,
        relativePath: photo.relativePath,
        isMain: photo.photoId === object.mainPhotoId
      }))
    };

    const attemptNumber = this.aiGenerationRepository.getNextAttemptNumber(objectId);
    const now = new Date().toISOString();
    const generationId = this.aiGenerationRepository.createPending({
      objectId,
      triggerType,
      attemptNumber,
      provider: this.provider.providerName,
      model: this.provider.modelName,
      promptVersion: this.provider.promptVersion,
      inputSnapshot,
      createdAt: now
    });

    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_AI_GENERATION_REQUESTED",
      sourceType: "AI",
      summary: `Generation IA demandee (${triggerType})`,
      payload: {
        generationId,
        triggerType,
        attemptNumber
      },
      createdAt: now
    });

    this.logger?.info(
      {
        objectId,
        generationId,
        triggerType,
        attemptNumber,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        totalPhotoCount: photos.length,
        selectedPhotoCount: selectedPhotos.length,
        hasNoteRapide: !!object.noteRapide,
        hasEtat: !!object.etat,
        hasTypeObjet: !!object.typeObjet
      },
      "Generation IA demarree"
    );

    try {
      const images = await this.loadImages(selectedPhotos);
      const providerResult = await this.provider.generate({
        inputSnapshot,
        images
      });

      const finalSuggestion = this.applyConfidenceMechanism(
        providerResult.suggestion,
        inputSnapshot
      );
      const completedAt = new Date().toISOString();
      const completedGeneration = this.aiGenerationRepository.markCompleted({
        generationId,
        output: finalSuggestion,
        confidence: finalSuggestion.confiance,
        providerResponseId: providerResult.providerResponseId,
        completedAt
      });

      this.objectRepository.update(
        objectId,
        {
          prixIA: finalSuggestion.prixSuggere,
          confiance: finalSuggestion.confiance
        },
        completedAt
      );

      this.historyRepository.append({
        entityType: "OBJECT",
        entityId: objectId,
        rootObjectId: objectId,
        eventType: "OBJECT_AI_GENERATION_COMPLETED",
        sourceType: "AI",
        summary: "Generation IA terminee",
        payload: {
          generationId,
          attemptNumber,
          confiance: finalSuggestion.confiance,
          appliedFields: {
            prixIA: finalSuggestion.prixSuggere,
            confiance: finalSuggestion.confiance
          }
        },
        createdAt: completedAt
      });

      this.logger?.info(
        {
          objectId,
          generationId,
          triggerType,
          attemptNumber,
          provider: this.provider.providerName,
          model: this.provider.modelName,
          providerResponseId: providerResult.providerResponseId,
          confidence: finalSuggestion.confiance,
          uncertainCount: finalSuggestion.elementsIncertains.length
        },
        "Generation IA terminee"
      );

      return completedGeneration;
    } catch (error) {
      const completedAt = new Date().toISOString();
      const errorCode = this.extractErrorCode(error);
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue de generation IA";

      this.aiGenerationRepository.markFailed({
        generationId,
        errorCode,
        errorMessage,
        completedAt
      });

      this.historyRepository.append({
        entityType: "OBJECT",
        entityId: objectId,
        rootObjectId: objectId,
        eventType: "OBJECT_AI_GENERATION_FAILED",
        sourceType: "AI",
        summary: "Generation IA en echec",
        payload: {
          generationId,
          attemptNumber,
          errorCode,
          errorMessage
        },
        createdAt: completedAt
      });

      const logPayload = {
        objectId,
        generationId,
        triggerType,
        attemptNumber,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        errorCode,
        errorMessage
      };

      if (
        error instanceof AiProviderError ||
        error instanceof AiRefusalError ||
        error instanceof AiInvalidOutputError ||
        error instanceof AiInputError ||
        error instanceof AiNotConfiguredError
      ) {
        this.logger?.warn(logPayload, "Generation IA en echec");
      } else {
        this.logger?.error(logPayload, "Generation IA en echec");
      }

      throw error;
    }
  }

  private async loadImages(
    photos: Array<{
      photoId: string;
      mimeType: string | null;
      relativePath: string | null;
    }>
  ): Promise<AiProviderImageInput[]> {
    const result: AiProviderImageInput[] = [];

    for (const photo of photos) {
      if (!photo.relativePath || !photo.mimeType) {
        continue;
      }

      const buffer = await readFile(
        this.photoStorageService.resolveAbsolutePath(photo.relativePath)
      );

      result.push({
        photoId: photo.photoId,
        mimeType: photo.mimeType,
        base64Data: buffer.toString("base64")
      });
    }

    return result;
  }

  private applyConfidenceMechanism(
    suggestion: AiSuggestion,
    inputSnapshot: AiGenerationInputSnapshot
  ): AiSuggestion {
    return {
      ...suggestion,
      hashtagsSuggeres: normalizeHashtags(suggestion.hashtagsSuggeres),
      confiance: computeFinalConfidence(
        suggestion.confiance,
        inputSnapshot,
        suggestion.elementsIncertains.length
      )
    };
  }

  private extractErrorCode(error: unknown): string {
    if (error instanceof AiNotConfiguredError) {
      return "AI_NOT_CONFIGURED";
    }

    if (error instanceof AiInvalidOutputError) {
      return "AI_INVALID_OUTPUT";
    }

    if (error instanceof AiRefusalError) {
      return "AI_REFUSAL";
    }

    if (error instanceof AiInputError) {
      return "AI_INPUT_ERROR";
    }

    if (error instanceof AiProviderError) {
      return "AI_PROVIDER_ERROR";
    }

    if (error instanceof Error && error.name) {
      return error.name.toUpperCase();
    }

    return "AI_ERROR";
  }
}
