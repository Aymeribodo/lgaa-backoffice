import Database from "better-sqlite3";

import { ChannelEntity } from "./channel.model";

interface ChannelRow {
  channel_id: string;
  code: string;
  name: string;
  is_active: number;
  metadata: string;
  created_at: string;
  updated_at: string;
}

function parseMetadata(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapRow(row: ChannelRow): ChannelEntity {
  return {
    channelId: row.channel_id,
    code: row.code,
    name: row.name,
    isActive: Boolean(row.is_active),
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class ChannelRepository {
  constructor(private readonly db: Database.Database) {}

  listAll(activeOnly = false): ChannelEntity[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM channels
          ${activeOnly ? "WHERE is_active = 1" : ""}
          ORDER BY name ASC
        `
      )
      .all() as ChannelRow[];

    return rows.map(mapRow);
  }

  findById(channelId: string): ChannelEntity | null {
    const row = this.db
      .prepare("SELECT * FROM channels WHERE channel_id = ? LIMIT 1")
      .get(channelId) as ChannelRow | undefined;

    return row ? mapRow(row) : null;
  }
}
