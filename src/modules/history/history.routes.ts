import { FastifyInstance } from "fastify";
import { z } from "zod";

import { objectIdParamsSchema } from "../objects/object.schemas";
import { publicationIdParamsSchema } from "../publications/publication.schemas";

import { HistoryService } from "./history.service";

const objectHistoryQuerySchema = z
  .object({
    scope: z.enum(["OBJECT_ONLY", "FULL"]).default("FULL"),
    limit: z.coerce.number().int().positive().max(500).default(200)
  })
  .strict();

const publicationHistoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().max(500).default(100)
  })
  .strict();

const historyEventParamsSchema = z
  .object({
    objectId: z.string().trim().min(1),
    historyEventId: z.coerce.number().int().positive()
  })
  .strict();

export function registerHistoryRoutes(
  app: FastifyInstance,
  historyService: HistoryService
): void {
  app.get("/objects/:objectId/history", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);
    const query = objectHistoryQuerySchema.parse(request.query);

    return {
      data: historyService.listObjectHistory(params.objectId, query.scope, query.limit)
    };
  });

  app.post("/objects/:objectId/history/:historyEventId/rollback", async (request) => {
    const params = historyEventParamsSchema.parse(request.params);

    return {
      data: historyService.rollbackObjectHistoryEvent(
        params.objectId,
        params.historyEventId
      )
    };
  });

  app.get("/publications/:publicationId/history", async (request) => {
    const params = publicationIdParamsSchema.parse(request.params);
    const query = publicationHistoryQuerySchema.parse(request.query);

    return {
      data: historyService.listPublicationHistory(params.publicationId, query.limit)
    };
  });
}
