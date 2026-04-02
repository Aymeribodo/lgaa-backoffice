import multipart from "@fastify/multipart";
import Fastify, { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { AppError } from "./common/errors/app-error";
import { IdService } from "./common/services/id.service";
import { AppEnv } from "./config/env";
import { createDatabase } from "./db/client";
import { OpenAiObjectGenerationProvider } from "./modules/ai/ai.provider";
import { AiGenerationRepository } from "./modules/ai/ai.repository";
import { registerAiRoutes } from "./modules/ai/ai.routes";
import { AiService } from "./modules/ai/ai.service";
import { registerChannelRoutes } from "./modules/channels/channel.routes";
import { ChannelRepository } from "./modules/channels/channel.repository";
import { HistoryRepository } from "./modules/history/history.repository";
import { registerHistoryRoutes } from "./modules/history/history.routes";
import { HistoryService } from "./modules/history/history.service";
import { registerObjectRoutes } from "./modules/objects/object.routes";
import { ObjectRepository } from "./modules/objects/object.repository";
import { ObjectService } from "./modules/objects/object.service";
import { PhotoRepository } from "./modules/photos/photo.repository";
import { registerPhotoRoutes } from "./modules/photos/photo.routes";
import { PhotoService } from "./modules/photos/photo.service";
import { PhotoStorageService } from "./modules/photos/photo.storage";
import { registerPublicationRoutes } from "./modules/publications/publication.routes";
import { PublicationRepository } from "./modules/publications/publication.repository";
import { PublicationService } from "./modules/publications/publication.service";
import { registerUiRoutes } from "./ui/ui.routes";

export function buildApp(env: AppEnv): FastifyInstance {
  const app = Fastify({ logger: true });
  const db = createDatabase(env.DATABASE_PATH);

  const idService = new IdService(db, env.ID_PREFIX);
  const historyRepository = new HistoryRepository(db);
  const aiGenerationRepository = new AiGenerationRepository(db);
  const channelRepository = new ChannelRepository(db);
  const objectRepository = new ObjectRepository(db);
  const photoRepository = new PhotoRepository(db);
  const publicationRepository = new PublicationRepository(db);
  const photoStorageService = new PhotoStorageService(env);
  const aiProvider = new OpenAiObjectGenerationProvider(env);

  const objectService = new ObjectService(
    objectRepository,
    historyRepository,
    idService
  );
  const historyService = new HistoryService(historyRepository, objectRepository);
  const photoService = new PhotoService(
    photoRepository,
    objectRepository,
    historyRepository,
    idService,
    photoStorageService
  );
  const aiService = new AiService(
    aiGenerationRepository,
    objectRepository,
    photoRepository,
    photoStorageService,
    historyRepository,
    aiProvider,
    env.AI_MAX_INPUT_PHOTOS,
    app.log
  );
  const publicationService = new PublicationService(
    publicationRepository,
    objectRepository,
    channelRepository,
    historyRepository,
    idService
  );

  app.register(multipart, {
    limits: {
      files: env.PHOTO_MAX_FILES_PER_UPLOAD,
      fileSize: env.PHOTO_MAX_FILE_SIZE_BYTES
    },
    throwFileSizeLimit: true
  });

  registerObjectRoutes(app, objectService, publicationService, photoService);
  registerHistoryRoutes(app, historyService);
  registerPhotoRoutes(app, photoService);
  registerAiRoutes(app, aiService);
  registerChannelRoutes(app, channelRepository);
  registerPublicationRoutes(app, publicationService);
  registerUiRoutes(app, env.STORAGE_ROOT);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Payload invalide",
        details: error.issues
      });

      return;
    }

    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: error.name,
        message: error.message
      });

      return;
    }

    const sqliteError = error as { code?: string };

    if (sqliteError.code?.startsWith("SQLITE_CONSTRAINT")) {
      reply.status(409).send({
        error: "SQLITE_CONSTRAINT",
        message: "Contrainte metier ou base de donnees violee"
      });

      return;
    }

    if (sqliteError.code === "FST_REQ_FILE_TOO_LARGE") {
      reply.status(413).send({
        error: "FILE_TOO_LARGE",
        message: "Un fichier depasse la taille maximale autorisee"
      });

      return;
    }

    if (sqliteError.code === "FST_FILES_LIMIT") {
      reply.status(400).send({
        error: "FILES_LIMIT",
        message: "Le nombre maximal de fichiers par upload est depasse"
      });

      return;
    }

    request.log.error(error);
    reply.status(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "Erreur interne"
    });
  });

  app.addHook("onClose", async () => {
    db.close();
  });

  return app;
}
