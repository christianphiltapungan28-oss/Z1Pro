export type Journey = {
  id: string;
  title: string;
  description: string | null;
  progress: number;
  sourceConversationId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
