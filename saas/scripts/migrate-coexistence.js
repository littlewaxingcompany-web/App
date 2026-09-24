const { query, isConfigured } = require('../lib/db');

/**
 * Migration: pivot salons messaging to the "Coexistence" model + monthly usage
 * tracking.
 *
 * Adds:
 *   - `salons.whatchimp_instance_id` text  — the device/instance id returned
 *     when a salon connects its WhatsApp Business number via WhatChimp's
 *     Coexistence QR-code flow (= WhatChimp `phone_number_id`).
 *   - `salons.messages_sent_month` text    — the "YYYY-MM" billing period the
 *     `messages_sent` counter applies to (enables automatic monthly reset so
 *     the Lite-tier 50-message cap is enforceable per calendar month).
 *   - `salons.messages_sent` integer       — ADD IF NOT EXISTS for fresh DBs
 *     (already present on the live DB).
 *
 * Idempotent (`ADD COLUMN IF NOT EXISTS`); safe to run against an existing DB.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate-coexistence.js
 */
async function migrate() {
  if (!isConfigured()) {
    console.error('DATABASE_URL is not set. Migration skipped.');
    process.exit(1);
  }

  const addColumns = await query(`
    ALTER TABLE public.salons
      ADD COLUMN IF NOT EXISTS whatchimp_instance_id text,
      ADD COLUMN IF NOT EXISTS messages_sent_month text,
      ADD COLUMN IF NOT EXISTS messages_sent integer NOT NULL DEFAULT 0
  `);
  if (addColumns.error) {
    console.error('Failed to add columns:', addColumns.error.message);
    process.exit(1);
  }
  console.log('✓ Added whatchimp_instance_id, messages_sent_month, messages_sent columns.');

  // Preserve any pre-existing counters by attributing them to the current
  // billing month (rows already reset correctly once the month changes).
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const backfill = await query(
    `UPDATE public.salons
        SET messages_sent_month = $1
      WHERE messages_sent_month IS NULL
        AND COALESCE(messages_sent, 0) > 0`,
    [month]
  );
  if (backfill.error) {
    console.error('Warning: failed to backfill messages_sent_month:', backfill.error.message);
  } else {
    console.log(`✓ Backfilled messages_sent_month to ${month} (${backfill.rows.length} rows).`);
  }

  const check = await query(
    `SELECT column_name, data_type, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'salons'
        AND column_name IN ('whatchimp_instance_id', 'messages_sent', 'messages_sent_month')
      ORDER BY column_name`
  );
  console.log('✓ salons messaging columns:', JSON.stringify(check.rows, null, 2));
  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
