export const AI_GENERATION_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED"
] as const;

export const AI_GENERATION_TRIGGER_TYPES = [
  "MANUAL",
  "RETRY"
] as const;

export type AiGenerationStatus = (typeof AI_GENERATION_STATUSES)[number];
export type AiGenerationTriggerType = (typeof AI_GENERATION_TRIGGER_TYPES)[number];

export interface AiInputPhotoSnapshot {
  photoId: string;
  position: number;
  mimeType: string | null;
  relativePath: string | null;
  isMain: boolean;
}

export interface AiGenerationInputSnapshot {
  objectId: string;
  noteRapide: string | null;
  etat: string | null;
  typeObjet: string | null;
  mainPhotoId: string | null;
  totalPhotoCount: number;
  selectedPhotoCount: number;
  photos: AiInputPhotoSnapshot[];
}

export interface AiUncertainElement {
  champ:
    | "TITRE"
    | "DESCRIPTION"
    | "CATEGORIE"
    | "ETAT"
    | "PRIX"
    | "HASHTAGS"
    | "PHOTOS"
    | "NOTE_RAPIDE"
    | "TYPE_OBJET"
    | "GLOBAL";
  raison: string;
}

export interface AiSuggestion {
  titreSuggere: string | null;
  descriptionSuggeree: string | null;
  categorieSuggeree: string | null;
  etatSuggere: string | null;
  prixSuggere: number | null;
  hashtagsSuggeres: string[];
  confiance: number;
  elementsIncertains: AiUncertainElement[];
}

export interface AiGenerationRecord {
  generationId: number;
  objectId: string;
  triggerType: AiGenerationTriggerType;
  generationStatus: AiGenerationStatus;
  attemptNumber: number;
  provider: string;
  model: string;
  promptVersion: string;
  inputSnapshot: AiGenerationInputSnapshot;
  output: AiSuggestion | null;
  confidence: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  providerResponseId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AiProviderImageInput {
  photoId: string;
  mimeType: string;
  base64Data: string;
}

export interface AiProviderRequest {
  inputSnapshot: AiGenerationInputSnapshot;
  images: AiProviderImageInput[];
}

export interface AiProviderResult {
  suggestion: AiSuggestion;
  providerResponseId: string | null;
}

