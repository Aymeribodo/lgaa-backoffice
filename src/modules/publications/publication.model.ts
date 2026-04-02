export interface PublicationEntity {
  publicationId: string;
  objectId: string;
  channelId: string;
  channelListingId: string | null;
  channelStatus: string;
  titrePublie: string | null;
  descriptionPubliee: string | null;
  categorieCanal: string | null;
  prixPublie: number | null;
  hashtagsPublies: string[];
  externalUrl: string | null;
  publishedAt: string | null;
  soldAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

