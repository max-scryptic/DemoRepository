export type Status = "backlog" | "todo" | "in_progress" | "review" | "done";

export type BoardCard = {
  id: string;
  title: string;
  description: string;
  status: Status;
  position: number;
  labels: string[];
  created_at?: string;
  updated_at?: string;
};

export type CardDraft = {
  title: string;
  description: string;
  labels: string;
};
