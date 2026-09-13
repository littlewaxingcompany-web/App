/**
 * Booking Service
 *
 * Orchestrates the inbound-booking pipeline used by the SaaS backend:
 *
 *   inbound email -> EmailParser -> (filter) -> persist booking -> send WhatsApp
 *                                                       -> log the outcome
 *
 * This is the backend home for the logic that previously lived in the
 * standalone bridge (imap-listener.js + webhook-sender.js). It reuses the
 * exact same EmailParser so parsing behavior stays consistent.
 */

const EmailParser = require('./email-parser');
const WhatChimpClient = require('./whatchimp-client');
const { getSupabaseAdmin } = require('./supabase');

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
  const db = getSupabaseAdmin();
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

  if (!db) {
    // No Supabase configured yet — return the would-be row for testing.
    console.log('[BookingService] Supabase not configured; skipping persist. Row:', row);
    return { id: null, ...row };
  }

  const { data, error } = await db.from('bookings').insert(row).select().single();
  if (error) {
    console.error('[BookingService] Failed to persist booking:', error.message);
    return { id: null, ...row };
  }
  return data;
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
  const db = getSupabaseAdmin();
  const row = {
    salon_id: salon.id,
    booking_id: booking && booking.id ? booking.id : null,
    channel: 'whatchimp',
    event,
    status,
    wa_message_id: (payload && payload.wa_message_id) || null,
    payload,
  };

  if (!db) {
    console.log('[BookingService] Supabase not configured; skipping log. Row:', row);
    return;
  }

  const { error } = await db.from('logs').insert(row);
  if (error) {
    console.error('[BookingService] Failed to write log:', error.message);
  }
}

module.exports = { processBookingEmail, buildTextMessage };
