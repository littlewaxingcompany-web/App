/**
 * GET /api/bookings?salon_id=... — list bookings for a salon.
 *
 * Uses the provider-agnostic `lib/db.js`. Returns a clean 503 when the
 * database isn't configured so the UI can surface a friendly message instead
 * of erroring out.
 */

import { isConfigured, query } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return res.status(503).json({ error: 'DATABASE_URL is not configured' });
  }

  const salonId = (req.query.salon_id || '').toString();

  const text = salonId
    ? 'SELECT * FROM bookings WHERE salon_id = $1 ORDER BY created_at DESC LIMIT 100'
    : 'SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100';
  const params = salonId ? [salonId] : [];

  const { rows, error } = await query(text, params);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ bookings: rows });
}
