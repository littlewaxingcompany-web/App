import { isConfigured, query } from '../../lib/db';

/**
 * GET /api/salons?user_id=... — list salons belonging to an owner.
 * Used by the dashboard to decide whether to send a user into onboarding.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isConfigured()) {
    return res.status(503).json({ error: 'DATABASE_URL is not configured' });
  }

  const userId = (req.query.user_id || '').toString().trim();
  if (!userId) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  const { rows, error } = await query(
    `SELECT id, name, slug, address, created_at
       FROM salons
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 20`,
    [userId]
  );
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ salons: rows });
}
