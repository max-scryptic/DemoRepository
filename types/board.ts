export type Status = "backlog" | "todo" | "in_progress" | "review" | "done";

export type BoardCard = {
  id: string;
  user_id?: string;
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

export type UserProfile = {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
};
