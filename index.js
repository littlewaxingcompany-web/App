/**
 * SalonStream Bridge — Email Parser Edition
 * 
 * Listens to an IMAP mailbox for booking confirmation/reminder emails,
 * parses them into structured appointment data, and forwards to
 * Zapier webhooks for WhatsApp message automation.
 * 
 * Usage:
 *   1. Copy .env.example to .env and fill in credentials
 *   2. npm install
 *   3. npm start
 */

require('dotenv').config();
const WebhookSender = require('./webhook-sender');
const ImapListener = require('./imap-listener');

// ─── Configuration ────────────────────────────────────────────────────────────

const config = {
  webhookUrl: process.env.ZAPIER_WEBHOOK_URL,
  imap: {
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT, 10) || 993,
    tls: process.env.IMAP_TLS !== 'false',
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    mailbox: process.env.IMAP_MAILBOX || 'INBOX',
    pollIntervalMs: (parseInt(process.env.IMAP_POLL_INTERVAL, 10) || 30) * 1000,
  },
};

// Validate required config
const required = ['webhookUrl'];
const imapRequired = ['host', 'user', 'password'];

for (const key of required) {
  if (!config[key]) {
    console.error(`[Bridge] ERROR: Missing required environment variable: ZAPIER_WEBHOOK_URL`);
    console.error(`[Bridge] Please set ZAPIER_WEBHOOK_URL in .env`);
    process.exit(1);
  }
}

for (const key of imapRequired) {
  if (!config.imap[key]) {
    console.error(`[Bridge] ERROR: Missing required environment variable: IMAP_${key.toUpperCase()}`);
    console.error(`[Bridge] Please set IMAP_${key.toUpperCase()} in .env`);
    process.exit(1);
  }
}

// ─── Initialize ───────────────────────────────────────────────────────────────

const webhook = new WebhookSender(config.webhookUrl);
const imapListener = new ImapListener(config.imap, webhook);

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start() {
  console.log(`╔══════════════════════════════════════════════════════╗`);
  console.log(`║         SalonStream Bridge                          ║`);
  console.log(`║         Email Parser Edition                        ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`\nConfiguration:`);
  console.log(`  IMAP Server: ${config.imap.host}:${config.imap.port}`);
  console.log(`  Mailbox: ${config.imap.mailbox}`);
  console.log(`  User: ${config.imap.user}`);
  console.log(`  Zapier Webhook: ${config.webhookUrl.substring(0, 50)}...`);
  
  // Test IMAP connection briefly
  console.log(`\n[Bridge] Starting IMAP listener...`);
  console.log(`[Bridge] Press Ctrl+C to stop.\n`);
  
  await imapListener.start();
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.on('SIGINT', async () => {
  console.log(`\n[Bridge] Shutting down gracefully...`);
  await imapListener.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`\n[Bridge] Shutting down on SIGTERM...`);
  await imapListener.stop();
  process.exit(0);
});

// ─── Start ────────────────────────────────────────────────────────────────────

start().catch(error => {
  console.error(`[Bridge] Fatal error:`, error);
  process.exit(1);
});