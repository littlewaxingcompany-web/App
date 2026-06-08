#!/usr/bin/env node

/**
 * Inbox Agent — Bridge CLI Tool
 * 
 * Processes booking emails from a file/stdin or via direct text input.
 * Designed to be used by the agent with data obtained from listMessages/readMessage tools.
 * 
 * Usage:
 *   # Process from stdin
 *   cat email.txt | node inbox-agent.js --subject "Booking confirmation" --from "reservations@ovatu.com"
 *   
 *   # Process from a file
 *   node inbox-agent.js --file /tmp/email.txt --subject "Booking" --from "reservations@ovatu.com"
 *   
 *   # Process with inline body
 *   node inbox-agent.js --body "Location: ..." --subject "Booking confirmation" --from "reservations@ovatu.com"
 *   
 *   # Dry run (just parse, don't forward)
 *   node inbox-agent.js --file /tmp/email.txt --dry-run
 */

require('dotenv').config();
const fs = require('fs');
const EmailParser = require('./email-parser');
const WebhookSender = require('./webhook-sender');

function parseArgs() {
  const args = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith('--')) {
      const key = raw[i].replace('--', '');
      if (key === 'dry-run' || key === 'json') {
        args[key] = true;
      } else if (i + 1 < raw.length && !raw[i + 1].startsWith('--')) {
        args[key] = raw[++i];
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  
  const parser = new EmailParser();
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  const webhook = webhookUrl ? new WebhookSender(webhookUrl) : null;
  
  // Get email body
  let body = '';
  if (args.file) {
    body = fs.readFileSync(args.file, 'utf-8');
  } else if (args.body) {
    body = args.body.replace(/\\n/g, '\n');
  } else {
    // Read from stdin
    body = fs.readFileSync('/dev/stdin', 'utf-8');
  }
  
  // Build email data
  const emailData = {
    subject: args.subject || '(no subject)',
    from: args.from || '(unknown sender)',
    text: body,
    date: new Date(),
  };
  
  // Process through parser
  console.error(`[InboxAgent] Processing email: "${emailData.subject}" from ${emailData.from}`);
  
  const appointment = parser.processEmail(emailData);
  
  if (!appointment) {
    console.log(JSON.stringify({ status: 'filtered', reason: 'Not a booking email' }));
    process.exit(0);
  }
  
  // Forward if webhook is configured and not dry-run
  if (!args['dry-run'] && webhook) {
    console.error(`[InboxAgent] Forwarding to Zapier...`);
    try {
      const result = await webhook.sendAppointment(appointment);
      console.log(JSON.stringify({ status: 'forwarded', appointment, webhookResponse: result }));
    } catch (error) {
      console.error(`[InboxAgent] Forward failed: ${error.message}`);
      console.log(JSON.stringify({ status: 'forward_failed', appointment, error: error.message }));
    }
  } else {
    if (!webhook) {
      console.error(`[InboxAgent] No ZAPIER_WEBHOOK_URL configured (dry mode)`);
    }
    if (args['dry-run']) {
      console.error(`[InboxAgent] Dry run mode`);
    }
    // Output appointment as JSON
    console.log(JSON.stringify({ status: args['dry-run'] ? 'parsed_dry_run' : 'parsed_no_webhook', appointment }));
  }
}

main().catch(error => {
  console.error(`[InboxAgent] Fatal: ${error.message}`);
  process.exit(1);
});