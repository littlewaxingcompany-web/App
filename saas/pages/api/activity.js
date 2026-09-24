import { isConfigured, query } from '../../lib/db';

/**
 * GET /api/activity?salon_id=... — recent activity feed for a salon.
 *
 * Merges the latest bookings (new bookings captured) with the latest message
 * logs (WhatsApp sends/failures) into a single chronological feed, newest
 * first, capped at 10 items.
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

  const [bookingsRes, logsRes] = await Promise.all([
    query(
      `SELECT id, client_name, service, date_appointment, time_appointment, status, created_at
         FROM bookings
        WHERE salon_id = $1
        ORDER BY created_at DESC
        LIMIT 10`,
      [salonId]
    ),
    query(
      `SELECT l.id, l.event, l.status, b.client_name, b.service,
              l.payload->>'error' AS error_detail, l.created_at
         FROM logs l
         LEFT JOIN bookings b ON b.id = l.booking_id
        WHERE l.salon_id = $1
        ORDER BY l.created_at DESC
        LIMIT 10`,
      [salonId]
    ),
  ]);

  if (bookingsRes.error) return res.status(500).json({ error: bookingsRes.error.message });
  if (logsRes.error) return res.status(500).json({ error: logsRes.error.message });

  const feed = [];

  for (const b of bookingsRes.rows || []) {
    feed.push({
      id: `booking:${b.id}`,
      type: 'booking',
      status: b.status,
      title: `New booking — ${b.client_name || 'Unnamed client'}`,
      detail: [b.service, [b.date_appointment, b.time_appointment].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(' · '),
      created_at: b.created_at,
    });
  }

  for (const l of logsRes.rows || []) {
    let type;
    let title;
    if (l.event === 'message_failed' || l.status === 'failed') {
      type = 'message_failed';
      title = 'Message failed';
    } else if (l.status === 'pending') {
      type = 'message_pending';
      title = 'Message queued';
    } else {
      type = 'message_sent';
      title = 'WhatsApp message sent';
    }

    const detailParts = [];
    if (l.client_name) detailParts.push(`to ${l.client_name}`);
    if (type === 'message_failed' && l.error_detail) detailParts.push(l.error_detail);

    feed.push({
      id: `log:${l.id}`,
      type,
      status: l.status,
      title,
      detail: detailParts.join(' — '),
      created_at: l.created_at,
    });
  }

  feed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return res.status(200).json({ activity: feed.slice(0, 10) });
}
