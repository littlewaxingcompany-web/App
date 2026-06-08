/**
 * Email Parser for Salon Booking Emails
 * 
 * Parses incoming booking confirmation/reminder emails from the salon's
 * scheduling system and extracts structured appointment data.
 * 
 * Expected email format (key fields):
 *   Location: <value>
 *   Date: <value>
 *   Service: <value>
 *   Time: <value>
 *   Phone: <value> (line before "is the number we have on file")
 */

const { simpleParser } = require('mailparser');

class EmailParser {
  /**
   * Parse a raw email (RFC 822) into structured appointment data.
   * 
   * @param {Buffer|string} rawEmail - The raw email source
   * @returns {Promise<Object>} Parsed appointment data
   */
  async parseRaw(rawEmail) {
    const parsed = await simpleParser(rawEmail);
    return this.parse(parsed);
  }

  /**
   * Parse an already-parsed mailparser email object.
   * 
   * @param {Object} email - mailparser parsed email
   * @returns {Object} Structured appointment data
   */
  parse(email) {
    const subject = email.subject || '';
    const text = email.text || '';
    const html = email.html || '';
    const body = text || this._stripHtml(html);
    const from = email.from ? email.from.text : '';

    console.log(`[EmailParser] Parsing email: "${subject}" from: ${from}`);

    const appointment = {
      subject,
      from,
      date: email.date,
      // Extracted fields
      location: this._extractField(body, 'Location'),
      date_appointment: this._extractField(body, 'Date'),
      service: this._extractField(body, 'Service'),
      time: this._extractField(body, 'Time'),
      phone: this._extractPhone(body),
      // Raw body for debugging
      _rawBody: body.substring(0, 500),
    };

    console.log(`[EmailParser] Extracted:`, {
      location: appointment.location,
      date: appointment.date_appointment,
      service: appointment.service,
      time: appointment.time,
      phone: appointment.phone,
    });

    return appointment;
  }

  /**
   * Extract a field value from the body text.
   * Looks for patterns like "FieldName: value" and returns the value.
   * 
   * @param {string} body - Email body text
   * @param {string} fieldName - Field name to search for (e.g., "Location")
   * @returns {string|null} Extracted value or null
   */
  _extractField(body, fieldName) {
    if (!body) return null;
    
    // Match "FieldName: value" — value can be multi-word, ends at newline
    const regex = new RegExp(`${fieldName}\\s*:\\s*(.+?)\\n`, 'i');
    const match = body.match(regex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Fallback: try end of string if no newline after value
    const regexEnd = new RegExp(`${fieldName}\\s*:\\s*(.+?)$`, 'im');
    const matchEnd = body.match(regexEnd);
    
    if (matchEnd && matchEnd[1]) {
      return matchEnd[1].trim();
    }
    
    return null;
  }

  /**
   * Extract phone number from the email body.
   * Based on the template: the phone number appears on the line before
   * "is the number we have on file".
   * 
   * @param {string} body - Email body text
   * @returns {string|null} Extracted phone or null
   */
  _extractPhone(body) {
    if (!body) return null;

    // Pattern: the line containing "is the number we have on file"
    // The phone number is typically ON this line or the line just before
    const phoneContextRegex = /([^\n]+)\s*is the number we have on file/i;
    const match = body.match(phoneContextRegex);
    
    if (match && match[1]) {
      const line = match[1].trim();
      // Try to extract phone from this line first
      const phoneMatch = line.match(/[\d\s\-\(\)\+\.]{7,}/);
      if (phoneMatch) {
        return phoneMatch[0].trim();
      }
      // If no phone on this line, check the line before it
      // by finding the line in the body and looking at preceding content
      const lines = body.split('\n');
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].includes('is the number we have on file') && i > 0) {
          // Search backwards from this line for any line with a phone pattern
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            const prevPhone = lines[j].match(/[\d\s\-\(\)\+\.]{7,}/);
            if (prevPhone) {
              return prevPhone[0].trim();
            }
          }
          break;
        }
      }
      return line;
    }

    // Fallback: look for common phone patterns elsewhere
    const phoneRegex = /(\+?\d[\d\s\-\(\)\.]{7,15}\d)/;
    const phoneMatch = body.match(phoneRegex);
    if (phoneMatch) {
      return phoneMatch[1].trim();
    }

    return null;
  }

  /**
   * Strip HTML tags to get plain text.
   * 
   * @param {string} html - HTML string
   * @returns {string} Plain text
   */
  _stripHtml(html) {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Test if an email is a booking-related email based on subject and content.
   * 
   * @param {Object} email - Parsed email object
   * @returns {boolean} True if this looks like a booking email
   */
  isBookingEmail(email) {
    const body = email.text || email.html || '';
    const subject = (email.subject || '').toLowerCase();
    
    // Check for specific booking indicators (not generic words like "reminder")
    const hasBookingKeywords = /\b(booking|appointment|confirmed|new booking|booking confirmation)\b/i.test(subject);
    const hasKeyFields = /Location\s*:/i.test(body) || /Date\s*:/i.test(body);
    
    return hasBookingKeywords || hasKeyFields;
  }
}

module.exports = EmailParser;