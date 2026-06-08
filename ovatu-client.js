/**
 * Ovatu API Client
 * 
 * Handles authentication and appointment fetching from the Ovatu API.
 * Ovatu uses Bearer Token authentication against their REST API.
 * 
 * Since Ovatu lacks webhooks, we poll for appointments filtered by
 * updated_at_since / created_at_since timestamps.
 */

const axios = require('axios');

class OvatuClient {
  /**
   * @param {string} apiToken - Ovatu API bearer token
   * @param {string} baseUrl - Ovatu API base URL (default: https://api.ovatu.com/v2)
   */
  constructor(apiToken, baseUrl = 'https://api.ovatu.com/v2') {
    if (!apiToken) {
      throw new Error('Ovatu API token is required');
    }
    this.apiToken = apiToken;
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // strip trailing slash
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  /**
   * Fetch appointments updated after a given ISO 8601 timestamp.
   * This is the primary polling method.
   * 
   * @param {string} since - ISO 8601 timestamp
   * @param {Object} [options] - Additional query parameters
   * @param {number} [options.per_page] - Results per page
   * @param {number} [options.page] - Page number
   * @returns {Promise<Object>} - Appointment data from Ovatu
   */
  async getAppointmentsUpdatedSince(since, options = {}) {
    const params = {
      updated_at_since: since,
      ...options,
    };
    
    console.log(`[OvatuClient] Fetching appointments updated since: ${since}`);
    
    try {
      const response = await this.client.get('/appointments', { params });
      return response.data;
    } catch (error) {
      this._handleError(error, 'getAppointmentsUpdatedSince');
      throw error;
    }
  }

  /**
   * Fetch appointments created after a given ISO 8601 timestamp.
   * Useful for initial bootstrap or detecting brand-new appointments.
   * 
   * @param {string} since - ISO 8601 timestamp
   * @param {Object} [options] - Additional query parameters
   * @returns {Promise<Object>} - Appointment data from Ovatu
   */
  async getAppointmentsCreatedSince(since, options = {}) {
    const params = {
      created_at_since: since,
      ...options,
    };
    
    console.log(`[OvatuClient] Fetching appointments created since: ${since}`);
    
    try {
      const response = await this.client.get('/appointments', { params });
      return response.data;
    } catch (error) {
      this._handleError(error, 'getAppointmentsCreatedSince');
      throw error;
    }
  }

  /**
   * Test the connection to Ovatu API by making a lightweight request.
   * 
   * @returns {Promise<boolean>} - True if connection succeeds
   */
  async testConnection() {
    try {
      // Try fetching a single appointment to validate credentials
      const response = await this.client.get('/appointments', {
        params: { per_page: 1 },
      });
      console.log('[OvatuClient] Connection successful!');
      return true;
    } catch (error) {
      console.error('[OvatuClient] Connection failed:', error.message);
      if (error.response) {
        console.error(`[OvatuClient] Status: ${error.response.status}`);
        console.error(`[OvatuClient] Body:`, error.response.data);
      }
      return false;
    }
  }

  /**
   * Get a new ISO 8601 timestamp for "now", useful for tracking last poll time.
   * 
   * @returns {string} - Current ISO 8601 timestamp
   */
  getCurrentTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Handle and log API errors uniformly.
   */
  _handleError(error, context) {
    if (error.response) {
      console.error(`[OvatuClient] ${context} - HTTP ${error.response.status}:`, 
        JSON.stringify(error.response.data));
    } else if (error.request) {
      console.error(`[OvatuClient] ${context} - No response received:`, error.message);
    } else {
      console.error(`[OvatuClient] ${context} - Error:`, error.message);
    }
  }
}

module.exports = OvatuClient;
