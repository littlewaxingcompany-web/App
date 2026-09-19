const { Pool } = require('pg');
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const enums = await p.query(
    "select typname from pg_type where typtype = 'e' order by typname"
  );
  console.log('Enums:', enums.rows.map((r) => r.typname).join(', '));

  const trig = await p.query(
    "select tgname from pg_trigger where tgname like '%_set_updated_at' order by tgname"
  );
  console.log('Triggers:', trig.rows.map((r) => r.tgname).join(', '));

  // Multi-tenant smoke test (rolled back — leaves no data).
  const c = await p.connect();
  await c.query('begin');
  const ins = await c.query(
    'insert into public.users (email, full_name, plan) values ($1,$2,$3) returning id',
    ['smoke@example.com', 'Smoke Test', 'lite']
  );
  const got = await c.query(
    'select email, plan from public.users where id=$1',
    [ins.rows[0].id]
  );
  console.log('Smoke test user:', JSON.stringify(got.rows[0]));
  await c.query('rollback');
  console.log('ROLLED BACK — no test data left behind.');
  c.release();
  await p.end();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
