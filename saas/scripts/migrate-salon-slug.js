const { query, isConfigured } = require('../lib/db');

/**
 * Migration script: Add 'slug' and 'address' columns to the 'salons' table.
 * The slug will be used for unique inbound email addresses.
 */
async function migrate() {
  if (!isConfigured()) {
    console.error('DATABASE_URL is not set. Migration skipped.');
    process.exit(1);
  }

  console.log('Migrating salons table: adding slug and address columns...');

  // 1. Add slug column (nullable initially)
  const addSlug = await query(`
    ALTER TABLE salons 
    ADD COLUMN IF NOT EXISTS slug text UNIQUE,
    ADD COLUMN IF NOT EXISTS address text;
  `);

  if (addSlug.error) {
    console.error('Failed to add columns:', addSlug.error);
    process.exit(1);
  }

  // 2. Backfill slugs for existing salons using their ID (shortened)
  const { rows } = await query('SELECT id FROM salons WHERE slug IS NULL');
  console.log(`Backfilling slugs for ${rows.length} salons...`);

  for (const row of rows) {
    const shortSlug = row.id.split('-')[0];
    await query('UPDATE salons SET slug = $1 WHERE id = $2', [shortSlug, row.id]);
  }

  // 3. Make slug NOT NULL
  // await query('ALTER TABLE salons ALTER COLUMN slug SET NOT NULL');

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
