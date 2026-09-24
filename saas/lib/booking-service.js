/**
 * Booking Service
 *
 * Orchestrates the inbound-booking pipeline used by the SaaS backend:
 *
 *   inbound email -> EmailParser -> (filter) -> persist booking -> send WhatsApp
 *                                                       -> log the outcome
 *
 * Persistence goes through the provider-agnostic `lib/db.js` (single
 * `DATABASE_URL`), so it works on Supabase Postgres, Neon, or any Postgres.
 * Every DB write is best-effort and degrades gracefully when the database is
 * not yet connected.
 *
 * Messaging uses the "Coexistence" model: each salon connects its own WhatsApp
 * Business number (via QR code) and messages are sent through that salon's
 * WhatChimp device/instance id (`salons.whatchimp_instance_id`) using the
 * shared platform `WHATCHIMP_API_TOKEN`.
 */

const EmailParser = require('./email-parser');
const WhatChimpClient = require('./whatchimp-client');
const { query } = require('./db');

const parser = new EmailParser();

/** Lite tier monthly message cap (Pro / Agency are unlimited). */
const LITE_MESSAGE_LIMIT = 50;

/**
 * Process a normalized inbound email for a given salon.
 *
 * @param {Object} emailData - { subject, from, text, html, date, provider }
 * @param {Object} salon - Salon row (whatchimp_instance_id + optional overrides)
 * @returns {Promise<Object>} { status, appointment?, booking?, message? }
 */
async function processBookingEmail(emailData, salon) {
  // 1. Filter — only process booking emails matching this salon's criteria.
  const filters = {
    sender: salon.email_filter_sender || 'reservations@ovatu.com',
    subjectPattern: salon.email_filter_subject || undefined,
  };
  const appointment = parser.processEmail(emailData, filters);

  if (!appointment) {
    return { status: 'filtered' };
  }

  // 2. Persist the booking (best-effort; logging still proceeds if no DB).
  const booking = await saveBooking(salon, appointment, emailData);

  // 3. Send the WhatsApp message via the salon's connected Coexistence instance.
  let messageResult = null;
  if (hasMessagingConfig(salon)) {
    messageResult = await sendWhatsApp(salon, appointment, booking);
  }

  return { status: 'processed', appointment, booking, message: messageResult };
}

/**
 * Persist a parsed appointment as a booking row.
 */
async function saveBooking(salon, appointment, emailData) {
  const row = {
    salon_id: salon.id,
    client_name: appointment.client_name || null,
    client_phone: appointment.phone || null,
    client_email: null,
    service: appointment.service || null,
    staff: null,
    date_appointment: appointment.date_appointment || null,
    time_appointment: appointment.time || null,
    location: appointment.location || null,
    status: 'new',
    raw_payload: { appointment, email: emailData },
    source_email: emailData.from || null,
  };

  const { rows, error } = await query(
    `INSERT INTO bookings
       (salon_id, client_name, client_phone, client_email, service, staff,
        date_appointment, time_appointment, location, status, raw_payload, source_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
     RETURNING *`,
    [
      row.salon_id, row.client_name, row.client_phone, row.client_email,
      row.service, row.staff, row.date_appointment, row.time_appointment,
      row.location, row.status, JSON.stringify(row.raw_payload), row.source_email,
    ]
  );

  if (error) {
    console.error('[BookingService] Failed to persist booking:', error.message);
    return { id: null, ...row };
  }
  return rows[0];
}

/**
 * True when messaging can be attempted for a salon — the shared platform token
 * is configured AND the salon has connected a WhatsApp instance (Coexistence).
 */
function hasMessagingConfig(salon) {
  return Boolean(
    process.env.WHATCHIMP_API_TOKEN &&
    (salon && salon.whatchimp_instance_id)
  );
}

/**
 * Send a WhatsApp message via the salon's Coexistence instance and log the
 * result. Enforces the Lite-tier monthly message cap before sending.
 */
