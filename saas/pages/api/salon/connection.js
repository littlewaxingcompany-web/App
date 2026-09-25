import { isConfigured, query } from '../../../lib/db';

const MAX_CONNECTION_ID_LENGTH = 64;

/**
 * POST   /api/salon/connection  — save or replace the salon's WhatsApp Connection ID.
 * DELETE /api/salon/connection  — disconnect (clear) the salon's Connection ID.
 *
 * Ownership boundary: the salon is resolved exclusively from the owner identity
 * (`user_id`), never from a client-supplied `salon_id`. We look up the owner's
 * salon server-side and update only that row, so a client cannot read or write
 * another salon's connection by supplying a different salon id.
 *
 * NOTE on auth: this app has no server-side session yet — the owner identity is
 * the `salonstream.userId` value the dashboard already sends to /api/salons as
 * `user_id`. This route reuses that same identity; it does not introduce a new
 * auth model.
 */
export default async function handler(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'DATABASE_URL is not configured' });
  }

  const body = req.body || {};
  const userId = String(body.user_id || req.query.user_id || '').trim();

  if (req.method === 'POST') {
    const raw = body.connection_id != null ? String(body.connection_id) : '';
    const connectionId = raw.trim();

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    if (!connectionId) {
      return res.status(400).json({ error: 'connection_id is required' });
    }
    if (connectionId.length > MAX_CONNECTION_ID_LENGTH) {
      return res.status(400).json({
        error: `connection_id is too long (max ${MAX_CONNECTION_ID_LENGTH} characters)`,
      });
    }

    return updateConnection(res, userId, connectionId);
  }

  if (req.method === 'DELETE') {
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    return updateConnection(res, userId, null);
  }

  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Resolve the salon from the owner identity and set its connection id.
 * `connectionId` may be `null` to disconnect.
 */
async function updateConnection(res, userId, connectionId) {
  // Resolve the salon id server-side from the owner identity — never from a
  // client-supplied salon id. This is the multi-tenant ownership boundary.
  const { rows, error } = await query(
    `SELECT id
       FROM salons
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 1`,
    [userId]
  );

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (rows.length === 0) {
    return res.status(404).json({ error: 'No salon found for this account.' });
  }

  const salonId = rows[0].id;
  const update = await query(
    `UPDATE salons SET whatchimp_instance_id = $1 WHERE id = $2`,
    [connectionId, salonId]
  );

  if (update.error) {
    return res.status(500).json({ error: update.error.message });
  }

  return res.status(200).json({
    ok: true,
    connected: Boolean(connectionId),
    last4: connectionId ? connectionId.slice(-4) : null,
  });
}
