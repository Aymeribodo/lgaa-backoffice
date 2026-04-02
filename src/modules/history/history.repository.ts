import Database from "better-sqlite3";

import {
  HistoryEventInput,
  HistoryEventRecord,
  HistoryRollbackData,
  HistorySourceType
} from "./history.model";

interface HistoryEventRow {
  id: number;
  entity_type: "OBJECT" | "PUBLICATION";
  entity_id: string;
  root_object_id: string | null;
  event_type: string;
  source_type: HistorySourceType | null;
  summary: string | null;
  payload: string;
  created_at: string;
}

interface StoredHistoryPayload {
  meta?: {
    rollbackData?: HistoryRollbackData | null;
  };
  data?: Record<string, unknown>;
}

function parseStoredPayload(
  value: string
): { payload: Record<string, unknown>; rollbackData: HistoryRollbackData | null } {
  try {
    const parsed = JSON.parse(value) as StoredHistoryPayload | Record<string, unknown>;

    if (
      parsed &&
      typeof parsed === "object" &&
      "data" in parsed &&
      typeof parsed.data === "object" &&
      parsed.data !== null
    ) {
      const envelope = parsed as StoredHistoryPayload;

      return {
        payload: envelope.data ?? {},
        rollbackData: envelope.meta?.rollbackData ?? null
      };
    }

    return {
      payload: parsed as Record<string, unknown>,
      rollbackData: null
    };
  } catch {
    return {
      payload: {},
      rollbackData: null
    };
  }
}

function mapRow(row: HistoryEventRow): HistoryEventRecord {
  const parsed = parseStoredPayload(row.payload);

  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    rootObjectId: row.root_object_id,
    eventType: row.event_type,
    sourceType: row.source_type ?? "SYSTEM",
    summary: row.summary,
    payload: parsed.payload,
    rollbackData: parsed.rollbackData,
    createdAt: row.created_at
  };
}

export class HistoryRepository {
  constructor(private readonly db: Database.Database) {}

  append(input: HistoryEventInput): number {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const result = this.db
      .prepare(
        `
          INSERT INTO history_events (
            entity_type,
            entity_id,
            root_object_id,
            event_type,
            source_type,
            summary,
            payload,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.entityType,
        input.entityId,
        input.rootObjectId ?? (input.entityType === "OBJECT" ? input.entityId : null),
        input.eventType,
        input.sourceType ?? "SYSTEM",
        input.summary ?? null,
        JSON.stringify({
          meta: {
            rollbackData: input.rollbackData ?? null
          },
          data: input.payload
        }),
        createdAt
      );

    return Number(result.lastInsertRowid);
  }

  findById(historyEventId: number): HistoryEventRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM history_events
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(historyEventId) as HistoryEventRow | undefined;

    return row ? mapRow(row) : null;
  }

  listByEntity(
    entityType: "OBJECT" | "PUBLICATION",
    entityId: string,
    limit = 100
  ): HistoryEventRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM history_events
          WHERE entity_type = ? AND entity_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        `
      )
      .all(entityType, entityId, limit) as HistoryEventRow[];

    return rows.map(mapRow);
  }

  listByRootObjectId(rootObjectId: string, limit = 200): HistoryEventRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM history_events
          WHERE root_object_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        `
      )
      .all(rootObjectId, limit) as HistoryEventRow[];

    return rows.map(mapRow);
  }
}
