import { createClient } from "@supabase/supabase-js";
import type { BoardCard } from "@/types/board";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

export const cardsTable = "project_cards";

export type ProjectCardRow = Omit<BoardCard, "created_at" | "updated_at"> & {
  created_at: string;
  updated_at: string;
};
