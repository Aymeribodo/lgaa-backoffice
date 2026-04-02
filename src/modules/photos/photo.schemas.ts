import { z } from "zod";

import { PHOTO_FILE_VARIANTS } from "./photo.model";

export const objectIdParamsSchema = z
  .object({
    objectId: z.string().trim().min(1)
  })
  .strict();

export const objectPhotoParamsSchema = z
  .object({
    objectId: z.string().trim().min(1),
    photoId: z.string().trim().min(1)
  })
  .strict();

export const setMainPhotoSchema = z
  .object({
    photoId: z.string().trim().min(1)
  })
  .strict();

export const reorderPhotosSchema = z
  .object({
    photoIds: z.array(z.string().trim().min(1)).min(1)
  })
  .strict()
  .refine(
    (value) => new Set(value.photoIds).size === value.photoIds.length,
    {
      message: "La liste photoIds ne doit pas contenir de doublons",
      path: ["photoIds"]
    }
  );

export const photoFileQuerySchema = z
  .object({
    variant: z.enum(PHOTO_FILE_VARIANTS).default("original")
  })
  .strict();

export type SetMainPhotoInput = z.infer<typeof setMainPhotoSchema>;
export type ReorderPhotosInput = z.infer<typeof reorderPhotosSchema>;
