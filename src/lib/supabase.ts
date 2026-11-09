
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://deyrcbpbeadsflynlnzj.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_WDLSk1oyw54GCDoRkyFPeg_JYPmygPy";

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Check your .env file."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
