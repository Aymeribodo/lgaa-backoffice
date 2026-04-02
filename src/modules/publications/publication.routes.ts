import { FastifyInstance } from "fastify";

import {
  listPublicationsQuerySchema,
  publicationIdParamsSchema,
  updatePublicationSchema
} from "./publication.schemas";
import { PublicationService } from "./publication.service";

export function registerPublicationRoutes(
  app: FastifyInstance,
  publicationService: PublicationService
): void {
  app.get("/publications", async (request) => {
    const query = listPublicationsQuerySchema.parse(request.query);

    return {
      data: publicationService.listPublications(query)
    };
  });

  app.get("/publications/:publicationId", async (request) => {
    const params = publicationIdParamsSchema.parse(request.params);

    return {
      data: publicationService.getPublication(params.publicationId)
    };
  });

  app.patch("/publications/:publicationId", async (request) => {
    const params = publicationIdParamsSchema.parse(request.params);
    const payload = updatePublicationSchema.parse(request.body);

    return {
      data: publicationService.updatePublication(params.publicationId, payload)
    };
  });

  app.delete("/publications/:publicationId", async (request) => {
    const params = publicationIdParamsSchema.parse(request.params);

    return {
      data: publicationService.deletePublication(params.publicationId)
    };
  });
}
