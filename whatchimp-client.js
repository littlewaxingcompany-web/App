/**
 * WhatChimp Client
 *
 * Direct WhatsApp messaging client for WhatChimp (https://www.whatchimp.com).
 * Replaces the Zapier webhook hop so SalonStream can send WhatsApp messages
 * straight from parsed booking data without paying for Zapier.
 *
 * API reference: https://help.whatchimp.com/docs/whatchimp-apis
 *
 * Endpoint: POST/GET https://app.whatchimp.com/api/v1/whatsapp/send
 * Auth:     `apiToken` + `phone_number_id` (passed as request params, not headers)
 *
 * Two message kinds are supported because WhatsApp enforces a 24-hour
 * session window for free-form text:
 *   - sendMessage()          -> free-form text (only within a 24h window)
 *   - sendTemplateMessage()  -> pre-approved template (works anytime; use this
 *                               for reminders, confirmations and follow-ups)
 */

const axios = require('axios');

const DEFAULT_BASE_URL = 'https://app.whatchimp.com';

class WhatChimpClient {
  /**
   * @param {Object} options
   * @param {string} options.apiToken - WhatChimp API key (from API Developer Console)
   * @param {string} options.phoneNumberId - WhatsApp phone number ID
   * @param {string} [options.baseUrl] - API base URL (default: https://app.whatchimp.com)
   * @param {string} [options.defaultCountryCode] - used when normalizing local numbers (default: '44')
   */
  constructor({ apiToken, phoneNumberId, baseUrl = DEFAULT_BASE_URL, defaultCountryCode = '44' }) {
    if (!apiToken) {
      throw new Error('WhatChimpClient: apiToken is required');
    }
    if (!phoneNumberId) {
      throw new Error('WhatChimpClient: phoneNumberId is required');
    }

    this.apiToken = apiToken;
    this.phoneNumberId = phoneNumberId;
    this.defaultCountryCode = String(defaultCountryCode);
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SalonStream-WhatChimpClient/1.0',
      },
    });
  }

  /**
   * Send a free-form text message.
   *
   * IMPORTANT: WhatsApp only allows free-form text within the 24-hour session
   * window (after the customer last messaged you). For reminders, booking
   * confirmations or follow-ups sent later, use sendTemplateMessage().
   *
   * @param {string} phone - Recipient phone number (any format; normalized internally)
   * @param {string} text - Message body
   * @returns {Promise<Object>} API response ({ status, wa_message_id, message })
   */
  async sendMessage(phone, text) {
    if (!text || !String(text).trim()) {
      throw new Error('WhatChimpClient.sendMessage: text is required');
    }
    return this._send({
      phone_number: this.normalizePhone(phone),
      message: String(text),
    });
  }

  /**
   * Send a pre-approved template message (works anytime, no 24h window).
   *
   * @param {string} phone - Recipient phone number
   * @param {string} templateName - Approved template name (e.g. "booking_confirmation")
   * @param {Object} [options]
   * @param {string} [options.languageCode] - Template language code (default: 'en_US')
   * @param {Array<string>} [options.variables] - Values for {{1}}, {{2}}, ... in order
   * @returns {Promise<Object>} API response
   */
  async sendTemplateMessage(phone, templateName, { languageCode = 'en_US', variables = [] } = {}) {
    if (!templateName) {
      throw new Error('WhatChimpClient.sendTemplateMessage: templateName is required');
    }

    const params = {
      phone_number: this.normalizePhone(phone),
      template_name: templateName,
      language_code: languageCode,
    };

    (variables || []).forEach((value, index) => {
      // variable1 maps to {{1}}, variable2 -> {{2}}, etc.
      params[`variable${index + 1}`] = value == null ? '' : String(value);
    });

    // Regular template messages use the same /api/v1/whatsapp/send endpoint as
    // text messages (with template_name + language_code + variableN). The
    // /api/v1/whatsapp/send/template endpoint is only for Quick Reply templates.
    return this._send(params);
  }

  /**
   * Normalize a phone number into the numeric E.164-style format WhatChimp
   * expects (country code + number, digits only, no leading '+').
   *
   * Examples:
   *   '07700 900000'      -> '447700900000'  (UK local -> +44)
   *   '+44 7700 900000'   -> '447700900000'
   *   '919999999999'      -> '919999999999'  (already international)
   *
   * @param {string} phone - Raw phone number
   * @returns {string} Normalized digits-only number with country code
   */
  normalizePhone(phone) {
    if (phone == null) return '';
    let digits = String(phone).replace(/[^\d+]/g, '');

    if (digits.startsWith('+')) {
      digits = digits.slice(1);
    }

    // Local number starting with a leading zero -> assume it's missing the
    // country code and prepend the default country code.
    if (digits.startsWith('0')) {
      digits = this.defaultCountryCode + digits.slice(1);
    }

    return digits;
  }

  /**
   * Shared low-level send. POSTs form-encoded params to /api/v1/whatsapp/send.
   *
   * @param {Object} extraParams - message-specific params (phone_number + message, etc.)
   * @param {string} [endpoint] - API endpoint (default: /api/v1/whatsapp/send)
   * @returns {Promise<Object>} Parsed JSON response body
   */
  async _send(extraParams, endpoint = '/api/v1/whatsapp/send') {
    const params = new URLSearchParams({
      apiToken: this.apiToken,
      phone_number_id: this.phoneNumberId,
      ...extraParams,
    });

    console.log(`[WhatChimpClient] Sending WhatsApp message to ${extraParams.phone_number} via ${endpoint}...`);

    try {
      const response = await this.client.post(endpoint, params);
      const body = response.data;

      // WhatChimp returns HTTP 200 even for logical failures, signalling the
      // outcome via the `status` field ("1" = success, "0" = failure).
      if (body && body.status === '0') {
        throw new Error(`WhatChimp rejected message: ${body.message || 'unknown error'}`);
      }

      console.log(`[WhatChimpClient] Success (wa_message_id: ${body && body.wa_message_id || 'n/a'})`);
      return body;
    } catch (error) {
      if (error.response) {
        console.error(`[WhatChimpClient] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[WhatChimpClient] Request failed:`, error.message);
      }
      throw error;
    }
  }
}

module.exports = WhatChimpClient;
