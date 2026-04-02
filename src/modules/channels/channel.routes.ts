import { FastifyInstance } from "fastify";
import { z } from "zod";

import { ChannelRepository } from "./channel.repository";

const listChannelsQuerySchema = z
  .object({
    activeOnly: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional()
  })
  .strict();

export function registerChannelRoutes(
  app: FastifyInstance,
  channelRepository: ChannelRepository
): void {
  app.get("/channels", async (request) => {
    const query = listChannelsQuerySchema.parse(request.query);

    return {
      data: channelRepository.listAll(query.activeOnly ?? false)
    };
  });
}
