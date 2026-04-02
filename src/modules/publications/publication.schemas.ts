import { z } from "zod";

const shortText = z.string().trim().min(1).max(255);
const longText = z.string().trim().min(1).max(5000);
const money = z.number().int().nonnegative();
const isoDateTime = z.string().datetime({ offset: true });
const metadataSchema = z.record(z.string(), z.unknown());

export const createPublicationSchema = z
  .object({
    channelId: z.string().trim().min(1).max(50),
    channelStatus: z.string().trim().min(1).max(50),
    channelListingId: z.string().trim().min(1).max(100).nullish(),
    titrePublie: shortText.nullish(),
    descriptionPubliee: longText.nullish(),
    categorieCanal: shortText.nullish(),
    prixPublie: money.nullish(),
    hashtagsPublies: z.array(z.string().trim().min(1).max(50)).default([]),
    externalUrl: z.string().trim().url().nullish(),
    publishedAt: isoDateTime.nullish(),
    soldAt: isoDateTime.nullish(),
    metadata: metadataSchema.default({})
  })
  .strict();

export const updatePublicationSchema = z
  .object({
    channelStatus: z.string().trim().min(1).max(50).optional(),
    channelListingId: z.string().trim().min(1).max(100).nullish(),
    titrePublie: shortText.nullish(),
    descriptionPubliee: longText.nullish(),
    categorieCanal: shortText.nullish(),
    prixPublie: money.nullish(),
    hashtagsPublies: z.array(z.string().trim().min(1).max(50)).optional(),
    externalUrl: z.string().trim().url().nullish(),
    publishedAt: isoDateTime.nullish(),
    soldAt: isoDateTime.nullish(),
    metadata: metadataSchema.optional()
  })
  .strict();

export const publicationIdParamsSchema = z
  .object({
    publicationId: z.string().trim().min(1)
  })
  .strict();

export const listPublicationsQuerySchema = z
  .object({
    objectId: z.string().trim().min(1).optional(),
    channelId: z.string().trim().min(1).max(50).optional(),
    channelStatus: z.string().trim().min(1).max(50).optional()
  })
  .strict();

export type CreatePublicationInput = z.infer<typeof createPublicationSchema>;
export type UpdatePublicationInput = z.infer<typeof updatePublicationSchema>;
export type ListPublicationsQuery = z.infer<typeof listPublicationsQuerySchema>;
