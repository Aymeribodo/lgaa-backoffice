import { FastifyInstance } from "fastify";

import { toPhotoHttpView } from "../photos/photo.http";
import { PhotoService } from "../photos/photo.service";
import { PublicationService } from "../publications/publication.service";
import {
  createPublicationSchema,
  listPublicationsQuerySchema
} from "../publications/publication.schemas";

import {
  changeObjectStatusSchema,
  createObjectSchema,
  listObjectsQuerySchema,
  objectIdParamsSchema,
  quickCreateObjectSchema,
  quickSearchObjectsQuerySchema,
  quickUpdateNoteSchema,
  updateObjectSchema
} from "./object.schemas";
import { ObjectService } from "./object.service";
import { ObjectEntity, ObjectListView, ObjectWithPhotos } from "./object.model";

function attachMainPhotoUrl(
  object: ObjectEntity,
  photoService: PhotoService
): ObjectListView {
  const photos = object.mainPhotoId ? photoService.listPhotos(object.objectId) : [];
  const mainPhoto = photos.find((photo) => photo.photoId === object.mainPhotoId) ?? null;

  return {
    ...object,
    mainPhotoUrl: mainPhoto ? toPhotoHttpView(mainPhoto).thumbnailUrl : null
  };
}

function attachPhotos(
  object: ObjectEntity,
  photoService: PhotoService
): ObjectWithPhotos {
  const photos = photoService.listPhotos(object.objectId).map(toPhotoHttpView);
  const mainPhoto = photos.find((photo) => photo.photoId === object.mainPhotoId) ?? null;

  return {
    ...object,
    mainPhotoUrl: mainPhoto?.thumbnailUrl ?? null,
    photos
  };
}

export function registerObjectRoutes(
  app: FastifyInstance,
  objectService: ObjectService,
  publicationService: PublicationService,
  photoService: PhotoService
): void {
  app.post("/objects", async (request, reply) => {
    const payload = createObjectSchema.parse(request.body);
    const object = objectService.createObject(payload);

    reply.code(201).send({ data: attachPhotos(object, photoService) });
  });

  app.post("/objects/quick", async (request, reply) => {
    const payload = quickCreateObjectSchema.parse(request.body);
    const object = objectService.quickCreateObject(payload);

    reply.code(201).send({ data: attachPhotos(object, photoService) });
  });

  app.get("/objects", async (request) => {
    const query = listObjectsQuerySchema.parse(request.query);

    return {
      data: objectService
        .listObjects(query)
        .map((object) => attachMainPhotoUrl(object, photoService))
    };
  });

  app.get("/objects/search/quick", async (request) => {
    const query = quickSearchObjectsQuerySchema.parse(request.query);

    return { data: objectService.quickSearchObjects(query) };
  });

  app.get("/objects/:objectId", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);

    return { data: attachPhotos(objectService.getObject(params.objectId), photoService) };
  });

  app.patch("/objects/:objectId", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);
    const payload = updateObjectSchema.parse(request.body);

    return {
      data: attachPhotos(objectService.updateObject(params.objectId, payload), photoService)
    };
  });

  app.patch("/objects/:objectId/quick-note", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);
    const payload = quickUpdateNoteSchema.parse(request.body);

    return {
      data: attachPhotos(objectService.updateQuickNote(params.objectId, payload), photoService)
    };
  });

  app.patch("/objects/:objectId/status", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);
    const payload = changeObjectStatusSchema.parse(request.body);

    return {
      data: attachPhotos(
        objectService.changeWorkflowStatus(params.objectId, payload),
        photoService
      )
    };
  });

  app.post("/objects/:objectId/publications", async (request, reply) => {
    const params = objectIdParamsSchema.parse(request.params);
    const payload = createPublicationSchema.parse(request.body);

    const publication = publicationService.createPublication(params.objectId, payload);

    reply.code(201).send({ data: publication });
  });

  app.get("/objects/:objectId/publications", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);
    const query = listPublicationsQuerySchema.parse(request.query);

    return {
      data: publicationService.listByObjectWithFilters(params.objectId, {
        channelId: query.channelId,
        channelStatus: query.channelStatus
      })
    };
  });
}
