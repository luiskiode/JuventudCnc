// Cargar cliente desde CDN en index.html como módulo
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(
  "https://TU_SUPABASE_PROJECT_ID.supabase.co", // SUPABASE_URL
  "TU_SUPABASE_ANON_KEY"                         // SUPABASE_ANON_KEY
);