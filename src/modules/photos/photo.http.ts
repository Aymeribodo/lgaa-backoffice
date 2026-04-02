import { PhotoHttpView, PhotoView } from "./photo.model";

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function buildStorageHttpUrl(relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }

  return `/storage/${normalizeRelativePath(relativePath)}`;
}

export function toPhotoHttpView(photo: PhotoView): PhotoHttpView {
  const originalUrl = buildStorageHttpUrl(photo.relativePath);
  const thumbnailUrl =
    buildStorageHttpUrl(photo.metadata.thumbnailRelativePath) ?? originalUrl;

  return {
    ...photo,
    originalUrl,
    thumbnailUrl
  };
}
