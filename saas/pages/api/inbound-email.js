/**
 * POST /api/inbound-email — Inbound Email webhook (Postmark / Mailgun).
 *
 * This replaces the IMAP polling approach from the standalone bridge: the
 * email provider pushes booking emails to this endpoint, we parse them with
 * the shared EmailParser, persist a booking (via the provider-agnostic
 * `lib/db.js`), and send the WhatsApp message.
 *
 * Body shape depends on `provider`:
 *   - Postmark: full inbound JSON (Subject, FromFull, TextBody, ...)
 *   - Mailgun:  form-encoded (subject, from, stripped-text, ...)
 *   - generic:  { subject, from, text, html }
 *
 * The salon is resolved by an explicit `salon_id` or by the sender address so
 * we know which tenant (and which WhatChimp config) to use.
 */

import { normalizeInboundEmail } from '../../lib/inbound-email';
import { processBookingEmail } from '../../lib/booking-service';
import { isConfigured, query } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // If the database isn't connected yet, fail gracefully rather than crash.
  if (!isConfigured()) {
    return res.status(503).json({
      status: 'db_not_configured',
      error: 'DATABASE_URL is not set. Connect Supabase/Neon to process bookings.',
    });
  }

  const provider = (req.query.provider || req.headers['x-email-provider'] || 'generic').toString();
  const body = req.body || {};
  const email = normalizeInboundEmail(provider, body);

  // Resolve the salon: explicit salon_id wins, otherwise match by filter sender.
  const salonId = (req.query.salon_id || req.headers['x-salon-id'] || '').toString();

  let salon = null;
  if (salonId) {
    const { rows, error } = await query('SELECT * FROM salons WHERE id = $1 LIMIT 1', [salonId]);
    if (!error && rows.length) salon = rows[0];
  } else {
    const sender = (email.from || '').toLowerCase();
    const { rows, error } = await query(
      'SELECT * FROM salons WHERE lower(email_filter_sender) = $1 LIMIT 1',
      [sender]
    );
    if (!error && rows.length) salon = rows[0];
  }

  if (!salon) {
    return res.status(404).json({
      status: 'no_salon',
      error: 'No salon matched this inbound email. Configure salon_id or email_filter_sender.',
    });
  }

  const result = await processBookingEmail(email, salon);
  return res.status(200).json(result);
}
