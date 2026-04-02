import Database from "better-sqlite3";

import {
  AllowedPhotoMimeType,
  PhotoEntity,
  PhotoMetadata,
  SyncedPhotoFile
} from "./photo.model";

interface PhotoRow {
  photo_id: string;
  object_id: string;
  position: number;
  original_filename: string | null;
  stored_filename: string | null;
  relative_path: string | null;
  mime_type: AllowedPhotoMimeType;
  metadata: string;
  created_at: string;
}

function parseMetadata(value: string): PhotoMetadata {
  try {
    const parsed = JSON.parse(value) as Partial<PhotoMetadata>;

    return {
      extension: typeof parsed.extension === "string" ? parsed.extension : "",
      sizeBytes: typeof parsed.sizeBytes === "number" ? parsed.sizeBytes : 0,
      checksumSha256:
        typeof parsed.checksumSha256 === "string" ? parsed.checksumSha256 : "",
      width: typeof parsed.width === "number" ? parsed.width : null,
      height: typeof parsed.height === "number" ? parsed.height : null,
      thumbnailRelativePath:
        typeof parsed.thumbnailRelativePath === "string"
          ? parsed.thumbnailRelativePath
          : null
    };
  } catch {
    return {
      extension: "",
      sizeBytes: 0,
      checksumSha256: "",
      width: null,
      height: null,
      thumbnailRelativePath: null
    };
  }
}

function mapRow(row: PhotoRow): PhotoEntity {
  return {
    photoId: row.photo_id,
    objectId: row.object_id,
    position: row.position,
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    relativePath: row.relative_path,
    mimeType: row.mime_type,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at
  };
}

export class PhotoRepository {
  constructor(private readonly db: Database.Database) {}

  createMany(photos: PhotoEntity[]): void {
    const statement = this.db.prepare(
      `
        INSERT INTO object_photos (
          photo_id,
          object_id,
          position,
          original_filename,
          stored_filename,
          relative_path,
          mime_type,
          metadata,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    this.db.transaction((items: PhotoEntity[]) => {
      for (const photo of items) {
        statement.run(
          photo.photoId,
          photo.objectId,
          photo.position,
          photo.originalFilename,
          photo.storedFilename,
          photo.relativePath,
          photo.mimeType,
          JSON.stringify(photo.metadata),
          photo.createdAt
        );
      }
    })(photos);
  }

  listByObjectId(objectId: string): PhotoEntity[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM object_photos
          WHERE object_id = ?
          ORDER BY position ASC, created_at ASC
        `
      )
      .all(objectId) as PhotoRow[];

    return rows.map(mapRow);
  }

  findByObjectAndId(objectId: string, photoId: string): PhotoEntity | null {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM object_photos
          WHERE object_id = ? AND photo_id = ?
          LIMIT 1
        `
      )
      .get(objectId, photoId) as PhotoRow | undefined;

    return row ? mapRow(row) : null;
  }

  updatePositions(
    objectId: string,
    updates: Array<{ photoId: string; position: number }>
  ): void {
    const temporaryStatement = this.db.prepare(
      `
        UPDATE object_photos
        SET position = ?
        WHERE object_id = ? AND photo_id = ?
      `
    );
    const finalStatement = this.db.prepare(
      `
        UPDATE object_photos
        SET position = ?
        WHERE object_id = ? AND photo_id = ?
      `
    );

    this.db.transaction((items: Array<{ photoId: string; position: number }>) => {
      for (const item of items) {
        temporaryStatement.run(item.position * -1, objectId, item.photoId);
      }

      for (const item of items) {
        finalStatement.run(item.position, objectId, item.photoId);
      }
    })(updates);
  }

  updateStoredFiles(objectId: string, photos: SyncedPhotoFile[]): void {
    const statement = this.db.prepare(
      `
        UPDATE object_photos
        SET stored_filename = ?, relative_path = ?, metadata = ?
        WHERE object_id = ? AND photo_id = ?
      `
    );

    this.db.transaction((items: SyncedPhotoFile[]) => {
      for (const photo of items) {
        statement.run(
          photo.storedFilename,
          photo.relativePath,
          JSON.stringify(photo.metadata),
          objectId,
          photo.photoId
        );
      }
    })(photos);
  }

  deleteByObjectAndId(objectId: string, photoId: string): void {
    this.db
      .prepare(
        `
          DELETE FROM object_photos
          WHERE object_id = ? AND photo_id = ?
        `
      )
      .run(objectId, photoId);
  }
}
