// supabase-config.js
// OJO: en index.html ya cargas el CDN:
// <script src="https://unpkg.com/@supabase/supabase-js@2"></script>

const SUPABASE_URL = "https://lwpdpheoomdszxcjqccy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGRwaGVvb21kc3p4Y2pxY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzkyMTUsImV4cCI6MjA3MjI1NTIxNX0._6oEjUeSY95ZrRIRzmmfAqZw-X1C8-P2mWUEE4d5NcY";

/**
 * Crea el cliente global y lo expone en window
 * para que app.js pueda usar:
 *   const sb = window.supabaseClient;
 */
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);