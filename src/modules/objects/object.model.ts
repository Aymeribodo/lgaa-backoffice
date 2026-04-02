import type { PhotoHttpView } from "../photos/photo.model";

export const WORKFLOW_STATUSES = [
  "BROUILLON",
  "IA_GENERE",
  "A_VERIFIER",
  "PRET",
  "PUBLIE",
  "VENDU",
  "PAYE",
  "PROBLEME",
  "ARCHIVE"
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export interface ObjectEntity {
  objectId: string;
  createdAt: string;
  updatedAt: string;
  stockStatus: string;
  workflowStatus: WorkflowStatus;
  source: string | null;
  noteRapide: string | null;
  typeObjet: string | null;
  titreInterne: string | null;
  descriptionInterne: string | null;
  categorieInterne: string | null;
  etat: string | null;
  prixIA: number | null;
  prixReference: number | null;
  prixFinal: number | null;
  confiance: number | null;
  mainPhotoId: string | null;
  locationCode: string | null;
  metadata: Record<string, unknown>;
}

export interface ObjectListView extends ObjectEntity {
  mainPhotoUrl: string | null;
}

export interface ObjectWithPhotos extends ObjectListView {
  photos: PhotoHttpView[];
}

export interface QuickObjectView {
  objectId: string;
  updatedAt: string;
  workflowStatus: WorkflowStatus;
  noteRapide: string | null;
  etat: string | null;
  typeObjet: string | null;
  mainPhotoId: string | null;
}

export interface ObjectPhotoEntity {
  photoId: string;
  objectId: string;
  position: number;
  originalFilename: string | null;
  storedFilename: string | null;
  relativePath: string | null;
  mimeType: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
