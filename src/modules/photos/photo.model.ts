export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

export interface PhotoMetadata {
  extension: string;
  sizeBytes: number;
  checksumSha256: string;
  width: number | null;
  height: number | null;
  thumbnailRelativePath: string | null;
}

export interface PhotoEntity {
  photoId: string;
  objectId: string;
  position: number;
  originalFilename: string | null;
  storedFilename: string | null;
  relativePath: string | null;
  mimeType: AllowedPhotoMimeType;
  metadata: PhotoMetadata;
  createdAt: string;
}

export interface PhotoView extends PhotoEntity {
  isMain: boolean;
}

export interface PhotoHttpView extends PhotoView {
  originalUrl: string | null;
  thumbnailUrl: string | null;
}

export const PHOTO_FILE_VARIANTS = ["original", "thumbnail"] as const;

export type PhotoFileVariant = (typeof PHOTO_FILE_VARIANTS)[number];

export interface PhotoFileDescriptor {
  absolutePath: string;
  mimeType: AllowedPhotoMimeType;
  storedFilename: string | null;
}

export interface UploadPhotoInput {
  filename: string | undefined;
  mimetype: string;
  buffer: Buffer;
}

export interface PhotoStorageSyncInput {
  photoId: string;
  position: number;
  relativePath: string | null;
  metadata: PhotoMetadata;
}

export interface SyncedPhotoFile {
  photoId: string;
  storedFilename: string;
  relativePath: string;
  metadata: PhotoMetadata;
}
