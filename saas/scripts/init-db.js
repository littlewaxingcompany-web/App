/**
 * SalonStream — Database initializer.
 *
 * Verifies connectivity to the `DATABASE_URL` Postgres host, then applies
 * `schema.sql` (multi-tenant schema) and confirms the tables were created.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/init-db.js
 *
 * Idempotent-ish: uses CREATE ... IF NOT EXISTS / OR REPLACE where possible.
 * The enum `create type` statements are wrapped so re-running is safe.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}

// Supabase pooler (and most managed hosts) accept SSL. Never reject self-signed
// managed certs — rejectUnauthorized:false is standard for these providers.
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 3,
  ssl: { rejectUnauthorized: false },
});

const schemaPath = path.join(__dirname, '..', 'schema.sql');

async function main() {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('CONNECTIVITY FAILED:', err.message);
    console.error(
      '  (Check that DATABASE_URL is a full postgres:// URI — the bare\n' +
        '   https://xxx.supabase.co host is NOT a database connection string.)'
    );
    await pool.end();
    process.exit(1);
  }

  // 1. Verify connectivity
  const ver = await client.query(
    "select current_database() as db, current_user as usr, version() as ver"
  );
  const row = ver.rows[0];
  console.log('✓ CONNECTED');
  console.log(`  database : ${row.db}`);
  console.log(`  user     : ${row.usr}`);
  console.log(`  server   : ${String(row.ver).split(' on ')[0]}`);

  // 2. Apply schema
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log(`\nApplying schema.sql (${sql.length} bytes)...`);
  try {
    await client.query(sql);
    console.log('✓ Schema applied.');
  } catch (err) {
    console.error('SCHEMA APPLY FAILED:', err.message);
    // A common cause on re-runs is `create type` without IF NOT EXISTS.
    // Attempt a tolerant re-run below so re-initialization works.
    if (/already exists/i.test(err.message) && /type/i.test(err.message)) {
      console.error('  → Detected pre-existing enum. Trying idempotent re-apply...');
      await applyIdempotent(client, sql);
    } else {
      await client.release();
      await pool.end();
      process.exit(1);
    }
  }

  // 3. Confirm tables
  const tables = await client.query(
    `select tablename from pg_tables
     where schemaname = 'public'
     order by tablename`
  );
  console.log('\n✓ Tables in public schema:');
  for (const t of tables.rows) console.log(`  - ${t.tablename}`);

  client.release();
  await pool.end();
  console.log('\nDONE — database is initialized.');
}

/** Re-apply the schema after stripping the non-idempotent `create type` lines. */
async function applyIdempotent(client, sql) {
  const cleaned = sql
    .split('\n')
    .filter((line) => !/^\s*create type\s/i.test(line))
    .join('\n');
  await client.query(cleaned);
  console.log('✓ Schema applied (idempotent re-run).');
}

main().catch(async (err) => {
  console.error('UNEXPECTED ERROR:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
