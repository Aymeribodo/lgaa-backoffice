import { AppEnv } from "../../config/env";

import {
  AiProviderRequest,
  AiProviderResult,
  AiSuggestion
} from "./ai.model";
import {
  AiInvalidOutputError,
  AiNotConfiguredError,
  AiProviderError,
  AiRefusalError
} from "./ai.errors";
import { aiSuggestionJsonSchema, aiSuggestionSchema } from "./ai.schemas";

const AI_PROMPT_VERSION = "object-ai-v1";

interface ParsedOpenAiResponseBody {
  body: unknown;
  rawText: string;
}

function buildInstructions(): string {
  return [
    "Tu analyses un objet de revente pour un back-office interne.",
    "Tu dois proposer sans jamais inventer.",
    "Regles absolues:",
    "- Utilise uniquement ce qui est visible sur les photos ou explicitement fourni dans le contexte texte.",
    "- Si une information n'est pas confirmable, retourne null pour ce champ et ajoute un element dans elementsIncertains.",
    "- N'invente jamais une marque, une reference, une edition, un accessoire, un fonctionnement, une matiere ou un prix.",
    "- Les hashtags doivent etre strictement justifies par le contenu visible ou le contexte texte fourni.",
    "- Le prix suggere doit etre un entier en centimes ou null si tu n'es pas assez sur.",
    "- Le niveau de confiance doit etre compris entre 0 et 1.",
    "- Si les photos sont insuffisantes, signale-le clairement dans elementsIncertains.",
    "Objectif de sortie:",
    "- titre factuel et vendable, court",
    "- description factuelle et concise",
    "- categorie interne suggeree libre",
    "- etat suggere uniquement si probable",
    "- prix suggere uniquement si defensable",
    "- hashtags suggeres uniquement si fondes"
  ].join("\n");
}

function buildUserContext(request: AiProviderRequest): string {
  const snapshot = request.inputSnapshot;

  return [
    `objectId: ${snapshot.objectId}`,
    `noteRapide: ${snapshot.noteRapide ?? "null"}`,
    `etatFourni: ${snapshot.etat ?? "null"}`,
    `typeObjetFourni: ${snapshot.typeObjet ?? "null"}`,
    `mainPhotoId: ${snapshot.mainPhotoId ?? "null"}`,
    `nombrePhotosTotal: ${snapshot.totalPhotoCount}`,
    `nombrePhotosEnvoyees: ${snapshot.selectedPhotoCount}`,
    "Consignes:",
    "- Retourne une sortie strictement conforme au schema JSON.",
    "- Si tu doutes, reduis la confiance et renseigne elementsIncertains.",
    "- Si un champ ne peut pas etre determine, utilise null."
  ].join("\n");
}

function parseOpenAiResponseBody(responseText: string): ParsedOpenAiResponseBody {
  if (!responseText.trim()) {
    return {
      body: {},
      rawText: ""
    };
  }

  try {
    return {
      body: JSON.parse(responseText),
      rawText: responseText
    };
  } catch {
    return {
      body: {},
      rawText: responseText
    };
  }
}

function extractTextOutput(responseBody: unknown): { text: string; providerResponseId: string | null } {
  const body = responseBody as {
    id?: string;
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
        refusal?: string;
      }>;
    }>;
    error?: {
      message?: string;
    };
  };

  if (body.error?.message) {
    throw new AiProviderError(body.error.message);
  }

  const chunks: string[] = [];

  for (const item of body.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const contentItem of item.content ?? []) {
      if (contentItem.type === "refusal") {
        throw new AiRefusalError(
          contentItem.refusal ?? "Le modele a refuse la generation"
        );
      }

      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        chunks.push(contentItem.text);
      }
    }
  }

  const text = chunks.join("").trim();

  if (!text) {
    throw new AiInvalidOutputError("La reponse IA ne contient aucun JSON exploitable");
  }

  return {
    text,
    providerResponseId: typeof body.id === "string" ? body.id : null
  };
}

export interface ObjectGenerationProvider {
  readonly providerName: string;
  readonly modelName: string;
  readonly promptVersion: string;
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
}

export class OpenAiObjectGenerationProvider implements ObjectGenerationProvider {
  readonly providerName = "openai";
  readonly promptVersion = AI_PROMPT_VERSION;

  constructor(private readonly env: AppEnv) {}

  get modelName(): string {
    return this.env.OPENAI_MODEL;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    if (!this.env.OPENAI_API_KEY) {
      throw new AiNotConfiguredError();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.env.OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.env.OPENAI_BASE_URL}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.env.OPENAI_API_KEY}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.env.OPENAI_MODEL,
          instructions: buildInstructions(),
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildUserContext(request)
                },
                ...request.images.map((image) => ({
                  type: "input_image",
                  image_url: `data:${image.mimeType};base64,${image.base64Data}`
                }))
              ]
            }
          ],
          max_output_tokens: 1200,
          text: {
            format: {
              type: "json_schema",
              name: "object_ai_generation",
              strict: true,
              schema: aiSuggestionJsonSchema
            }
          }
        })
      });

      const responseText = await response.text();
      const parsedResponse = parseOpenAiResponseBody(responseText);
      const responseBody = parsedResponse.body;

      if (!response.ok) {
        const message =
          (responseBody as { error?: { message?: string } }).error?.message ??
          (parsedResponse.rawText ||
            `Echec de la generation IA OpenAI (${response.status})`);

        throw new AiProviderError(message);
      }

      const extracted = extractTextOutput(responseBody);
      const parsed = aiSuggestionSchema.parse(JSON.parse(extracted.text));

      return {
        suggestion: parsed,
        providerResponseId: extracted.providerResponseId
      };
    } catch (error) {
      if (error instanceof AiProviderError || error instanceof AiRefusalError || error instanceof AiInvalidOutputError || error instanceof AiNotConfiguredError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AiProviderError("Le service IA a depasse le temps maximal autorise");
      }

      if (error instanceof SyntaxError) {
        throw new AiInvalidOutputError("La reponse IA n'est pas un JSON valide");
      }

      throw new AiProviderError(
        error instanceof Error ? error.message : "Erreur inconnue du service IA"
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
