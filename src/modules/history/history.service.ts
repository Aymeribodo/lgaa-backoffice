import { ConflictError, NotFoundError } from "../../common/errors/app-error";
import { ObjectRepository } from "../objects/object.repository";
import { updateObjectSchema } from "../objects/object.schemas";
import { WorkflowStatus } from "../objects/object.model";

import { HistoryEventRecord } from "./history.model";
import { HistoryRepository } from "./history.repository";

function isRollbackCandidate(event: HistoryEventRecord): boolean {
  return (
    event.entityType === "OBJECT" &&
    (event.sourceType === "MANUAL" || event.sourceType === "AI") &&
    !!event.rollbackData
  );
}

export class HistoryService {
  constructor(
    private readonly historyRepository: HistoryRepository,
    private readonly objectRepository: ObjectRepository
  ) {}

  listObjectHistory(
    objectId: string,
    scope: "OBJECT_ONLY" | "FULL",
    limit = 200
  ): HistoryEventRecord[] {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    return scope === "FULL"
      ? this.historyRepository.listByRootObjectId(objectId, limit)
      : this.historyRepository.listByEntity("OBJECT", objectId, limit);
  }

  listPublicationHistory(publicationId: string, limit = 100): HistoryEventRecord[] {
    return this.historyRepository.listByEntity("PUBLICATION", publicationId, limit);
  }

  rollbackObjectHistoryEvent(
    objectId: string,
    historyEventId: number
  ): { objectId: string; rolledBackEventId: number; rollbackEventId: number } {
    const object = this.objectRepository.findById(objectId);

    if (!object) {
      throw new NotFoundError(`Objet introuvable: ${objectId}`);
    }

    const targetEvent = this.historyRepository.findById(historyEventId);

    if (!targetEvent || targetEvent.entityType !== "OBJECT" || targetEvent.entityId !== objectId) {
      throw new NotFoundError(`Evenement introuvable: ${historyEventId}`);
    }

    if (!isRollbackCandidate(targetEvent) || !targetEvent.rollbackData) {
      throw new ConflictError("Cet evenement ne peut pas etre rollbacke");
    }

    const latestRollbackCandidate = this.listObjectHistory(objectId, "OBJECT_ONLY", 200).find(
      (event) => isRollbackCandidate(event)
    );

    if (!latestRollbackCandidate || latestRollbackCandidate.id !== historyEventId) {
      throw new ConflictError(
        "Seul le dernier changement rollbackable peut etre annule"
      );
    }

    const now = new Date().toISOString();

    if (targetEvent.rollbackData.kind === "OBJECT_PATCH") {
      const patch = updateObjectSchema.parse(targetEvent.rollbackData.patch ?? {});
      this.objectRepository.update(objectId, patch, now);
    } else if (targetEvent.rollbackData.kind === "OBJECT_WORKFLOW_STATUS") {
      const workflowStatus = targetEvent.rollbackData.workflowStatus as WorkflowStatus | undefined;

      if (!workflowStatus) {
        throw new ConflictError("Rollback de statut invalide");
      }

      this.objectRepository.updateWorkflowStatus(objectId, workflowStatus, now);
    } else {
      throw new ConflictError("Type de rollback non supporte");
    }

    const rollbackEventId = this.historyRepository.append({
      entityType: "OBJECT",
      entityId: objectId,
      rootObjectId: objectId,
      eventType: "OBJECT_ROLLBACK_APPLIED",
      sourceType: "SYSTEM",
      summary: `Rollback applique depuis l'evenement ${historyEventId}`,
      payload: {
        rollbackOfEventId: historyEventId,
        rollbackKind: targetEvent.rollbackData.kind
      },
      createdAt: now
    });

    return {
      objectId,
      rolledBackEventId: historyEventId,
      rollbackEventId
    };
  }
}
