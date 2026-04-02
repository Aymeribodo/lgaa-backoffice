import { constants } from "node:fs";
import { access } from "node:fs/promises";

import {
  BadRequestError,
  NotFoundError
} from "../../common/errors/app-error";
import { IdService } from "../../common/services/id.service";
import { HistoryRepository } from "../history/history.repository";
import { ObjectRepository } from "../objects/object.repository";

import {
  PhotoEntity,
  PhotoFileDescriptor,
  PhotoFileVariant,
  PhotoView,
  UploadPhotoInput
} from "./photo.model";
import { PhotoRepository } from "./photo.repository";
import { PhotoStorageService } from "./photo.storage";

function toPhotoViews(
  photos: PhotoEntity[],
  mainPhotoId: string | null
): PhotoView[] {
  return photos.map((photo) => ({
    ...photo,
    isMain: photo.photoId === mainPhotoId
  }));
}

function extractStoredFileSequence(storedFilename: string | null): number {
  const match = /^(\d+)/.exec(storedFilename ?? "");

  if (!match) {
    return 0;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNextStoredFileSequence(photos: PhotoEntity[]): number {
  return (
    photos.reduce(
      (maxSequence, photo) =>
        Math.max(maxSequence, extractStoredFileSequence(photo.storedFilename)),
      0
    ) + 1
  );
}

export class PhotoService {
  constructor(
    private readonly photoRepository: PhotoRepository,
    private readonly objectRepository: ObjectRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly idService: IdService,
    private readonly photoStorageService: PhotoStorageService
  ) {}

  async uploadPhotos(
    objectId: string,
    files: UploadPhotoInput[]
  ): Promise<PhotoView[]> {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    if (files.length === 0) {
      throw new BadRequestError("Aucun fichier image n'a ete envoye");
    }

    const existingPhotos = this.photoRepository.listByObjectId(objectId);
    const nextStoredFileSequence = getNextStoredFileSequence(existingPhotos);

    const createdAt = new Date().toISOString();
    const createdPhotos: PhotoEntity[] = [];

    try {
      for (const [index, file] of files.entries()) {
        const photoId = this.idService.nextPhotoId();
        const storedFile = await this.photoStorageService.storePhoto(
          objectId,
          nextStoredFileSequence + index,
          file
        );

        createdPhotos.push({
          photoId,
          objectId,
          position: existingPhotos.length + index + 1,
          originalFilename: storedFile.originalFilename,
          storedFilename: storedFile.storedFilename,
          relativePath: storedFile.relativePath,
          mimeType: storedFile.mimeType,
          metadata: storedFile.metadata,
          createdAt
        });
      }

      this.photoRepository.createMany(createdPhotos);
    } catch (error) {
      for (const photo of createdPhotos) {
        await this.photoStorageService.deletePhotoFiles(objectId, {
          relativePath: photo.relativePath,
          metadata: photo.metadata
        });
      }

      throw error;
    }

    const now = new Date().toISOString();
    const nextMainPhotoId = object.mainPhotoId ?? createdPhotos[0]?.photoId ?? null;

    this.objectRepository.setMainPhotoId(objectId, nextMainPhotoId, now);
    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_PHOTOS_UPLOADED",
      sourceType: "MANUAL",
      summary: `${createdPhotos.length} photo(s) ajoutee(s)`,
      payload: {
        photoIds: createdPhotos.map((photo) => photo.photoId),
        count: createdPhotos.length,
        mainPhotoId: nextMainPhotoId
      },
      createdAt: now
    });

    return this.listPhotos(objectId);
  }

  listPhotos(objectId: string): PhotoView[] {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const photos = this.photoRepository.listByObjectId(objectId);

    return toPhotoViews(photos, object.mainPhotoId);
  }

  setMainPhoto(objectId: string, photoId: string): PhotoView[] {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const photo = this.photoRepository.findByObjectAndId(objectId, photoId);

    if (!photo) {
      throw new NotFoundError(`Photo introuvable: ${photoId}`);
    }

    const now = new Date().toISOString();

    this.objectRepository.setMainPhotoId(objectId, photo.photoId, now);
    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_MAIN_PHOTO_CHANGED",
      sourceType: "MANUAL",
      summary: "Photo principale modifiee",
      payload: {
        from: object.mainPhotoId,
        to: photo.photoId
      },
      createdAt: now
    });

    return this.listPhotos(objectId);
  }

  async deletePhoto(objectId: string, photoId: string): Promise<PhotoView[]> {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const photo = this.photoRepository.findByObjectAndId(objectId, photoId);

    if (!photo) {
      throw new NotFoundError(`Photo introuvable: ${photoId}`);
    }

    await this.photoStorageService.deletePhotoFiles(objectId, {
      relativePath: photo.relativePath,
      metadata: photo.metadata
    });

    this.photoRepository.deleteByObjectAndId(objectId, photoId);

    const remainingPhotos = this.photoRepository.listByObjectId(objectId);
    const reorderedPositions = remainingPhotos.map((item, index) => ({
      photoId: item.photoId,
      position: index + 1
    }));

    if (
      reorderedPositions.some(
        (item, index) => remainingPhotos[index]?.position !== item.position
      )
    ) {
      this.photoRepository.updatePositions(objectId, reorderedPositions);
    }

    const nextMainPhotoId =
      object.mainPhotoId === photoId
        ? remainingPhotos[0]?.photoId ?? null
        : object.mainPhotoId;
    const now = new Date().toISOString();

    this.objectRepository.setMainPhotoId(objectId, nextMainPhotoId, now);
    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_PHOTO_DELETED",
      sourceType: "MANUAL",
      summary: "Photo supprimee",
      payload: {
        deletedPhotoId: photoId,
        nextMainPhotoId
      },
      createdAt: now
    });

    return this.listPhotos(objectId);
  }

  async reorderPhotos(objectId: string, photoIds: string[]): Promise<PhotoView[]> {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const existingPhotos = this.photoRepository.listByObjectId(objectId);

    if (existingPhotos.length !== photoIds.length) {
      throw new BadRequestError(
        "Le reordonnancement doit contenir exactement toutes les photos de l'objet"
      );
    }

    const existingIds = new Set(existingPhotos.map((photo) => photo.photoId));

    for (const photoId of photoIds) {
      if (!existingIds.has(photoId)) {
        throw new BadRequestError(
          `Photo inconnue dans le reordonnancement: ${photoId}`
        );
      }
    }

    const updates = photoIds.map((photoId, index) => ({
      photoId,
      position: index + 1
    }));

    this.photoRepository.updatePositions(objectId, updates);

    const now = new Date().toISOString();
    this.objectRepository.touch(objectId, now);
    this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_PHOTOS_REORDERED",
      sourceType: "MANUAL",
      summary: "Ordre des photos modifie",
      payload: {
        photoIds
      },
      createdAt: now
    });

    return this.listPhotos(objectId);
  }

  async getPhotoFile(
    objectId: string,
    photoId: string,
    variant: PhotoFileVariant
  ): Promise<PhotoFileDescriptor> {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const photo = this.photoRepository.findByObjectAndId(objectId, photoId);

    if (!photo) {
      throw new NotFoundError(`Photo introuvable: ${photoId}`);
    }

    const relativePath =
      variant === "thumbnail" && photo.metadata.thumbnailRelativePath
        ? photo.metadata.thumbnailRelativePath
        : photo.relativePath;

    if (!relativePath) {
      throw new NotFoundError(`Fichier photo introuvable: ${photoId}`);
    }

    const absolutePath = this.photoStorageService.resolveAbsolutePath(relativePath);

    try {
      await access(absolutePath, constants.R_OK);
    } catch {
      throw new NotFoundError(`Fichier photo introuvable: ${photoId}`);
    }

    return {
      absolutePath,
      mimeType: photo.mimeType,
      storedFilename: photo.storedFilename
    };
  }
}
