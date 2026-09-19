/**
 * Provider-agnostic Postgres data layer.
 *
 * The SaaS app talks to a single `DATABASE_URL` connection string, which works
 * with Supabase Postgres, Neon, or any other PostgreSQL host — no
 * provider-specific SDK required. This replaces the earlier Supabase-only
 * client so the owner (UK-based, cannot use Tiger Cloud) is free to pick
 * whichever Postgres provider they prefer.
 *
 * Everything initializes lazily and degrades gracefully: if `DATABASE_URL` is
 * missing or `pg` isn't installed, `query()` returns a non-throwing
 * `{ rows: [], error }` result so API routes can respond cleanly instead of
 * crashing.
 */

let pool = null;
let initError = null;

function getPool() {
  if (pool) return pool;
  if (initError) return null;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: url,
      max: 10,
      // Many managed Postgres hosts (Supabase, Neon, etc.) require SSL.
      ssl: /sslmode=require|ssl=true/i.test(url) ? { rejectUnauthorized: false } : undefined,
    });
    pool.on('error', (err) => console.error('[db] Postgres pool error:', err.message));
  } catch (error) {
    initError = error;
    console.error('[db] Failed to initialize Postgres pool:', error.message);
    return null;
  }

  return pool;
}

/**
 * True when a DATABASE_URL is configured (the pool may still be lazy).
 */
function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Run a parameterized query. Never throws on a missing/unreachable DB —
 * returns `{ rows, error }` so callers can decide how to degrade.
 *
 * @param {string} text - SQL with $1, $2, ... placeholders
 * @param {Array} [params]
 * @returns {Promise<{rows: Array, error: Error|null}>}
 */
async function query(text, params = []) {
  const p = getPool();
  if (!p) {
    return { rows: [], error: new Error('DATABASE_URL is not configured') };
  }
  try {
    const result = await p.query(text, params);
    return { rows: result.rows, error: null };
  } catch (error) {
    console.error('[db] Query failed:', error.message);
    return { rows: [], error };
  }
}

module.exports = { getPool, isConfigured, query };
