import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { basename, resolve } from "node:path";
import { posix as pathPosix } from "node:path";

import sharp from "sharp";

import { BadRequestError } from "../../common/errors/app-error";
import { AppEnv } from "../../config/env";

import {
  AllowedPhotoMimeType,
  PhotoMetadata,
  PhotoStorageSyncInput,
  SyncedPhotoFile,
  UploadPhotoInput
} from "./photo.model";

const MIME_EXTENSION_MAP: Record<AllowedPhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function normalizeMimeType(value: string): string {
  return value === "image/jpg" ? "image/jpeg" : value;
}

function detectMimeType(buffer: Buffer): AllowedPhotoMimeType | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function sanitizeFilename(filename: string | undefined): string | null {
  if (!filename) {
    return null;
  }

  const value = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");

  return value.length > 0 ? value.slice(0, 255) : null;
}

export interface StoredPhotoFile {
  originalFilename: string | null;
  storedFilename: string;
  relativePath: string;
  mimeType: AllowedPhotoMimeType;
  metadata: PhotoMetadata;
}

function buildStoredBasename(position: number): string {
  return String(position).padStart(2, "0");
}

function buildStoredFilename(position: number, extension: string): string {
  return `${buildStoredBasename(position)}.${extension}`;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, delayMs);
  });
}

export class PhotoStorageService {
  private readonly storageRoot: string;

  constructor(private readonly env: AppEnv) {
    this.storageRoot = resolve(process.cwd(), env.STORAGE_ROOT);
  }

  resolveAbsolutePath(relativePath: string): string {
    return resolve(this.storageRoot, relativePath);
  }

  async storePhoto(
    objectId: string,
    position: number,
    input: UploadPhotoInput
  ): Promise<StoredPhotoFile> {
    const validated = await this.validatePhotoInput(input);

    await this.ensureObjectDirectories(objectId);

    const storedFilename = buildStoredFilename(position, validated.metadata.extension);
    const relativePath = this.buildOriginalRelativePath(objectId, storedFilename);
    const absolutePath = resolve(this.storageRoot, relativePath);

    await writeFile(absolutePath, input.buffer);

    let thumbnailRelativePath: string | null = null;

    if (this.env.ENABLE_PHOTO_THUMBNAILS) {
      thumbnailRelativePath = this.buildThumbnailRelativePath(objectId, storedFilename);
      const thumbnailAbsolutePath = resolve(this.storageRoot, thumbnailRelativePath);

      await sharp(input.buffer)
        .resize(this.env.PHOTO_THUMBNAIL_MAX_SIZE, this.env.PHOTO_THUMBNAIL_MAX_SIZE, {
          fit: "inside",
          withoutEnlargement: true
        })
        .toFile(thumbnailAbsolutePath);
    }

    return {
      originalFilename: sanitizeFilename(input.filename),
      storedFilename,
      relativePath,
      mimeType: validated.mimeType,
      metadata: {
        ...validated.metadata,
        thumbnailRelativePath
      }
    };
  }

  async normalizePhotoFiles(
    objectId: string,
    photos: PhotoStorageSyncInput[]
  ): Promise<SyncedPhotoFile[]> {
    if (photos.length === 0) {
      return [];
    }

    await this.ensureObjectDirectories(objectId);

    const plans = photos.map((photo) => {
      const storedFilename = buildStoredFilename(photo.position, photo.metadata.extension);
      const relativePath = this.buildOriginalRelativePath(objectId, storedFilename);
      const keepThumbnail =
        this.env.ENABLE_PHOTO_THUMBNAILS || !!photo.metadata.thumbnailRelativePath;
      const thumbnailRelativePath = keepThumbnail
        ? this.buildThumbnailRelativePath(objectId, storedFilename)
        : null;

      return {
        photo,
        storedFilename,
        relativePath,
        thumbnailRelativePath
      };
    });

    if (plans.some((plan) => plan.thumbnailRelativePath)) {
      await mkdir(resolve(this.storageRoot, "objects", objectId, "thumbnails"), {
        recursive: true
      });
    }

    const originalBuffers = new Map<string, Buffer>();
    const thumbnailBuffers = new Map<string, Buffer>();

    for (const plan of plans) {
      if (plan.photo.relativePath && plan.photo.relativePath !== plan.relativePath) {
        originalBuffers.set(plan.photo.photoId, await this.readRelativePath(plan.photo.relativePath));
      }

      if (
        plan.photo.metadata.thumbnailRelativePath &&
        plan.thumbnailRelativePath &&
        plan.photo.metadata.thumbnailRelativePath !== plan.thumbnailRelativePath
      ) {
        thumbnailBuffers.set(
          plan.photo.photoId,
          await this.readRelativePath(plan.photo.metadata.thumbnailRelativePath)
        );
      }
    }

    for (const plan of plans) {
      if (plan.photo.relativePath && plan.photo.relativePath !== plan.relativePath) {
        await this.deleteRelativePath(plan.photo.relativePath);
      }

      if (
        plan.photo.metadata.thumbnailRelativePath &&
        plan.thumbnailRelativePath &&
        plan.photo.metadata.thumbnailRelativePath !== plan.thumbnailRelativePath
      ) {
        await this.deleteRelativePath(plan.photo.metadata.thumbnailRelativePath);
      }
    }

    for (const plan of plans) {
      const originalBuffer = originalBuffers.get(plan.photo.photoId);

      if (originalBuffer) {
        await writeFile(resolve(this.storageRoot, plan.relativePath), originalBuffer);
      }

      const thumbnailBuffer = thumbnailBuffers.get(plan.photo.photoId);

      if (thumbnailBuffer && plan.thumbnailRelativePath) {
        await writeFile(resolve(this.storageRoot, plan.thumbnailRelativePath), thumbnailBuffer);
      }
    }

    return plans.map((plan) => ({
      photoId: plan.photo.photoId,
      storedFilename: plan.storedFilename,
      relativePath: plan.relativePath,
      metadata: {
        ...plan.photo.metadata,
        thumbnailRelativePath: plan.thumbnailRelativePath
      }
    }));
  }

