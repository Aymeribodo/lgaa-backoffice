export interface ChannelEntity {
  channelId: string;
  code: string;
  name: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

