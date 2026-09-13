/**
 * GET /api/bookings?salon_id=... — list bookings for a salon.
 *
 * Uses the Supabase service-role client. In production this should be gated
 * by the authenticated user's ownership (Supabase RLS handles this when using
 * the user's own JWT instead of the service key).
 */

import { getSupabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const salonId = (req.query.salon_id || '').toString();
  const db = getSupabaseAdmin();

  if (!db) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  let query = db.from('bookings').select('*').order('created_at', { ascending: false });
  if (salonId) query = query.eq('salon_id', salonId);

  const { data, error } = await query.limit(100);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ bookings: data });
}
