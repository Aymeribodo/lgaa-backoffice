import { NotFoundError } from "../../common/errors/app-error";
import { IdService } from "../../common/services/id.service";
import { HistoryRepository } from "../history/history.repository";

import { ObjectEntity, QuickObjectView } from "./object.model";
import {
  ChangeObjectStatusInput,
  CreateObjectInput,
  ListObjectsQuery,
  QuickCreateObjectInput,
  QuickSearchObjectsQuery,
  QuickUpdateNoteInput,
  UpdateObjectInput
} from "./object.schemas";
import { ObjectRepository } from "./object.repository";

function cleanString(value: string | null | undefined): string | null {
  return value ?? null;
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

function buildObjectEntity(
  objectId: string,
  now: string,
  input: {
    stockStatus: string;
    workflowStatus: ObjectEntity["workflowStatus"];
    source?: string | null | undefined;
    noteRapide?: string | null | undefined;
    typeObjet?: string | null | undefined;
    titreInterne?: string | null | undefined;
    descriptionInterne?: string | null | undefined;
    categorieInterne?: string | null | undefined;
    etat?: string | null | undefined;
    prixIA?: number | null | undefined;
    prixReference?: number | null | undefined;
    prixFinal?: number | null | undefined;
    confiance?: number | null | undefined;
    mainPhotoId?: string | null | undefined;
    locationCode?: string | null | undefined;
    metadata?: Record<string, unknown>;
  }
): ObjectEntity {
  return {
    objectId,
    createdAt: now,
    updatedAt: now,
    stockStatus: input.stockStatus,
    workflowStatus: input.workflowStatus,
    source: cleanString(input.source),
    noteRapide: cleanString(input.noteRapide),
    typeObjet: cleanString(input.typeObjet),
    titreInterne: cleanString(input.titreInterne),
    descriptionInterne: cleanString(input.descriptionInterne),
    categorieInterne: cleanString(input.categorieInterne),
    etat: cleanString(input.etat),
    prixIA: input.prixIA ?? null,
    prixReference: input.prixReference ?? null,
    prixFinal: input.prixFinal ?? null,
    confiance: input.confiance ?? null,
    mainPhotoId: cleanString(input.mainPhotoId),
    locationCode: cleanString(input.locationCode),
    metadata: input.metadata ?? {}
  };
}

export class ObjectService {
  constructor(
    private readonly objectRepository: ObjectRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly idService: IdService
  ) {}

  createObject(input: CreateObjectInput): ObjectEntity {
    const now = new Date().toISOString();
    const object = buildObjectEntity(this.idService.nextObjectId(), now, input);

    this.objectRepository.create(object);
    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: object.objectId,
      rootObjectId: object.objectId,
      eventType: "OBJECT_CREATED",
      sourceType: "MANUAL",
      summary: "Objet central cree",
      payload: {
        workflowStatus: object.workflowStatus,
        stockStatus: object.stockStatus
      },
      createdAt: now
    });

    return object;
  }

  quickCreateObject(input: QuickCreateObjectInput): ObjectEntity {
    const now = new Date().toISOString();
    const object = buildObjectEntity(this.idService.nextObjectId(), now, {
      stockStatus: "IN_STOCK",
      workflowStatus: "BROUILLON",
      source: input.source,
      noteRapide: input.noteRapide,
      typeObjet: input.typeObjet,
      etat: input.etat,
      locationCode: input.locationCode,
      metadata: input.metadata
    });

    this.objectRepository.create(object);
    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: object.objectId,
      rootObjectId: object.objectId,
      eventType: "OBJECT_QUICK_CREATED",
      sourceType: "MANUAL",
      summary: "Objet cree en mode rapide",
      payload: {
        noteRapide: object.noteRapide,
        etat: object.etat,
        typeObjet: object.typeObjet
      },
      createdAt: now
    });

    return object;
  }

  listObjects(filters: ListObjectsQuery): ObjectEntity[] {
    return this.objectRepository.list(filters);
  }

  quickSearchObjects(query: QuickSearchObjectsQuery): QuickObjectView[] {
    return this.objectRepository.quickSearch(query);
  }

  getObject(objectId: string): ObjectEntity {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    return object;
  }

  updateObject(objectId: string, patch: UpdateObjectInput): ObjectEntity {
    const currentObject = this.getObject(objectId);

    if (!hasChanges(patch)) {
      return currentObject;
    }

    const now = new Date().toISOString();
    const rollbackPatch = buildRollbackPatch(currentObject, patch);
    const diff = buildObjectDiff(currentObject, patch);
    const updatedObject = this.objectRepository.update(objectId, patch, now);

    if (!updatedObject) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_UPDATED",
      sourceType: "MANUAL",
      summary: `Modification manuelle de l'objet (${Object.keys(diff).join(", ")})`,
      payload: {
        changes: diff
      },
      rollbackData: {
        kind: "OBJECT_PATCH",
        patch: rollbackPatch
      },
      createdAt: now
    });

    return updatedObject;
  }

  updateQuickNote(objectId: string, input: QuickUpdateNoteInput): ObjectEntity {
    const currentObject = this.getObject(objectId);
    const now = new Date().toISOString();
    const updatedObject = this.objectRepository.update(
      objectId,
      {
        noteRapide: input.noteRapide,
        etat: input.etat,
        typeObjet: input.typeObjet
      },
      now
    );

    if (!updatedObject) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_QUICK_NOTE_UPDATED",
      sourceType: "MANUAL",
      summary: "Mise a jour rapide de la note / etat / type",
      payload: {
        from: {
          noteRapide: currentObject.noteRapide,
          etat: currentObject.etat,
          typeObjet: currentObject.typeObjet
        },
        to: {
          noteRapide: input.noteRapide,
          etat: input.etat === undefined ? currentObject.etat : input.etat,
          typeObjet:
            input.typeObjet === undefined ? currentObject.typeObjet : input.typeObjet
        }
      },
      rollbackData: {
        kind: "OBJECT_PATCH",
        patch: {
          noteRapide: currentObject.noteRapide,
          etat: currentObject.etat,
          typeObjet: currentObject.typeObjet
        }
      },
      createdAt: now
    });

    return updatedObject;
  }

  changeWorkflowStatus(
    objectId: string,
    input: ChangeObjectStatusInput
  ): ObjectEntity {
    const currentObject = this.getObject(objectId);
    const now = new Date().toISOString();

    const updatedObject = this.objectRepository.updateWorkflowStatus(
      objectId,
      input.workflowStatus,
      now
    );

    if (!updatedObject) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_WORKFLOW_STATUS_CHANGED",
      sourceType: "MANUAL",
      summary: `Statut workflow change vers ${input.workflowStatus}`,
      payload: {
        from: currentObject.workflowStatus,
        to: input.workflowStatus,
        note: input.note ?? null
      },
      rollbackData: {
        kind: "OBJECT_WORKFLOW_STATUS",
        workflowStatus: currentObject.workflowStatus
      },
      createdAt: now
    });

    return updatedObject;
  }
}
