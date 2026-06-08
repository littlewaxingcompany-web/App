/**
 * Ovatu → Zapier Bridge
 * 
 * Polls Ovatu API for new/updated appointments and forwards them
 * to Zapier webhooks, enabling WhatsApp message automation.
 * 
 * Usage:
 *   1. Copy .env.example to .env and fill in credentials
 *   2. npm install
 *   3. npm start
 */

require('dotenv').config();
const OvatuClient = require('./ovatu-client');
const WebhookSender = require('./webhook-sender');

// ─── Configuration ────────────────────────────────────────────────────────────

const config = {
  apiToken: process.env.OVATU_API_TOKEN,
  baseUrl: process.env.OVATU_BASE_URL || 'https://api.ovatu.com/v2',
  webhookUrl: process.env.ZAPIER_WEBHOOK_URL,
  pollIntervalMs: (parseInt(process.env.POLL_INTERVAL_SECONDS, 10) || 60) * 1000,
};

// Validate required config
const required = ['apiToken', 'webhookUrl'];
for (const key of required) {
  if (!config[key]) {
    console.error(`[Bridge] ERROR: Missing required environment variable: ${key}`);
    console.error(`[Bridge] Please set ${key === 'apiToken' ? 'OVATU_API_TOKEN' : 'ZAPIER_WEBHOOK_URL'} in .env`);
    process.exit(1);
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

// Track the last poll timestamp for incremental fetching
let lastPollTimestamp = new Date().toISOString();
let pollCount = 0;

// ─── Initialize Clients ───────────────────────────────────────────────────────

const ovatu = new OvatuClient(config.apiToken, config.baseUrl);
const webhook = new WebhookSender(config.webhookUrl);

// ─── Polling Logic ────────────────────────────────────────────────────────────

/**
 * Single poll iteration: fetch recent appointments and forward to Zapier.
 */
async function poll() {
  pollCount++;
  const startTime = Date.now();
  
  try {
    console.log(`\n[Bridge] ─── Poll #${pollCount} ───────────────────────`);
    console.log(`[Bridge] Polling appointments since: ${lastPollTimestamp}`);
    
    // Fetch appointments updated since last poll
    const response = await ovatu.getAppointmentsUpdatedSince(lastPollTimestamp);
    
    // Extract appointments from response
    // Ovatu likely returns { data: [...] } or { appointments: [...] }
    const appointments = response.data || response.appointments || response;
    
    if (!appointments || (Array.isArray(appointments) && appointments.length === 0)) {
      console.log('[Bridge] No new/updated appointments found.');
    } else {
      const items = Array.isArray(appointments) ? appointments : [appointments];
      console.log(`[Bridge] Found ${items.length} new/updated appointment(s).`);
      
      // Forward to Zapier webhook
      await webhook.sendAppointments(items);
    }
    
    // Update last poll timestamp to now (after successful poll)
    lastPollTimestamp = new Date().toISOString();
    
    const elapsed = Date.now() - startTime;
    console.log(`[Bridge] Poll completed in ${elapsed}ms`);
    console.log(`[Bridge] Next poll in ${config.pollIntervalMs / 1000}s`);
    
  } catch (error) {
    console.error(`[Bridge] Poll failed:`, error.message);
    // Don't update lastPollTimestamp on failure, so we retry the same window
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start() {
  console.log(`╔══════════════════════════════════════════════════════╗`);
  console.log(`║         Ovatu → Zapier Bridge                       ║`);
  console.log(`║         SalonStream                                 ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`\nConfiguration:`);
  console.log(`  Ovatu API URL: ${config.baseUrl}`);
  console.log(`  Zapier Webhook: ${config.webhookUrl.substring(0, 50)}...`);
  console.log(`  Poll Interval: ${config.pollIntervalMs / 1000}s`);
  console.log(`  Last Poll Timestamp: ${lastPollTimestamp}`);
  
  // Test connection to Ovatu API
  console.log(`\n[Bridge] Testing Ovatu API connection...`);
  const connected = await ovatu.testConnection();
  
  if (!connected) {
    console.error(`[Bridge] ⚠ Could not connect to Ovatu API.`);
    console.error(`[Bridge] Check that OVATU_API_TOKEN is valid.`);
    console.error(`[Bridge] The service will continue polling, but may fail.`);
  } else {
    console.log(`[Bridge] ✓ Ovatu API connection verified.`);
  }
  
  // Start polling loop
  console.log(`\n[Bridge] Starting polling loop...`);
  console.log(`[Bridge] Press Ctrl+C to stop.\n`);
  
  // Run first poll immediately
  await poll();
  
  // Schedule subsequent polls
  setInterval(poll, config.pollIntervalMs);
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log(`\n[Bridge] Shutting down gracefully...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n[Bridge] Shutting down on SIGTERM...`);
  process.exit(0);
});

// ─── Start ────────────────────────────────────────────────────────────────────

start().catch(error => {
  console.error(`[Bridge] Fatal error:`, error);
  process.exit(1);
});