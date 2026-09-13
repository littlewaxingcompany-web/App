/**
 * Email Parser for Ovatu Booking Emails
 * 
 * Parses incoming booking confirmation/reminder emails forwarded from
 * reservations@ovatu.com and extracts structured appointment data.
 * 
 * Expected email format:
 *   Location: <value>
 *   Date: <value>
 *   Service: <value>
 *   Time: <value>
 *   <phone> is the number we have on file for you.
 * 
 * Filter criteria:
 *   - Sender: reservations@ovatu.com
 *   - Subject: "Thankyou for your booking at the..."
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
    const from = email.from ? (email.from.text || email.from.address || '') : '';

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
    
    const regex = new RegExp(`${fieldName}\\s*:\\s*(.+?)\\n`, 'i');
    const match = body.match(regex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    const regexEnd = new RegExp(`${fieldName}\\s*:\\s*(.+?)$`, 'im');
    const matchEnd = body.match(regexEnd);
    
    if (matchEnd && matchEnd[1]) {
      return matchEnd[1].trim();
    }
    
    return null;
  }

  /**
   * Extract phone number from the email body.
   * The phone number appears on the line with "is the number we have on file".
   * 
   * @param {string} body - Email body text
   * @returns {string|null} Extracted phone or null
   */
  _extractPhone(body) {
    if (!body) return null;

    // Pattern: the line containing "is the number we have on file"
    const phoneContextRegex = /([^\n]+)\s*is the number we have on file/i;
    const match = body.match(phoneContextRegex);
    
    if (match && match[1]) {
      const line = match[1].trim();
      // Try to extract phone from this line first
      const phoneMatch = line.match(/[\d\s\-\(\)\+\.]{7,}/);
      if (phoneMatch) {
        return phoneMatch[0].trim();
      }
      // If no phone on this line, check previous lines for a phone pattern
      const lines = body.split('\n');
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].includes('is the number we have on file') && i > 0) {
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

    // Fallback: look for common phone patterns
    const phoneRegex = /(\+?\d[\d\s\-\(\)\.]{7,15}\d)/;
    const phoneMatch = body.match(phoneRegex);
    if (phoneMatch) {
      return phoneMatch[1].trim();
    }

    return null;
  }

  /**
   * Strip HTML tags to get plain text.
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
   * Check if an email is a booking email from Ovatu based on filter criteria.
   * 
   * @param {Object} email - Email with subject, text/html body, from
   * @param {Object} [filters] - Custom filter overrides
   * @returns {boolean} True if this matches booking email criteria
   */
  isBookingEmail(email, filters = {}) {
    const body = email.text || email.html || '';
    const subject = (email.subject || '').toLowerCase();
    const from = (email.from || '').toLowerCase();
    
    // Default filter: Ovatu forwarding
    const expectedSender = (filters.sender || 'reservations@ovatu.com').toLowerCase();
    const expectedSubjectPattern = filters.subjectPattern 
      ? new RegExp(filters.subjectPattern, 'i') 
      : /thankyou for your booking at the/i;
    
    const senderMatch = from.includes(expectedSender);
    const subjectMatch = expectedSubjectPattern.test(subject);
    
    // When strict filters are provided, require both sender AND subject to match
    if (filters.sender && filters.subjectPattern) {
      return senderMatch && subjectMatch;
    }
    
    // When only sender is provided, require sender match
    if (filters.sender && !filters.subjectPattern) {
      return senderMatch;
    }
    
    // When no filters provided, use broad detection
    const hasKeyFields = /Location\s*:/i.test(body) || /Date\s*:/i.test(body);
    return (senderMatch && subjectMatch) || hasKeyFields;
  }

  /**
   * Process email text body through the full pipeline and return formatted payload.
   * 
   * @param {Object} emailData - { subject, from, text, html, date }
   * @param {Object} [filters] - Optional filter overrides
   * @returns {Object|null} Formatted appointment or null if filtered out
   */
  processEmail(emailData, filters = {}) {
    if (!this.isBookingEmail(emailData, filters)) {
      console.log(`[EmailParser] Email filtered out: "${emailData.subject}" from ${emailData.from}`);
      return null;
    }
    
    const appointment = this.parse(emailData);
    
    // Check if essential fields were extracted
    if (!appointment.location && !appointment.date_appointment && !appointment.phone) {
      console.log(`[EmailParser] No appointment fields found, skipping.`);
      return null;
    }
    
    return appointment;
  }
}

module.exports = EmailParser;