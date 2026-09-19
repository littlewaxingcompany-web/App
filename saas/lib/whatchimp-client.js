/**
 * WhatChimp Client
 *
 * Direct WhatsApp messaging client for WhatChimp (https://www.whatchimp.com).
 * Replaces the Zapier webhook hop so SalonStream can send WhatsApp messages
 * straight from parsed booking data without paying for Zapier.
 *
 * API reference: https://help.whatchimp.com/docs/whatchimp-apis
 *
 * Template Endpoint: POST https://app.whatchimp.com/api/v1/whatsapp/send/template
 * Auth:             `apiToken` + `phone_number_id` (passed as request params)
 */

const axios = require('axios');

const DEFAULT_BASE_URL = 'https://app.whatchimp.com';

class WhatChimpClient {
  /**
   * @param {Object} options
   * @param {string} options.apiToken - WhatChimp API key
   * @param {string} options.phoneNumberId - WhatsApp phone number ID (from WhatChimp list)
   * @param {string} [options.baseUrl] - API base URL
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
        'User-Agent': 'SalonStream-WhatChimpClient/1.1',
      },
    });
  }

  /**
   * Send a free-form text message (only works within 24h window).
   * 
   * @param {string} phone - Recipient phone number
   * @param {string} text - Message body
   * @returns {Promise<Object>} API response
   */
  async sendMessage(phone, text) {
    if (!text || !String(text).trim()) {
      throw new Error('WhatChimpClient.sendMessage: text is required');
    }
    return this._send('/api/v1/whatsapp/send', {
      phone_number: this.normalizePhone(phone),
      message: String(text),
    });
  }

  /**
   * Send a pre-approved template message (works anytime).
   *
   * @param {string} phone - Recipient phone number
   * @param {string} templateId - WhatChimp INTERNAL ID (e.g. "443476")
   * @param {Object} [options]
   * @param {string} [options.languageCode] - Template language code (default: 'en_US')
   * @param {Array<string>} [options.variables] - Values for {{1}}, {{2}}, ... in order
   * @returns {Promise<Object>} API response
   */
  async sendTemplateMessage(phone, templateId, { languageCode = 'en_US', variables = [] } = {}) {
    if (!templateId) {
      throw new Error('WhatChimpClient.sendTemplateMessage: templateId is required');
    }

    const params = {
      phone_number: this.normalizePhone(phone),
      template_id: templateId, // WhatChimp uses 'template_id' for their internal numeric ID
      language_code: languageCode,
    };

    (variables || []).forEach((value, index) => {
      // variable1 maps to {{1}}, variable2 -> {{2}}, etc.
      params[`variable${index + 1}`] = value == null ? '' : String(value);
    });

    // Template sends MUST use the /send/template endpoint to bypass the 24h window
    return this._send('/api/v1/whatsapp/send/template', params);
  }

  /**
   * Normalize a phone number into the numeric E.164-style format.
   *
   * @param {string} phone - Raw phone number
   * @returns {string} Normalized digits-only number
   */
  normalizePhone(phone) {
    if (phone == null) return '';
    let digits = String(phone).replace(/[^\d+]/g, '');

    if (digits.startsWith('+')) {
      digits = digits.slice(1);
    }

    if (digits.startsWith('0')) {
      digits = this.defaultCountryCode + digits.slice(1);
    }

    return digits;
  }

  /**
   * Shared low-level send. POSTs form-encoded params.
   *
   * @param {string} endpoint - API endpoint
   * @param {Object} extraParams - message-specific params
   * @returns {Promise<Object>} Parsed JSON response body
   */
  async _send(endpoint, extraParams) {
    const params = new URLSearchParams();
    params.append('apiToken', this.apiToken);
    params.append('phone_number_id', this.phoneNumberId);
    
    Object.entries(extraParams).forEach(([key, value]) => {
      params.append(key, value);
    });

    console.log(`[WhatChimpClient] Sending WhatsApp request to ${extraParams.phone_number} via ${endpoint}...`);

    try {
      const response = await this.client.post(endpoint, params);
      const body = response.data;

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
