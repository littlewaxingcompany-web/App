/**
 * Webhook Sender
 * 
 * Forwards appointment data to Zapier webhook URLs.
 * Zapier then triggers WhatsApp message automations based on the data.
 */

const axios = require('axios');

class WebhookSender {
  /**
   * @param {string} webhookUrl - Zapier webhook URL to send data to
   */
  constructor(webhookUrl) {
    if (!webhookUrl) {
      throw new Error('Zapier webhook URL is required');
    }
    this.webhookUrl = webhookUrl;
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SalonStream-OvatuBridge/1.0',
      },
    });
  }

  /**
   * Send appointment data to the Zapier webhook.
   * 
   * @param {Object} appointment - Appointment data from Ovatu
   * @returns {Promise<Object>} - Webhook response
   */
  async sendAppointment(appointment) {
    console.log(`[WebhookSender] Forwarding appointment to Zapier...`);
    
    // Format the payload for Zapier's consumption
    const payload = this._formatPayload(appointment);
    
    try {
      const response = await this.client.post(this.webhookUrl, payload);
      console.log(`[WebhookSender] Success! Status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error(`[WebhookSender] Failed to send:`, error.message);
      if (error.response) {
        console.error(`[WebhookSender] Status: ${error.response.status}`);
        console.error(`[WebhookSender] Body:`, error.response.data);
      }
      throw error;
    }
  }

  /**
   * Send multiple appointments.
   * 
   * @param {Array<Object>} appointments - Array of appointment objects
   * @returns {Promise<Array>} - Results of all sends
   */
  async sendAppointments(appointments) {
    if (!appointments || appointments.length === 0) {
      console.log('[WebhookSender] No appointments to send.');
      return [];
    }

    console.log(`[WebhookSender] Sending ${appointments.length} appointment(s) to Zapier...`);
    
    // Send sequentially to avoid overwhelming the webhook
    const results = [];
    for (const appointment of appointments) {
      try {
        const result = await this.sendAppointment(appointment);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: error.message, appointment });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`[WebhookSender] Sent ${successCount}/${appointments.length} successfully.`);
    
    return results;
  }

  /**
   * Format raw appointment data into a clean payload for Zapier.
   * 
   * @param {Object} appointment - Raw appointment from Ovatu
   * @returns {Object} - Formatted payload
   */
  _formatPayload(appointment) {
    // Map Ovatu fields to a clean structure for Zapier
    // Zapier users will map these into their WhatsApp message templates
    return {
      event: 'appointment_update',
      timestamp: new Date().toISOString(),
      data: {
        id: appointment.id || appointment.appointment_id,
        client_name: appointment.client_name || appointment.customer?.name || '',
        client_phone: appointment.client_phone || appointment.customer?.phone || '',
        client_email: appointment.client_email || appointment.customer?.email || '',
        service: appointment.service_name || appointment.service?.name || '',
        staff: appointment.staff_name || appointment.staff?.name || '',
        date: appointment.date || appointment.start_time || '',
        time: appointment.time || '',
        start_time: appointment.start_time || '',
        end_time: appointment.end_time || '',
        duration_minutes: appointment.duration || appointment.duration_minutes || 0,
        status: appointment.status || '',
        location: appointment.location_name || appointment.location?.name || '',
        notes: appointment.notes || '',
        // Pass through any extra fields
        raw: appointment,
      },
    };
  }
}

module.exports = WebhookSender;
