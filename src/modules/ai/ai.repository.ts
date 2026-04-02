import Database from "better-sqlite3";

import {
  AiGenerationInputSnapshot,
  AiGenerationRecord,
  AiGenerationStatus,
  AiGenerationTriggerType,
  AiSuggestion
} from "./ai.model";
import { aiSuggestionSchema } from "./ai.schemas";

interface AiGenerationRow {
  generation_id: number;
  object_id: string;
  trigger_type: AiGenerationTriggerType;
  generation_status: AiGenerationStatus;
  attempt_number: number;
  provider: string;
  model: string;
  prompt_version: string;
  input_snapshot: string;
  output_json: string | null;
  confidence: number | null;
  error_code: string | null;
  error_message: string | null;
  provider_response_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function parseInputSnapshot(value: string): AiGenerationInputSnapshot {
  try {
    return JSON.parse(value) as AiGenerationInputSnapshot;
  } catch {
    return {
      objectId: "",
      noteRapide: null,
      etat: null,
      typeObjet: null,
      mainPhotoId: null,
      totalPhotoCount: 0,
      selectedPhotoCount: 0,
      photos: []
    };
  }
}

function parseOutput(value: string | null): AiSuggestion | null {
  if (!value) {
    return null;
  }

  try {
    return aiSuggestionSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

function mapRow(row: AiGenerationRow): AiGenerationRecord {
  return {
    generationId: row.generation_id,
    objectId: row.object_id,
    triggerType: row.trigger_type,
    generationStatus: row.generation_status,
    attemptNumber: row.attempt_number,
    provider: row.provider,
    model: row.model,
    promptVersion: row.prompt_version,
    inputSnapshot: parseInputSnapshot(row.input_snapshot),
    output: parseOutput(row.output_json),
    confidence: row.confidence,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    providerResponseId: row.provider_response_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

export class AiGenerationRepository {
  constructor(private readonly db: Database.Database) {}

  getNextAttemptNumber(objectId: string): number {
    const row = this.db
      .prepare(
        `
          SELECT COALESCE(MAX(attempt_number), 0) AS max_attempt
          FROM object_ai_generations
          WHERE object_id = ?
        `
      )
      .get(objectId) as { max_attempt: number } | undefined;

    return (row?.max_attempt ?? 0) + 1;
  }

  createPending(input: {
    objectId: string;
    triggerType: AiGenerationTriggerType;
    attemptNumber: number;
    provider: string;
    model: string;
    promptVersion: string;
    inputSnapshot: AiGenerationInputSnapshot;
    createdAt: string;
  }): number {
    const result = this.db
      .prepare(
        `
          INSERT INTO object_ai_generations (
            object_id,
            trigger_type,
            generation_status,
            attempt_number,
            provider,
            model,
            prompt_version,
            input_snapshot,
            created_at,
            updated_at
          ) VALUES (?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.objectId,
        input.triggerType,
        input.attemptNumber,
        input.provider,
        input.model,
        input.promptVersion,
        JSON.stringify(input.inputSnapshot),
        input.createdAt,
        input.createdAt
      );

    return Number(result.lastInsertRowid);
  }

  markCompleted(input: {
    generationId: number;
    output: AiSuggestion;
    confidence: number;
    providerResponseId: string | null;
    completedAt: string;
  }): AiGenerationRecord {
    this.db
      .prepare(
        `
          UPDATE object_ai_generations
          SET
            generation_status = 'COMPLETED',
            output_json = ?,
            confidence = ?,
            provider_response_id = ?,
            error_code = NULL,
            error_message = NULL,
            updated_at = ?,
            completed_at = ?
          WHERE generation_id = ?
        `
      )
      .run(
        JSON.stringify(input.output),
        input.confidence,
        input.providerResponseId,
        input.completedAt,
        input.completedAt,
        input.generationId
      );

    return this.getByIdOrThrow(input.generationId);
  }

  markFailed(input: {
    generationId: number;
    errorCode: string;
    errorMessage: string;
    completedAt: string;
  }): AiGenerationRecord {
    this.db
      .prepare(
        `
          UPDATE object_ai_generations
          SET
            generation_status = 'FAILED',
            error_code = ?,
            error_message = ?,
            updated_at = ?,
            completed_at = ?
          WHERE generation_id = ?
        `
      )
      .run(
        input.errorCode,
        input.errorMessage,
        input.completedAt,
        input.completedAt,
        input.generationId
      );

    return this.getByIdOrThrow(input.generationId);
  }

  listByObjectId(objectId: string): AiGenerationRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM object_ai_generations
          WHERE object_id = ?
          ORDER BY created_at DESC
        `
      )
      .all(objectId) as AiGenerationRow[];

    return rows.map(mapRow);
  }

  findById(generationId: number): AiGenerationRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM object_ai_generations
          WHERE generation_id = ?
          LIMIT 1
        `
      )
      .get(generationId) as AiGenerationRow | undefined;

    return row ? mapRow(row) : null;
  }

  private getByIdOrThrow(generationId: number): AiGenerationRecord {
    const row = this.findById(generationId);

    if (!row) {
      throw new Error(`Generation introuvable: ${generationId}`);
    }

    return row;
  }
}
