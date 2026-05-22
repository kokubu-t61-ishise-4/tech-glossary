import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase credentials not configured");
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export type FollowUp = {
  question: string;
  answer: string;
};

export type Term = {
  id: string;
  term: string;
  definition: string;
  category: string | null;
  examples: string[] | null;
  analogy: string | null;
  usage_scenarios: string[] | null;
  follow_ups: FollowUp[];
  created_at: string;
};
