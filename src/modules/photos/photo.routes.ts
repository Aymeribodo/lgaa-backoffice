import { createReadStream } from "node:fs";

import { FastifyInstance } from "fastify";

import { BadRequestError } from "../../common/errors/app-error";

import { toPhotoHttpView } from "./photo.http";
import { UploadPhotoInput } from "./photo.model";
import {
  objectIdParamsSchema,
  objectPhotoParamsSchema,
  photoFileQuerySchema,
  reorderPhotosSchema,
  setMainPhotoSchema
} from "./photo.schemas";
import { PhotoService } from "./photo.service";

export function registerPhotoRoutes(
  app: FastifyInstance,
  photoService: PhotoService
): void {
  app.post("/objects/:objectId/photos", async (request, reply) => {
    const params = objectIdParamsSchema.parse(request.params);

    if (!request.isMultipart()) {
      throw new BadRequestError("Le endpoint attend un formulaire multipart/form-data");
    }

    const files: UploadPhotoInput[] = [];

    for await (const part of request.files()) {
      const buffer = await part.toBuffer();

      files.push({
        filename: part.filename,
        mimetype: part.mimetype,
        buffer
      });
    }

    const photos = await photoService.uploadPhotos(params.objectId, files);

    reply.code(201).send({ data: photos.map(toPhotoHttpView) });
  });

  app.get("/objects/:objectId/photos", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);

    return {
      data: photoService.listPhotos(params.objectId).map(toPhotoHttpView)
    };
  });

  app.get("/objects/:objectId/photos/:photoId/file", async (request, reply) => {
    const params = objectPhotoParamsSchema.parse(request.params);
    const query = photoFileQuerySchema.parse(request.query);
    const file = await photoService.getPhotoFile(
      params.objectId,
      params.photoId,
      query.variant
    );

    reply.header("Cache-Control", "private, max-age=60");
    reply.type(file.mimeType).send(createReadStream(file.absolutePath));
  });

  app.patch("/objects/:objectId/photos/main", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);
    const payload = setMainPhotoSchema.parse(request.body);

    return {
      data: photoService.setMainPhoto(params.objectId, payload.photoId).map(toPhotoHttpView)
    };
  });

  app.patch("/objects/:objectId/photos/reorder", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);
    const payload = reorderPhotosSchema.parse(request.body);

    return {
      data: (await photoService.reorderPhotos(params.objectId, payload.photoIds)).map(
        toPhotoHttpView
      )
    };
  });

  app.delete("/objects/:objectId/photos/:photoId", async (request) => {
    const params = objectPhotoParamsSchema.parse(request.params);

    return {
      data: (await photoService.deletePhoto(params.objectId, params.photoId)).map(
        toPhotoHttpView
      )
    };
  });
}
