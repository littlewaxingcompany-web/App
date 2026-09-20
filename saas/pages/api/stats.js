import { isConfigured, query } from '../../lib/db';

/**
 * GET /api/stats?salon_id=... — aggregated dashboard metrics for a salon.
 *
 * Returns booking count, outbound message counts, and a derived success rate.
 * Success rate = sent / (sent + failed) * 100; `null` when nothing has been
 * attempted yet so the UI can render an "—" placeholder.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isConfigured()) {
    return res.status(503).json({ error: 'DATABASE_URL is not configured' });
  }

  const salonId = (req.query.salon_id || '').toString().trim();
  if (!salonId) {
    return res.status(400).json({ error: 'salon_id is required' });
  }

  const { rows, error } = await query(
    `SELECT
       (SELECT COUNT(*) FROM bookings WHERE salon_id = $1)::int  AS total_bookings,
       (SELECT COUNT(*) FROM logs     WHERE salon_id = $1 AND status = 'sent')::int   AS messages_sent,
       (SELECT COUNT(*) FROM logs     WHERE salon_id = $1 AND status = 'failed')::int AS messages_failed,
       (SELECT COUNT(*) FROM logs     WHERE salon_id = $1)::int AS total_logs,
       (SELECT MAX(created_at) FROM bookings WHERE salon_id = $1) AS last_booking_at,
       (SELECT MAX(created_at) FROM logs     WHERE salon_id = $1) AS last_log_at`,
    [salonId]
  );

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const r = rows[0] || {
    total_bookings: 0,
    messages_sent: 0,
    messages_failed: 0,
    total_logs: 0,
    last_booking_at: null,
    last_log_at: null,
  };

  const totalBookings = Number(r.total_bookings) || 0;
  const messagesSent = Number(r.messages_sent) || 0;
  const messagesFailed = Number(r.messages_failed) || 0;
  const attempted = messagesSent + messagesFailed;
  const successRate = attempted > 0 ? Math.round((messagesSent / attempted) * 1000) / 10 : null;

  // Most recent data seen for this salon (drives the "Automation Inbox" live status).
  let lastActivityAt = null;
  if (r.last_booking_at) lastActivityAt = new Date(r.last_booking_at).getTime();
  if (r.last_log_at) {
    const t = new Date(r.last_log_at).getTime();
    if (lastActivityAt === null || t > lastActivityAt) lastActivityAt = t;
  }

  return res.status(200).json({
    stats: {
      totalBookings,
      messagesSent,
      messagesFailed,
      totalLogs: Number(r.total_logs) || 0,
      successRate,
      lastBookingAt: r.last_booking_at ? new Date(r.last_booking_at).toISOString() : null,
      lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
    },
  });
}
