/**
 * SalonStream Bridge
 * 
 * Two modes:
 *   1. IMAP Listener — Connects to an IMAP mailbox for real-time email detection
 *   2. Inbox Agent — CLI tool for processing emails from the agent's tools
 * 
 * Mode 1 (IMAP): Run with `npm start` after configuring IMAP_* env vars.
 * Mode 2 (Agent): Use `node inbox-agent.js` with the --subject, --from, --body flags.
 * 
 * Default: Runs the IMAP listener if IMAP_HOST is configured, otherwise
 * prints usage instructions for the agent-based approach.
 */

require('dotenv').config();

const config = {
  mode: process.env.BRIDGE_MODE || (process.env.IMAP_HOST ? 'imap' : 'agent'),
  webhookUrl: process.env.ZAPIER_WEBHOOK_URL,
  filter: {
    sender: process.env.EMAIL_FILTER_SENDER || 'reservations@ovatu.com',
    subjectPattern: process.env.EMAIL_FILTER_SUBJECT || 'thankyou for your booking at the',
  },
  imap: {
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT, 10) || 993,
    tls: process.env.IMAP_TLS !== 'false',
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    mailbox: process.env.IMAP_MAILBOX || 'INBOX',
    pollIntervalMs: (parseInt(process.env.IMAP_POLL_INTERVAL, 10) || 30) * 1000,
  },
  whatchimp: {
    apiToken: process.env.WHATCHIMP_API_TOKEN,
    phoneNumberId: process.env.WHATCHIMP_PHONE_NUMBER_ID,
    templateName: process.env.WHATCHIMP_TEMPLATE_NAME || '',
    languageCode: process.env.WHATCHIMP_LANGUAGE_CODE || 'en_US',
    defaultCountryCode: process.env.WHATCHIMP_DEFAULT_COUNTRY_CODE || '44',
  },
};

async function start() {
  console.log(`╔══════════════════════════════════════════════════════╗`);
  console.log(`║         SalonStream Bridge                          ║`);
  console.log(`║         Ovatu Email Parser → WhatsApp               ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`\nConfiguration:`);
  console.log(`  Filter sender: ${config.filter.sender}`);
  console.log(`  Filter subject: ${config.filter.subjectPattern}`);

  if (config.mode === 'imap') {
    // ─── IMAP Mode ──────────────────────────────────────────────
    const WebhookSender = require('./webhook-sender');
    const WhatChimpSender = require('./whatchimp-sender');
    const ImapListener = require('./imap-listener');
    
    if (!config.imap.host || !config.imap.user || !config.imap.password) {
      console.error(`[Bridge] ERROR: IMAP mode requires IMAP_HOST, IMAP_USER, IMAP_PASSWORD`);
      process.exit(1);
    }
    
    // Choose the messaging backend. WhatChimp (direct WhatsApp) takes
    // precedence when configured; otherwise fall back to the Zapier webhook.
    let sender;
    if (config.whatchimp.apiToken && config.whatchimp.phoneNumberId) {
      sender = new WhatChimpSender(config.whatchimp);
      console.log(`  Messaging: WhatChimp (direct WhatsApp)`);
      console.log(`  Phone Number ID: ${config.whatchimp.phoneNumberId}`);
      console.log(`  Template: ${config.whatchimp.templateName || '(none — free-form text, 24h window)'}`);
    } else if (config.webhookUrl) {
      sender = new WebhookSender(config.webhookUrl);
      console.log(`  Messaging: Zapier Webhook`);
      console.log(`  Zapier Webhook: ${config.webhookUrl.substring(0, 50)}...`);
    } else {
      console.warn(`  Messaging: NOT CONFIGURED — set WHATCHIMP_API_TOKEN/WHATCHIMP_PHONE_NUMBER_ID `);
      console.warn(`  (or ZAPIER_WEBHOOK_URL) in .env. Parsed appointments will only be logged.`);
    }
    
    const imapListener = new ImapListener(config.imap, sender, config.filter);
    
    console.log(`  IMAP Server: ${config.imap.host}:${config.imap.port}`);
    console.log(`  User: ${config.imap.user}`);
    
    console.log(`\n[Bridge] Starting IMAP listener...\n`);
    await imapListener.start();
    
  } else {
    // ─── Agent Mode ──────────────────────────────────────────────
    console.log(`\n[Bridge] Running in AGENT mode.`);
    console.log(`\nThe bridge is configured for agent-based polling.`);
    console.log(`\nTo process emails manually:`);
    console.log(`  1. Check inbox with the listMessages tool`);
    console.log(`  2. Read new emails with readMessage tool`);
    console.log(`  3. Process via inbox-agent.js:`);
    console.log(`     node inbox-agent.js \\`);
    console.log(`       --subject \"<email subject>\" \\`);
    console.log(`       --from \"<sender email>\" \\`);
    console.log(`       --body \"<email body text>\"`);
    console.log(`       ${config.webhookUrl ? '--forward' : '--dry-run'}`);
    console.log(``);
    
    if (config.webhookUrl) {
      console.log(`  Zapier Webhook: CONFIGURED ✓`);
    } else {
      console.log(`  Zapier Webhook: NOT CONFIGURED — set ZAPIER_WEBHOOK_URL in .env`);
    }
    
    console.log(`\n[Bridge] Agent mode ready. Waiting for manual invocation.`);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.on('SIGINT', async () => {
  console.log(`\n[Bridge] Shutting down...`);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`\n[Bridge] Shutting down...`);
  process.exit(0);
});

// ─── Start ────────────────────────────────────────────────────────────────────

start().catch(error => {
  console.error(`[Bridge] Fatal error:`, error);
  process.exit(1);
});