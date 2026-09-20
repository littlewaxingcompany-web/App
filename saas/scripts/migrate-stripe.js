/**
 * Add Stripe billing columns to the `users` table.
 *
 * Idempotent (uses `ADD COLUMN IF NOT EXISTS`), so it is safe to run against
 * an existing database that was initialised from an earlier schema.sql.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate-stripe.js
 */
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 3,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(
      `ALTER TABLE public.users
         ADD COLUMN IF NOT EXISTS stripe_customer_id text,
         ADD COLUMN IF NOT EXISTS stripe_subscription_id text`
    );
    console.log('✓ Added Stripe billing columns (if missing).');

    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name LIKE 'stripe_%'
        ORDER BY column_name`
    );
    console.log('✓ users columns now include:', rows.map((r) => r.column_name).join(', '));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error('UNEXPECTED ERROR:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
