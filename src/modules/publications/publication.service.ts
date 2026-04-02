import { ConflictError, NotFoundError } from "../../common/errors/app-error";
import { IdService } from "../../common/services/id.service";
import { ChannelRepository } from "../channels/channel.repository";
import { HistoryRepository } from "../history/history.repository";
import { ObjectRepository } from "../objects/object.repository";

import { PublicationEntity } from "./publication.model";
import {
  CreatePublicationInput,
  ListPublicationsQuery,
  UpdatePublicationInput
} from "./publication.schemas";
import { PublicationRepository } from "./publication.repository";

function cleanString(value: string | null | undefined): string | null {
  return value ?? null;
}

function hasChanges(patch: UpdatePublicationInput): boolean {
  return Object.values(patch).some((value) => value !== undefined);
}

function buildPublicationDiff(
  currentPublication: PublicationEntity,
  patch: UpdatePublicationInput
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};

  for (const key of Object.keys(patch) as Array<keyof UpdatePublicationInput>) {
    if (patch[key] === undefined) {
      continue;
    }

    diff[key] = {
      from: currentPublication[key as keyof PublicationEntity],
      to: patch[key]
    };
  }

  return diff;
}

export class PublicationService {
  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly objectRepository: ObjectRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly idService: IdService
  ) {}

  createPublication(
    objectId: string,
    input: CreatePublicationInput
  ): PublicationEntity {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const channel = this.channelRepository.findById(input.channelId);

    if (!channel) {
      throw new NotFoundError(`Canal introuvable: ${input.channelId}`);
    }

    if (!channel.isActive) {
      throw new ConflictError(`Canal inactif: ${input.channelId}`);
    }

    const now = new Date().toISOString();
    const publication: PublicationEntity = {
      publicationId: this.idService.nextPublicationId(channel.channelId, channel.code),
      objectId: object.objectId,
      channelId: input.channelId,
      channelListingId: cleanString(input.channelListingId),
      channelStatus: input.channelStatus,
      titrePublie: cleanString(input.titrePublie),
      descriptionPubliee: cleanString(input.descriptionPubliee),
      categorieCanal: cleanString(input.categorieCanal),
      prixPublie: input.prixPublie ?? null,
      hashtagsPublies: input.hashtagsPublies,
      externalUrl: cleanString(input.externalUrl),
      publishedAt: cleanString(input.publishedAt),
      soldAt: cleanString(input.soldAt),
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now
    };

    this.publicationRepository.create(publication);
    this.historyRepository.append({
      entityType: "PUBLICATION",
      entityId: publication.publicationId,
      rootObjectId: publication.objectId,
      eventType: "PUBLICATION_CREATED",
      sourceType: "MANUAL",
      summary: `Publication creee sur ${channel.name}`,
      payload: {
        objectId: publication.objectId,
        channelId: publication.channelId,
        channelStatus: publication.channelStatus
      },
      createdAt: now
    });

    return publication;
  }

  listByObject(objectId: string): PublicationEntity[] {
    return this.listByObjectWithFilters(objectId, {});
  }

  listByObjectWithFilters(
    objectId: string,
    filters: Pick<ListPublicationsQuery, "channelId" | "channelStatus">
  ): PublicationEntity[] {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    return this.publicationRepository.listByObjectId(objectId, filters);
  }

  listPublications(filters: ListPublicationsQuery): PublicationEntity[] {
    return this.publicationRepository.list(filters);
  }

  getPublication(publicationId: string): PublicationEntity {
    const publication = this.publicationRepository.findById(publicationId);

    if (!publication) {
      throw new NotFoundError(`Publication introuvable: ${publicationId}`);
    }

    return publication;
  }

  updatePublication(
    publicationId: string,
    patch: UpdatePublicationInput
  ): PublicationEntity {
    const currentPublication = this.getPublication(publicationId);

    if (!hasChanges(patch)) {
      return currentPublication;
    }

    const now = new Date().toISOString();
    const diff = buildPublicationDiff(currentPublication, patch);
    const updatedPublication = this.publicationRepository.update(
      publicationId,
      patch,
      now
    );

    if (!updatedPublication) {
      throw new NotFoundError(`Publication introuvable: ${publicationId}`);
    }

    this.historyRepository.append({
      entityType: "PUBLICATION",
      entityId: publicationId,
      rootObjectId: currentPublication.objectId,
      eventType: "PUBLICATION_UPDATED",
      sourceType: "MANUAL",
      summary: `Publication mise a jour (${Object.keys(diff).join(", ")})`,
      payload: {
        changes: diff
      },
      createdAt: now
    });

    return updatedPublication;
  }

  deletePublication(publicationId: string): { publicationId: string; deleted: true } {
    const publication = this.getPublication(publicationId);
    const now = new Date().toISOString();

    this.publicationRepository.deleteById(publicationId);
    this.historyRepository.append({
      entityType: "PUBLICATION",
      entityId: publicationId,
      rootObjectId: publication.objectId,
      eventType: "PUBLICATION_DELETED",
      sourceType: "MANUAL",
      summary: "Publication supprimee",
      payload: {
        objectId: publication.objectId,
        channelId: publication.channelId
      },
      createdAt: now
    });

    return {
      publicationId,
      deleted: true
    };
  }
}
