import Database from "better-sqlite3";

import { ObjectEntity, QuickObjectView, WorkflowStatus } from "./object.model";
import {
  ListObjectsQuery,
  QuickSearchObjectsQuery,
  UpdateObjectInput
} from "./object.schemas";

interface ObjectRow {
  object_id: string;
  created_at: string;
  updated_at: string;
  stock_status: string;
  workflow_status: WorkflowStatus;
  source: string | null;
  note_rapide: string | null;
  type_objet: string | null;
  titre_interne: string | null;
  description_interne: string | null;
  categorie_interne: string | null;
  etat: string | null;
  prix_ia_cents: number | null;
  prix_reference_cents: number | null;
  prix_final_cents: number | null;
  confiance: number | null;
  main_photo_id: string | null;
  location_code: string | null;
  metadata: string;
}

interface QuickObjectRow {
  object_id: string;
  updated_at: string;
  workflow_status: WorkflowStatus;
  note_rapide: string | null;
  etat: string | null;
  type_objet: string | null;
  main_photo_id: string | null;
}

function parseMetadata(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapRow(row: ObjectRow): ObjectEntity {
  return {
    objectId: row.object_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stockStatus: row.stock_status,
    workflowStatus: row.workflow_status,
    source: row.source,
    noteRapide: row.note_rapide,
    typeObjet: row.type_objet,
    titreInterne: row.titre_interne,
    descriptionInterne: row.description_interne,
    categorieInterne: row.categorie_interne,
    etat: row.etat,
    prixIA: row.prix_ia_cents,
    prixReference: row.prix_reference_cents,
    prixFinal: row.prix_final_cents,
    confiance: row.confiance,
    mainPhotoId: row.main_photo_id,
    locationCode: row.location_code,
    metadata: parseMetadata(row.metadata)
  };
}

function mapQuickRow(row: QuickObjectRow): QuickObjectView {
  return {
    objectId: row.object_id,
    updatedAt: row.updated_at,
    workflowStatus: row.workflow_status,
    noteRapide: row.note_rapide,
    etat: row.etat,
    typeObjet: row.type_objet,
    mainPhotoId: row.main_photo_id
  };
}

export class ObjectRepository {
  constructor(private readonly db: Database.Database) {}

  create(object: ObjectEntity): ObjectEntity {
    this.db
      .prepare(
        `
          INSERT INTO objects (
            object_id,
            created_at,
            updated_at,
            stock_status,
            workflow_status,
            source,
            note_rapide,
            type_objet,
            titre_interne,
            description_interne,
            categorie_interne,
            etat,
            prix_ia_cents,
            prix_reference_cents,
            prix_final_cents,
            confiance,
            main_photo_id,
            location_code,
            metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        object.objectId,
        object.createdAt,
        object.updatedAt,
        object.stockStatus,
        object.workflowStatus,
        object.source,
        object.noteRapide,
        object.typeObjet,
        object.titreInterne,
        object.descriptionInterne,
        object.categorieInterne,
        object.etat,
        object.prixIA,
        object.prixReference,
        object.prixFinal,
        object.confiance,
        object.mainPhotoId,
        object.locationCode,
        JSON.stringify(object.metadata)
      );

    return object;
  }

  list(filters: ListObjectsQuery): ObjectEntity[] {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const publishedPublicationExistsClause = `
      EXISTS (
        SELECT 1
        FROM publications p
        WHERE p.object_id = objects.object_id
          AND (
            p.published_at IS NOT NULL
            OR p.sold_at IS NOT NULL
            OR UPPER(p.channel_status) IN ('PUBLISHED', 'ACTIVE', 'ONLINE', 'LIVE', 'SOLD')
          )
      )
    `;

    if (filters.q) {
      clauses.push(
        "(object_id LIKE ? OR note_rapide LIKE ? OR titre_interne LIKE ? OR type_objet LIKE ?)"
      );
      values.push(
        `%${filters.q}%`,
        `%${filters.q}%`,
        `%${filters.q}%`,
        `%${filters.q}%`
      );
    }

    if (filters.noteRapide) {
      clauses.push("note_rapide LIKE ?");
      values.push(`%${filters.noteRapide}%`);
    }

    if (filters.titreInterne) {
      clauses.push("titre_interne LIKE ?");
      values.push(`%${filters.titreInterne}%`);
    }

    if (filters.categorieInterne) {
      clauses.push("categorie_interne LIKE ?");
      values.push(`%${filters.categorieInterne}%`);
    }

    if (filters.typeObjet) {
      clauses.push("type_objet LIKE ?");
      values.push(`%${filters.typeObjet}%`);
    }

    if (filters.channelId && filters.channelStatus) {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM publications p
          WHERE p.object_id = objects.object_id
            AND p.channel_id = ?
            AND p.channel_status = ?
        )`
      );
      values.push(filters.channelId, filters.channelStatus);
    } else if (filters.channelId) {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM publications p
          WHERE p.object_id = objects.object_id
            AND p.channel_id = ?
        )`
      );
      values.push(filters.channelId);
    } else if (filters.channelStatus) {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM publications p
          WHERE p.object_id = objects.object_id
            AND p.channel_status = ?
        )`
      );
      values.push(filters.channelStatus);
    }

    if (filters.workflowStatus) {
      clauses.push("workflow_status = ?");
      values.push(filters.workflowStatus);
    }

    if (filters.stockStatus) {
      clauses.push("stock_status = ?");
      values.push(filters.stockStatus);
    }

    if (filters.auditPreset === "PROBLEM") {
      clauses.push("workflow_status = 'PROBLEME'");
    }

    if (filters.auditPreset === "READY_UNPUBLISHED") {
      clauses.push("workflow_status = 'PRET'");
      clauses.push(`NOT ${publishedPublicationExistsClause}`);
    }

    if (filters.auditPreset === "SOLD_UNPAID") {
      clauses.push("workflow_status = 'VENDU'");
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM objects
          ${whereClause}
          ORDER BY updated_at DESC
        `
      )
      .all(...values) as ObjectRow[];

    return rows.map(mapRow);
  }

  findById(objectId: string): ObjectEntity | null {
    const row = this.db
      .prepare("SELECT * FROM objects WHERE object_id = ? LIMIT 1")
      .get(objectId) as ObjectRow | undefined;

    return row ? mapRow(row) : null;
  }

  update(objectId: string, patch: UpdateObjectInput, updatedAt: string): ObjectEntity | null {
    const fieldMap: Record<keyof UpdateObjectInput, string> = {
      stockStatus: "stock_status",
      source: "source",
      noteRapide: "note_rapide",
      typeObjet: "type_objet",
      titreInterne: "titre_interne",
      descriptionInterne: "description_interne",
      categorieInterne: "categorie_interne",
      etat: "etat",
      prixIA: "prix_ia_cents",
      prixReference: "prix_reference_cents",
      prixFinal: "prix_final_cents",
      confiance: "confiance",
      mainPhotoId: "main_photo_id",
      locationCode: "location_code",
      metadata: "metadata"
    };

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(patch) as Array<
      [keyof UpdateObjectInput, UpdateObjectInput[keyof UpdateObjectInput]]
    >) {
      if (value === undefined) {
        continue;
      }

      updates.push(`${fieldMap[key]} = ?`);
      values.push(key === "metadata" ? JSON.stringify(value) : value);
    }

    if (updates.length === 0) {
      return this.findById(objectId);
    }

    updates.push("updated_at = ?");
    values.push(updatedAt, objectId);

    this.db
      .prepare(
        `
          UPDATE objects
          SET ${updates.join(", ")}
          WHERE object_id = ?
        `
      )
      .run(...values);

    return this.findById(objectId);
  }

  quickSearch(query: QuickSearchObjectsQuery): QuickObjectView[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            object_id,
            updated_at,
            workflow_status,
            note_rapide,
            etat,
            type_objet,
            main_photo_id
          FROM objects
          WHERE note_rapide LIKE ?
          ORDER BY updated_at DESC
          LIMIT ?
        `
      )
      .all(`%${query.q}%`, query.limit) as QuickObjectRow[];

    return rows.map(mapQuickRow);
  }

  updateWorkflowStatus(
    objectId: string,
    workflowStatus: WorkflowStatus,
    updatedAt: string
  ): ObjectEntity | null {
    this.db
      .prepare(
        `
          UPDATE objects
          SET workflow_status = ?, updated_at = ?
          WHERE object_id = ?
        `
      )
      .run(workflowStatus, updatedAt, objectId);

    return this.findById(objectId);
  }

  setMainPhotoId(
    objectId: string,
    mainPhotoId: string | null,
    updatedAt: string
  ): ObjectEntity | null {
    this.db
      .prepare(
        `
          UPDATE objects
          SET main_photo_id = ?, updated_at = ?
          WHERE object_id = ?
        `
      )
      .run(mainPhotoId, updatedAt, objectId);

    return this.findById(objectId);
  }

  touch(objectId: string, updatedAt: string): ObjectEntity | null {
    this.db
      .prepare(
        `
          UPDATE objects
          SET updated_at = ?
          WHERE object_id = ?
        `
      )
      .run(updatedAt, objectId);

    return this.findById(objectId);
  }
}
