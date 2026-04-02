import Database from "better-sqlite3";

import { PublicationEntity } from "./publication.model";
import {
  ListPublicationsQuery,
  UpdatePublicationInput
} from "./publication.schemas";

interface PublicationRow {
  publication_id: string;
  object_id: string;
  channel_id: string;
  channel_listing_id: string | null;
  channel_status: string;
  titre_publie: string | null;
  description_publiee: string | null;
  categorie_canal: string | null;
  prix_publie_cents: number | null;
  hashtags_publies: string;
  external_url: string | null;
  published_at: string | null;
  sold_at: string | null;
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

function parseHashtags(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function mapRow(row: PublicationRow): PublicationEntity {
  return {
    publicationId: row.publication_id,
    objectId: row.object_id,
    channelId: row.channel_id,
    channelListingId: row.channel_listing_id,
    channelStatus: row.channel_status,
    titrePublie: row.titre_publie,
    descriptionPubliee: row.description_publiee,
    categorieCanal: row.categorie_canal,
    prixPublie: row.prix_publie_cents,
    hashtagsPublies: parseHashtags(row.hashtags_publies),
    externalUrl: row.external_url,
    publishedAt: row.published_at,
    soldAt: row.sold_at,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PublicationRepository {
  constructor(private readonly db: Database.Database) {}

  create(publication: PublicationEntity): PublicationEntity {
    this.db
      .prepare(
        `
          INSERT INTO publications (
            publication_id,
            object_id,
            channel_id,
            channel_listing_id,
            channel_status,
            titre_publie,
            description_publiee,
            categorie_canal,
            prix_publie_cents,
            hashtags_publies,
            external_url,
            published_at,
            sold_at,
            metadata,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        publication.publicationId,
        publication.objectId,
        publication.channelId,
        publication.channelListingId,
        publication.channelStatus,
        publication.titrePublie,
        publication.descriptionPubliee,
        publication.categorieCanal,
        publication.prixPublie,
        JSON.stringify(publication.hashtagsPublies),
        publication.externalUrl,
        publication.publishedAt,
        publication.soldAt,
        JSON.stringify(publication.metadata),
        publication.createdAt,
        publication.updatedAt
      );

    return publication;
  }

  listByObjectId(
    objectId: string,
    filters: Pick<ListPublicationsQuery, "channelId" | "channelStatus"> = {}
  ): PublicationEntity[] {
    const clauses = ["object_id = ?"];
    const values: unknown[] = [objectId];

    if (filters.channelId) {
      clauses.push("channel_id = ?");
      values.push(filters.channelId);
    }

    if (filters.channelStatus) {
      clauses.push("channel_status = ?");
      values.push(filters.channelStatus);
    }

    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM publications
          WHERE ${clauses.join(" AND ")}
          ORDER BY created_at DESC
        `
      )
      .all(...values) as PublicationRow[];

    return rows.map(mapRow);
  }

  list(filters: ListPublicationsQuery): PublicationEntity[] {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (filters.objectId) {
      clauses.push("object_id = ?");
      values.push(filters.objectId);
    }

    if (filters.channelId) {
      clauses.push("channel_id = ?");
      values.push(filters.channelId);
    }

    if (filters.channelStatus) {
      clauses.push("channel_status = ?");
      values.push(filters.channelStatus);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM publications
          ${whereClause}
          ORDER BY created_at DESC
        `
      )
      .all(...values) as PublicationRow[];

    return rows.map(mapRow);
  }

  findById(publicationId: string): PublicationEntity | null {
    const row = this.db
      .prepare("SELECT * FROM publications WHERE publication_id = ? LIMIT 1")
      .get(publicationId) as PublicationRow | undefined;

    return row ? mapRow(row) : null;
  }

  update(
    publicationId: string,
    patch: UpdatePublicationInput,
    updatedAt: string
  ): PublicationEntity | null {
    const fieldMap: Record<keyof UpdatePublicationInput, string> = {
      channelStatus: "channel_status",
      channelListingId: "channel_listing_id",
      titrePublie: "titre_publie",
      descriptionPubliee: "description_publiee",
      categorieCanal: "categorie_canal",
      prixPublie: "prix_publie_cents",
      hashtagsPublies: "hashtags_publies",
      externalUrl: "external_url",
      publishedAt: "published_at",
      soldAt: "sold_at",
      metadata: "metadata"
    };

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(patch) as Array<
      [keyof UpdatePublicationInput, UpdatePublicationInput[keyof UpdatePublicationInput]]
    >) {
      if (value === undefined) {
        continue;
      }

      updates.push(`${fieldMap[key]} = ?`);

      if (key === "hashtagsPublies" || key === "metadata") {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return this.findById(publicationId);
    }

    updates.push("updated_at = ?");
    values.push(updatedAt, publicationId);

    this.db
      .prepare(
        `
          UPDATE publications
          SET ${updates.join(", ")}
          WHERE publication_id = ?
        `
      )
      .run(...values);

    return this.findById(publicationId);
  }

  deleteById(publicationId: string): void {
    this.db
      .prepare(
        `
          DELETE FROM publications
          WHERE publication_id = ?
        `
      )
      .run(publicationId);
  }
}
