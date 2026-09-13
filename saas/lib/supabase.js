/**
 * Supabase server client (lazy).
 *
 * Uses the service-role key on the server for privileged operations and the
 * anon key for client-side access. Import this only in server contexts
 * (API routes, getServerSideProps). It initializes lazily so the app still
 * builds/tests without credentials present.
 */

let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  const { createClient } = require('@supabase/supabase-js');
  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdmin;
}

module.exports = { getSupabaseAdmin };
