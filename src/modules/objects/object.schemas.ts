import { z } from "zod";

import { WORKFLOW_STATUSES } from "./object.model";

const shortText = z.string().trim().min(1).max(255);
const longText = z.string().trim().min(1).max(5000);
const quickNoteText = z.string().trim().min(1).max(500);
const money = z.number().int().nonnegative();
const metadataSchema = z.record(z.string(), z.unknown());

export const createObjectSchema = z
  .object({
    stockStatus: z.string().trim().min(1).max(50).default("IN_STOCK"),
    workflowStatus: z.enum(WORKFLOW_STATUSES).default("BROUILLON"),
    source: z.string().trim().min(1).max(100).nullish(),
    noteRapide: quickNoteText.nullish(),
    typeObjet: shortText.nullish(),
    titreInterne: shortText.nullish(),
    descriptionInterne: longText.nullish(),
    categorieInterne: shortText.nullish(),
    etat: shortText.nullish(),
    prixIA: money.nullish(),
    prixReference: money.nullish(),
    prixFinal: money.nullish(),
    confiance: z.number().min(0).max(1).nullish(),
    mainPhotoId: shortText.nullish(),
    locationCode: z.string().trim().min(1).max(100).nullish(),
    metadata: metadataSchema.default({})
  })
  .strict();

export const updateObjectSchema = z
  .object({
    stockStatus: z.string().trim().min(1).max(50).optional(),
    source: z.string().trim().min(1).max(100).nullish(),
    noteRapide: quickNoteText.nullish(),
    typeObjet: shortText.nullish(),
    titreInterne: shortText.nullish(),
    descriptionInterne: longText.nullish(),
    categorieInterne: shortText.nullish(),
    etat: shortText.nullish(),
    prixIA: money.nullish(),
    prixReference: money.nullish(),
    prixFinal: money.nullish(),
    confiance: z.number().min(0).max(1).nullish(),
    mainPhotoId: shortText.nullish(),
    locationCode: z.string().trim().min(1).max(100).nullish(),
    metadata: metadataSchema.optional()
  })
  .strict();

export const changeObjectStatusSchema = z
  .object({
    workflowStatus: z.enum(WORKFLOW_STATUSES),
    note: z.string().trim().min(1).max(500).optional()
  })
  .strict();

export const listObjectsQuerySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    noteRapide: z.string().trim().min(1).optional(),
    titreInterne: z.string().trim().min(1).max(255).optional(),
    categorieInterne: z.string().trim().min(1).max(255).optional(),
    typeObjet: z.string().trim().min(1).max(255).optional(),
    channelId: z.string().trim().min(1).max(50).optional(),
    channelStatus: z.string().trim().min(1).max(50).optional(),
    workflowStatus: z.enum(WORKFLOW_STATUSES).optional(),
    stockStatus: z.string().trim().min(1).max(50).optional(),
    auditPreset: z
      .enum(["PROBLEM", "READY_UNPUBLISHED", "SOLD_UNPAID"])
      .optional()
  })
  .strict();

export const quickCreateObjectSchema = z
  .object({
    noteRapide: quickNoteText,
    etat: shortText.nullish(),
    typeObjet: shortText.nullish(),
    source: z.string().trim().min(1).max(100).nullish(),
    locationCode: z.string().trim().min(1).max(100).nullish(),
    metadata: metadataSchema.default({})
  })
  .strict();

export const quickUpdateNoteSchema = z
  .object({
    noteRapide: quickNoteText,
    etat: shortText.nullish(),
    typeObjet: shortText.nullish()
  })
  .strict();

export const quickSearchObjectsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255),
    limit: z.coerce.number().int().positive().max(50).default(20)
  })
  .strict();

export const objectIdParamsSchema = z
  .object({
    objectId: z.string().trim().min(1)
  })
  .strict();

export type CreateObjectInput = z.infer<typeof createObjectSchema>;
export type UpdateObjectInput = z.infer<typeof updateObjectSchema>;
export type ChangeObjectStatusInput = z.infer<typeof changeObjectStatusSchema>;
export type ListObjectsQuery = z.infer<typeof listObjectsQuerySchema>;
export type QuickCreateObjectInput = z.infer<typeof quickCreateObjectSchema>;
export type QuickUpdateNoteInput = z.infer<typeof quickUpdateNoteSchema>;
export type QuickSearchObjectsQuery = z.infer<typeof quickSearchObjectsQuerySchema>;
