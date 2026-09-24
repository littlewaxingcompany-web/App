/**
 * Inbound Email Webhook Adapters (Postmark / Mailgun).
 *
 * The SaaS app receives booking emails via an Inbound Email API (per the
 * technical strategy) instead of polling IMAP. Both providers POST parsed
 * email fields; this module normalizes them into a common shape that the
 * existing EmailParser understands:
 *
 *   { subject, from, text, html, date }
 */

/**
 * Normalize a Postmark inbound webhook payload.
 * Postmark fields: Subject, FromFull.Email / From, TextBody, HtmlBody, Date,
 * ToFull (array) / To.
 */
function fromPostmark(body) {
  let to = '';
  if (Array.isArray(body.ToFull) && body.ToFull.length) {
    to = body.ToFull[0].Email || '';
  } else if (typeof body.To === 'string') {
    to = body.To;
  }
  return {
    subject: body.Subject || '',
    from: (body.FromFull && body.FromFull.Email) || body.From || body.MailboxHash || '',
    to,
    text: body.TextBody || body.StrippedTextReply || '',
    html: body.HtmlBody || '',
    date: body.Date ? new Date(body.Date) : new Date(),
    provider: 'postmark',
  };
}

/**
 * Normalize a Mailgun inbound webhook payload.
 * Mailgun fields: subject, from, recipient, stripped-text / body-plain, body-html, Date.
 */
function fromMailgun(body) {
  return {
    subject: body.subject || '',
    from: body.from || body.sender || '',
    to: body.recipient || body.to || '',
    text: body['stripped-text'] || body['body-plain'] || '',
    html: body['body-html'] || '',
    date: body.Date ? new Date(body.Date) : new Date(),
    provider: 'mailgun',
  };
}

/**
 * Normalize an already-parsed JSON body (used for tests and generic webhooks).
 */
function fromGeneric(body) {
  return {
    subject: body.subject || '',
    from: body.from || '',
    to: body.to || body.recipient || '',
    text: body.text || body.body || '',
    html: body.html || '',
    date: body.date ? new Date(body.date) : new Date(),
    provider: body.provider || 'generic',
  };
}

/**
 * Normalize any supported inbound email payload.
 *
 * @param {string} provider - 'postmark' | 'mailgun' | 'generic'
 * @param {Object} body - Raw webhook body
 * @returns {Object} normalized { subject, from, to, text, html, date, provider }
 */
function normalizeInboundEmail(provider, body) {
  switch ((provider || '').toLowerCase()) {
    case 'postmark':
      return fromPostmark(body);
    case 'mailgun':
      return fromMailgun(body);
    default:
      return fromGeneric(body);
  }
}

module.exports = { normalizeInboundEmail, fromPostmark, fromMailgun, fromGeneric };
