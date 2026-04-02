import { z } from "zod";

const aiUncertainElementSchema = z
  .object({
    champ: z.enum([
      "TITRE",
      "DESCRIPTION",
      "CATEGORIE",
      "ETAT",
      "PRIX",
      "HASHTAGS",
      "PHOTOS",
      "NOTE_RAPIDE",
      "TYPE_OBJET",
      "GLOBAL"
    ]),
    raison: z.string().trim().min(1).max(500)
  })
  .strict();

export const aiSuggestionSchema = z
  .object({
    titreSuggere: z.string().trim().min(1).max(180).nullable(),
    descriptionSuggeree: z.string().trim().min(1).max(3000).nullable(),
    categorieSuggeree: z.string().trim().min(1).max(255).nullable(),
    etatSuggere: z.string().trim().min(1).max(255).nullable(),
    prixSuggere: z.number().int().nonnegative().nullable(),
    hashtagsSuggeres: z.array(z.string().trim().min(1).max(50)).max(20),
    confiance: z.number().min(0).max(1),
    elementsIncertains: z.array(aiUncertainElementSchema).max(20)
  })
  .strict();

export const objectAiParamsSchema = z
  .object({
    objectId: z.string().trim().min(1)
  })
  .strict();

export const aiGenerationIdParamsSchema = z
  .object({
    objectId: z.string().trim().min(1),
    generationId: z.coerce.number().int().positive()
  })
  .strict();

export type AiSuggestionInput = z.infer<typeof aiSuggestionSchema>;

export const aiSuggestionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    titreSuggere: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 180 },
        { type: "null" }
      ]
    },
    descriptionSuggeree: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 3000 },
        { type: "null" }
      ]
    },
    categorieSuggeree: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 255 },
        { type: "null" }
      ]
    },
    etatSuggere: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 255 },
        { type: "null" }
      ]
    },
    prixSuggere: {
      anyOf: [
        { type: "integer", minimum: 0 },
        { type: "null" }
      ]
    },
    hashtagsSuggeres: {
      type: "array",
      items: {
        type: "string",
        minLength: 1,
        maxLength: 50
      },
      maxItems: 20
    },
    confiance: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    elementsIncertains: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          champ: {
            type: "string",
            enum: [
              "TITRE",
              "DESCRIPTION",
              "CATEGORIE",
              "ETAT",
              "PRIX",
              "HASHTAGS",
              "PHOTOS",
              "NOTE_RAPIDE",
              "TYPE_OBJET",
              "GLOBAL"
            ]
          },
          raison: {
            type: "string",
            minLength: 1,
            maxLength: 500
          }
        },
        required: ["champ", "raison"]
      }
    }
  },
  required: [
    "titreSuggere",
    "descriptionSuggeree",
    "categorieSuggeree",
    "etatSuggere",
    "prixSuggere",
    "hashtagsSuggeres",
    "confiance",
    "elementsIncertains"
  ]
} as const;

