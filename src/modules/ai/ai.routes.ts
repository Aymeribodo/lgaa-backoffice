import { FastifyInstance } from "fastify";

import { objectIdParamsSchema } from "../objects/object.schemas";

import { aiGenerationIdParamsSchema } from "./ai.schemas";
import { AiService } from "./ai.service";

export function registerAiRoutes(
  app: FastifyInstance,
  aiService: AiService
): void {
  app.get("/objects/:objectId/ai-generations", async (request) => {
    const params = objectIdParamsSchema.parse(request.params);

    return {
      data: aiService.listForObject(params.objectId)
    };
  });

  app.post("/objects/:objectId/ai-generations", async (request, reply) => {
    const params = objectIdParamsSchema.parse(request.params);
    const generation = await aiService.generate(params.objectId);

    reply.code(201).send({ data: generation });
  });

  app.post("/objects/:objectId/ai-generations/retry", async (request, reply) => {
    const params = objectIdParamsSchema.parse(request.params);
    const generation = await aiService.retry(params.objectId);

    reply.code(201).send({ data: generation });
  });

  app.post("/objects/:objectId/ai-generations/:generationId/apply", async (request) => {
    const params = aiGenerationIdParamsSchema.parse(request.params);

    return {
      data: aiService.applyGeneration(params.objectId, params.generationId)
    };
  });
}
