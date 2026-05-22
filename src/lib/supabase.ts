import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
