/**
 * POST /api/inbound-email — Inbound Email webhook (Postmark / Mailgun).
 *
 * This replaces the IMAP polling approach from the standalone bridge: the
 * email provider pushes booking emails to this endpoint, we parse them with
 * the shared EmailParser, persist a booking, and send the WhatsApp message.
 *
 * Body shape depends on `provider`:
 *   - Postmark: full inbound JSON (Subject, FromFull, TextBody, ...)
 *   - Mailgun:  form-encoded (subject, from, stripped-text, ...)
 *   - generic:  { subject, from, text, html }
 *
 * The salon is resolved by the sender address via a query param or header so
 * we know which tenant (and which WhatChimp config) to use.
 */

import { normalizeInboundEmail } from '../../lib/inbound-email';
import { processBookingEmail } from '../../lib/booking-service';
import { getSupabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const provider = (req.query.provider || req.headers['x-email-provider'] || 'generic').toString();
  const body = req.body || {};
  const email = normalizeInboundEmail(provider, body);

  // Resolve the salon. In production this should be keyed off the inbound
  // mailbox/route (each salon gets its own forwarding address). For the
  // scaffold we accept an explicit salon_id or look up by filter sender.
  const salonId = (req.query.salon_id || req.headers['x-salon-id'] || '').toString();
  const db = getSupabaseAdmin();

  let salon = null;
  if (db && salonId) {
    const { data } = await db.from('salons').select('*').eq('id', salonId).single();
    salon = data;
  } else if (db) {
    // Fallback: match the first salon whose filter sender matches this email's
    // from address. (Scaffold convenience — replace with route-specific lookup.)
    const sender = (email.from || '').toLowerCase();
    const { data } = await db
      .from('salons')
      .select('*')
      .eq('email_filter_sender', sender)
      .limit(1);
    salon = data && data.length ? data[0] : null;
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