  async deletePhotoFiles(objectId: string, photo: StoredPhotoFile | { relativePath: string | null; metadata: PhotoMetadata }): Promise<void> {
    if (photo.relativePath) {
      await this.deleteRelativePath(photo.relativePath);
    }

    if (photo.metadata.thumbnailRelativePath) {
      await this.deleteRelativePath(photo.metadata.thumbnailRelativePath);
    }

    const objectDirectory = resolve(this.storageRoot, "objects", objectId);
    await rm(objectDirectory, {
      recursive: false,
      force: false
    }).catch(() => undefined);
  }

  private async validatePhotoInput(
    input: UploadPhotoInput
  ): Promise<{ mimeType: AllowedPhotoMimeType; metadata: PhotoMetadata }> {
    if (input.buffer.length === 0) {
      throw new BadRequestError("Un fichier image est vide");
    }

    if (input.buffer.length > this.env.PHOTO_MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError("Un fichier depasse la taille maximale autorisee");
    }

    const detectedMimeType = detectMimeType(input.buffer);

    if (!detectedMimeType) {
      throw new BadRequestError(
        "Format image non supporte. Formats acceptes: JPEG, PNG, WEBP"
      );
    }

    const normalizedMimeType = normalizeMimeType(input.mimetype);

    if (
      normalizedMimeType &&
      normalizedMimeType !== detectedMimeType
    ) {
      throw new BadRequestError(
        "Le type MIME annonce ne correspond pas au contenu du fichier"
      );
    }

    const imageMetadata = await sharp(input.buffer).metadata();

    if (!imageMetadata.width || !imageMetadata.height) {
      throw new BadRequestError("Impossible de lire les dimensions de l'image");
    }

    return {
      mimeType: detectedMimeType,
      metadata: {
        extension: MIME_EXTENSION_MAP[detectedMimeType],
        sizeBytes: input.buffer.length,
        checksumSha256: createHash("sha256").update(input.buffer).digest("hex"),
        width: imageMetadata.width,
        height: imageMetadata.height,
        thumbnailRelativePath: null
      }
    };
  }

  private async ensureObjectDirectories(objectId: string): Promise<void> {
    await mkdir(resolve(this.storageRoot, "objects", objectId, "originals"), {
      recursive: true
    });

    if (this.env.ENABLE_PHOTO_THUMBNAILS) {
      await mkdir(resolve(this.storageRoot, "objects", objectId, "thumbnails"), {
        recursive: true
      });
    }
  }

  private buildOriginalRelativePath(objectId: string, filename: string): string {
    return pathPosix.join("objects", objectId, "originals", filename);
  }

  private buildThumbnailRelativePath(objectId: string, filename: string): string {
    return pathPosix.join("objects", objectId, "thumbnails", filename);
  }

  private async readRelativePath(relativePath: string): Promise<Buffer> {
    const absolutePath = resolve(this.storageRoot, relativePath);

    await access(absolutePath);
    return readFile(absolutePath);
  }

  private async deleteRelativePath(relativePath: string): Promise<boolean> {
    const absolutePath = resolve(this.storageRoot, relativePath);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await rm(absolutePath, {
          force: true
        });
        return true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code !== "EPERM" && code !== "EBUSY") {
          throw error;
        }

        await wait(75 * (attempt + 1));
      }
    }

    return false;
  }
}
