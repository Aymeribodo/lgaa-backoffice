export const HISTORY_SOURCE_TYPES = ["MANUAL", "AI", "SYSTEM"] as const;

export type HistorySourceType = (typeof HISTORY_SOURCE_TYPES)[number];

export interface HistoryRollbackData {
  kind: "OBJECT_PATCH" | "OBJECT_WORKFLOW_STATUS";
  patch?: Record<string, unknown>;
  workflowStatus?: string;
}

export interface HistoryEventInput {
  entityType: "OBJECT" | "PUBLICATION";
  entityId: string;
  rootObjectId?: string | null;
  eventType: string;
  sourceType?: HistorySourceType;
  summary?: string | null;
  payload: Record<string, unknown>;
  rollbackData?: HistoryRollbackData | null;
  createdAt?: string;
}

export interface HistoryEventRecord {
  id: number;
  entityType: "OBJECT" | "PUBLICATION";
  entityId: string;
  rootObjectId: string | null;
  eventType: string;
  sourceType: HistorySourceType;
  summary: string | null;
  payload: Record<string, unknown>;
  rollbackData: HistoryRollbackData | null;
  createdAt: string;
}
