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
 */

const EmailParser = require('./email-parser');
const WhatChimpClient = require('./whatchimp-client');
const { query } = require('./db');

const parser = new EmailParser();

/**
 * Process a normalized inbound email for a given salon.
 *
 * @param {Object} emailData - { subject, from, text, html, date, provider }
 * @param {Object} salon - Salon row (must include whatchimp_* + filter fields)
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

  // 3. Send the WhatsApp message if this salon has WhatChimp configured.
  let messageResult = null;
  if (salon.whatchimp_api_token && salon.whatchimp_phone_number_id) {
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
 * Send a WhatsApp message via WhatChimp and log the result.
 */
async function sendWhatsApp(salon, appointment, booking) {
  const client = new WhatChimpClient({
    apiToken: salon.whatchimp_api_token,
    phoneNumberId: salon.whatchimp_phone_number_id,
    defaultCountryCode: salon.default_country_code || '44',
  });

  try {
    let response;
    if (salon.whatchimp_template_name) {
      response = await client.sendTemplateMessage(appointment.phone, salon.whatchimp_template_name, {
        languageCode: salon.whatchimp_language_code || 'en_US',
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
    return { ok: true, response };
  } catch (error) {
    await logMessage(salon, booking, 'message_failed', 'failed', { error: error.message });
    return { ok: false, error: error.message };
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

module.exports = { processBookingEmail, buildTextMessage };
