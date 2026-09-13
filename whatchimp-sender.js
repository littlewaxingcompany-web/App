/**
 * WhatChimp Sender
 *
 * Adapts parsed booking data into WhatsApp messages and dispatches them via
 * the WhatChimpClient. Exposes the same `sendAppointment(appointment)`
 * interface as WebhookSender so it can be dropped into the IMAP listener
 * (or inbox agent) as a direct replacement for the Zapier webhook hop.
 */

const WhatChimpClient = require('./whatchimp-client');

class WhatChimpSender {
  /**
   * @param {Object} options
   * @param {string} options.apiToken - WhatChimp API key
   * @param {string} options.phoneNumberId - WhatsApp phone number ID
   * @param {string} [options.templateName] - Approved booking template name.
   *        When set, sends a template message (works anytime). When omitted,
   *        falls back to a free-form text message (24h window only).
   * @param {string} [options.languageCode] - Template language (default 'en_US')
   * @param {string} [options.defaultCountryCode] - Country code for local numbers (default '44')
   */
  constructor({
    apiToken,
    phoneNumberId,
    templateName = '',
    languageCode = 'en_US',
    defaultCountryCode = '44',
  }) {
    this.client = new WhatChimpClient({ apiToken, phoneNumberId, defaultCountryCode });
    this.templateName = templateName;
    this.languageCode = languageCode;
  }

  /**
   * Send a booking notification to the client's WhatsApp number.
   *
   * @param {Object} appointment - Parsed appointment (from EmailParser)
   * @returns {Promise<Object>} WhatChimp API response
   */
  async sendAppointment(appointment) {
    const phone = appointment.phone;
    if (!phone) {
      throw new Error('WhatChimpSender: appointment has no phone number to send to');
    }

    const message = this._formatMessage(appointment);

    if (this.templateName) {
      console.log(`[WhatChimpSender] Sending via template "${this.templateName}"...`);
      return this.client.sendTemplateMessage(phone, this.templateName, {
        languageCode: this.languageCode,
        // Order of variables must match {{1}}, {{2}}, ... in the template.
        variables: [
          appointment.client_name || '',
          appointment.service || '',
          appointment.date_appointment || '',
          appointment.time || '',
          appointment.location || '',
        ],
      });
    }

    console.log(`[WhatChimpSender] Sending via free-form text message...`);
    return this.client.sendMessage(phone, message);
  }

  /**
   * Build a human-friendly WhatsApp message from appointment data.
   * This is used for the free-form text path and as a fallback/dry-run preview.
   *
   * @param {Object} appointment
   * @returns {string}
   */
  _formatMessage(appointment) {
    const name = appointment.client_name || 'there';
    const service = appointment.service || '';
    const date = appointment.date_appointment || '';
    const time = appointment.time || '';
    const location = appointment.location || '';

    let text = `Hi ${name}! 👋 Thanks for booking with us.`;
    if (service) text += `\nService: ${service}`;
    if (date) text += `\nDate: ${date}`;
    if (time) text += `\nTime: ${time}`;
    if (location) text += `\nLocation: ${location}`;
    text += `\n\nWe look forward to seeing you! ✨`;

    return text;
  }

  /**
   * Send a plain text message directly (bypasses appointment formatting).
   * Useful for tests and ad-hoc messages.
   */
  async sendMessage(phone, text) {
    return this.client.sendMessage(phone, text);
  }
}

module.exports = WhatChimpSender;
