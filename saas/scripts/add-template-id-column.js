const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB. Adding whatchimp_template_id column...');
    await client.query('ALTER TABLE salons ADD COLUMN IF NOT EXISTS whatchimp_template_id text;');
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
