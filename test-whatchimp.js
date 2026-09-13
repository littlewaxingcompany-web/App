/**
 * WhatChimp integration tests.
 *
 * Run without credentials to verify the client + phone normalization:
 *   node test-whatchimp.js
 *
 * Run a real send once credentials are available:
 *   WHATCHIMP_API_TOKEN=... WHATCHIMP_PHONE_NUMBER_ID=... \
 *     node test-whatchimp.js --send +447700900000 "Hello from SalonStream 👋"
 *
 * Send via template:
 *   WHATCHIMP_API_TOKEN=... WHATCHIMP_PHONE_NUMBER_ID=... \
 *   WHATCHIMP_TEMPLATE_NAME=booking_confirmation \
 *     node test-whatchimp.js --send-template +447700900000
 */

require('dotenv').config();

const WhatChimpClient = require('./whatchimp-client');
const WhatChimpSender = require('./whatchimp-sender');

function parseArgs() {
  const args = { flags: [], values: {} };
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '--send' || raw[i] === '--send-template') {
      args.flags.push(raw[i]);
      if (i + 1 < raw.length && !raw[i + 1].startsWith('--')) {
        args.values.phone = raw[++i];
      }
      if (i + 1 < raw.length && !raw[i + 1].startsWith('--')) {
        args.values.text = raw[++i];
      }
    }
  }
  return args;
}

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return true;
  }
  console.log(`  ✗ ${label}`);
  return false;
}

async function main() {
  const args = parseArgs();

  console.log('WhatChimp Client — Unit Checks\n');

  const client = new WhatChimpClient({
    apiToken: 'test-token',
    phoneNumberId: 'test-phone-id',
    defaultCountryCode: '44',
  });

  let pass = 0;
  let total = 0;

  console.log('Phone normalization:');
  const cases = [
    ['07700 900000', '447700900000'],
    ['+44 7700 900000', '447700900000'],
    ['+447700900000', '447700900000'],
    ['919999999999', '919999999999'],
    ['(07) 700 900000', '447700900000'],
  ];
  for (const [input, expected] of cases) {
    total++;
    const got = client.normalizePhone(input);
    if (assert(got === expected, `"${input}" -> "${got}"`)) pass++;
  }

  console.log('\nMessage formatting (free-form path):');
  const sender = new WhatChimpSender({
    apiToken: 'test-token',
    phoneNumberId: 'test-phone-id',
  });
  total++;
  const msg = sender._formatMessage({
    client_name: 'Alex',
    service: 'Bikini Wax',
    date_appointment: 'June 20, 2026',
    time: '2:00 PM',
    location: 'Sunderland',
  });
  if (assert(msg.includes('Alex') && msg.includes('Bikini Wax') && msg.includes('Sunderland'),
    'formatted message contains name, service and location')) pass++;

  console.log(`\n${pass}/${total} unit checks passed.\n`);

  // ─── Optional live send ──────────────────────────────────────────────────
  const wantSend = args.flags.includes('--send') || args.flags.includes('--send-template');
  if (!wantSend) {
    console.log('No live send requested. Pass --send <phone> "<text>" or --send-template <phone>');
    console.log('after setting WHATCHIMP_API_TOKEN and WHATCHIMP_PHONE_NUMBER_ID to test live messaging.');
    process.exit(pass === total ? 0 : 1);
  }

  const token = process.env.WHATCHIMP_API_TOKEN;
  const phoneId = process.env.WHATCHIMP_PHONE_NUMBER_ID;
  const phone = args.values.phone;

  if (!token || !phoneId) {
    console.error('✗ Live send requires WHATCHIMP_API_TOKEN and WHATCHIMP_PHONE_NUMBER_ID env vars.');
    process.exit(1);
  }
  if (!phone) {
    console.error('✗ Live send requires a phone number argument.');
    process.exit(1);
  }

  const live = new WhatChimpSender({
    apiToken: token,
    phoneNumberId: phoneId,
    templateName: process.env.WHATCHIMP_TEMPLATE_NAME || '',
  });

  try {
    if (args.flags.includes('--send-template')) {
      console.log(`Sending template message to ${phone}...`);
      const res = await live.sendAppointment({
        phone,
        client_name: 'Test Client',
        service: 'Test Service',
        date_appointment: 'June 20, 2026',
        time: '2:00 PM',
        location: 'Sunderland',
      });
      console.log('Response:', JSON.stringify(res, null, 2));
    } else {
      console.log(`Sending text message to ${phone}...`);
      const res = await live.sendMessage(phone, args.values.text || 'Hello from SalonStream 👋');
      console.log('Response:', JSON.stringify(res, null, 2));
    }
    console.log('\n✓ Live send completed.');
  } catch (error) {
    console.error('✗ Live send failed:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