async function sendWhatsApp(salon, appointment, booking) {
  // 4. Tier enforcement — Lite salons are capped at LITE_MESSAGE_LIMIT / month.
  const usage = await checkUsageLimit(salon);
  if (!usage.allowed) {
    await logMessage(salon, booking, 'message_limited', 'failed', {
      reason: `Lite plan monthly limit reached (${usage.limit} messages)`,
      used: usage.used,
    });
    return { ok: false, limited: true, plan: usage.plan, used: usage.used };
  }

  const client = new WhatChimpClient({
    phoneNumberId: salon.whatchimp_instance_id,
    defaultCountryCode:
      salon.default_country_code || process.env.WHATCHIMP_DEFAULT_COUNTRY_CODE || '44',
  });

  const templateName =
    salon.whatchimp_template_name || process.env.WHATCHIMP_TEMPLATE_NAME || 'booking_confirmation';
  const languageCode =
    salon.whatchimp_language_code || process.env.WHATCHIMP_LANGUAGE_CODE || 'en_US';

  try {
    let response;
    if (templateName) {
      response = await client.sendTemplateMessage(appointment.phone, templateName, {
        languageCode,
        variables: [
          appointment.client_name || '',
          appointment.service || '',
          appointment.date_appointment || '',
          appointment.time || '',
          appointment.location || '',
        ],
      });
    } else {
      response = await client.sendMessage(appointment.phone, buildTextMessage(appointment));
    }

    await logMessage(salon, booking, 'message_sent', 'sent', response);
    await incrementUsage(salon.id);
    return { ok: true, response };
  } catch (error) {
    await logMessage(salon, booking, 'message_failed', 'failed', { error: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * Current billing-month key in the form "YYYY-MM" (UTC).
 */
function currentMonthKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Look up the salon owner's plan tier ('lite' | 'pro' | 'agency').
 */
async function getSalonPlan(salonId) {
  const { rows, error } = await query(
    `SELECT u.plan AS plan
       FROM users u
       JOIN salons s ON s.user_id = u.id
      WHERE s.id = $1
      LIMIT 1`,
    [salonId]
  );
  if (error || !rows.length) return 'lite';
  return rows[0].plan || 'lite';
}

/**
 * Check whether the salon is allowed to send another message this month.
 * Only the Lite tier is capped; Pro and Agency are unlimited.
 *
 * @returns {Promise<{allowed: boolean, plan: string, limit: number|null, used: number}>}
 */
async function checkUsageLimit(salon) {
  const plan = await getSalonPlan(salon.id);
  if (plan !== 'lite') {
    return { allowed: true, plan, limit: null, used: 0 };
  }

  const month = currentMonthKey();
  const { rows } = await query(
    `SELECT COALESCE(messages_sent, 0) AS used, messages_sent_month
       FROM salons WHERE id = $1`,
    [salon.id]
  );
  const used = (rows.length && rows[0].messages_sent_month === month) ? rows[0].used : 0;

  return {
    allowed: used < LITE_MESSAGE_LIMIT,
    plan,
    limit: LITE_MESSAGE_LIMIT,
    used,
  };
}

/**
 * Increment the salon's usage counter for the current billing month. Resets to
 * 1 automatically when the month changes (single atomic UPDATE).
 */
async function incrementUsage(salonId) {
  const month = currentMonthKey();
  const { error } = await query(
    `UPDATE salons
        SET messages_sent = CASE
              WHEN messages_sent_month IS DISTINCT FROM $2 THEN 1
              ELSE COALESCE(messages_sent, 0) + 1
            END,
            messages_sent_month = $2
      WHERE id = $1`,
    [salonId, month]
  );
  if (error) {
    console.error('[BookingService] Failed to increment usage counter:', error.message);
  }
}

/**
 * Build a free-form confirmation message (used when no template is configured).
 */
function buildTextMessage(appointment) {
  const name = appointment.client_name || 'there';
  let text = `Hi ${name}! 👋 Thanks for booking with us.`;
  if (appointment.service) text += `\nService: ${appointment.service}`;
  if (appointment.date_appointment) text += `\nDate: ${appointment.date_appointment}`;
  if (appointment.time) text += `\nTime: ${appointment.time}`;
  if (appointment.location) text += `\nLocation: ${appointment.location}`;
  text += `\n\nWe look forward to seeing you! ✨`;
  return text;
}

/**
 * Append a log row.
 */
async function logMessage(salon, booking, event, status, payload) {
  const { rows, error } = await query(
    `INSERT INTO logs (salon_id, booking_id, channel, event, status, wa_message_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      salon.id,
      booking && booking.id ? booking.id : null,
      'whatchimp',
      event,
      status,
      (payload && payload.wa_message_id) || null,
      JSON.stringify(payload),
    ]
  );

  if (error) {
    console.error('[BookingService] Failed to write log:', error.message);
  }
}

module.exports = { processBookingEmail, buildTextMessage, checkUsageLimit, LITE_MESSAGE_LIMIT };
