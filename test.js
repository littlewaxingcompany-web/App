#!/usr/bin/env node

/**
 * Test script for SalonStream Bridge
 * Tests the email parser with the Ovatu booking email template.
 * 
 * Usage:
 *   node test.js              # Run all tests
 *   node test.js --json       # Output results as JSON
 */

require('dotenv').config();
const fs = require('fs');
const EmailParser = require('./email-parser');

// Sample booking email based on the owner's template
const SAMPLE_BOOKING = `Thank you so much for booking! I know this seems a lengthy email for a Brazilian wax but please read to get the most from your wax and most importantly to make sure you are in the right place as we now have TWO locations.

Here are the details of your appointment/s
Location: Sunderland
Date: June 20, 2026
Service: Brazilian Wax - Full
Time: 2:30 PM

07700900000 is the number we have on file for you. All contact will be sent to this number via WhatsApp.

Looking forward to seeing you soon!
Sophie at The Little Waxing Company`;

// Sample with Chester-Le-Street location
const SAMPLE_BOOKING_2 = `Here are the details of your appointment/s
Location: Chester-Le-St
Date: June 22, 2026
Service: Eyebrow Threading
Time: 10:00 AM

07400000000 is the number we have on file for you.`;

// Non-booking email (staff meeting)
const SAMPLE_NON_BOOKING = `Hey team, staff meeting tomorrow at 9am. Bring your ideas!`;

// Email with wrong sender but valid format
const SAMPLE_WRONG_SENDER = `Location: Test
Date: June 1, 2026
Service: Test
Time: 12:00
0000000000 is the number we have on file for you.`;

async function run() {
  const parser = new EmailParser();
  const useJson = process.argv.includes('--json');
  
  const tests = [];
  
  // Test 1: Full booking email with correct sender and subject
  const t1 = { name: 'Full booking email (correct sender/subject)' };
  const t1Result = parser.processEmail({
    subject: 'Thankyou for your booking at the Little Waxing Company',
    from: 'reservations@ovatu.com',
    text: SAMPLE_BOOKING,
  });
  t1.pass = t1Result && t1Result.location === 'Sunderland' && t1Result.phone === '07700900000';
  t1.details = t1Result || 'filtered out';
  tests.push(t1);
  
  // Test 2: Second location format
  const t2 = { name: 'Alternate location format' };
  const t2Result = parser.processEmail({
    subject: 'Thankyou for your booking at the Little Waxing Company',
    from: 'reservations@ovatu.com',
    text: SAMPLE_BOOKING_2,
  });
  t2.pass = t2Result && t2Result.location === 'Chester-Le-St' && t2Result.phone === '07400000000';
  t2.details = t2Result || 'filtered out';
  tests.push(t2);
  
  // Test 3: Non-booking email (should be filtered)
  const t3 = { name: 'Non-booking filtered out' };
  const t3Result = parser.processEmail({
    subject: 'Staff Meeting Reminder',
    from: 'manager@salon.com',
    text: SAMPLE_NON_BOOKING,
  });
  t3.pass = t3Result === null;
  t3.details = t3Result || 'correctly filtered';
  tests.push(t3);
  
  // Test 4: Wrong sender but valid booking content
  const t4 = { name: 'Wrong sender filtered out' };
  const t4Result = parser.processEmail({
    subject: 'Thankyou for your booking at the Little Waxing Company',
    from: 'someone@example.com',
    text: SAMPLE_BOOKING,
  }, { sender: 'reservations@ovatu.com' }); // enforce sender filter
  t4.pass = t4Result === null;
  t4.details = t4Result || 'correctly filtered (wrong sender)';
  tests.push(t4);
  
  // Test 5: Phone on same line as "is the number we have on file"
  const t5 = { name: 'Phone on same line as identifier' };
  const t5Result = parser.processEmail({
    subject: 'Thankyou for your booking at the Little Waxing Company',
    from: 'reservations@ovatu.com',
    text: `Location: London
Date: July 1, 2026
Service: Manicure
Time: 3:00 PM

07500123456 is the number we have on file for you.`,
  });
  t5.pass = t5Result && t5Result.phone === '07500123456';
  t5.details = t5Result || 'filtered out';
  tests.push(t5);
  
  // Report
  let passed = 0;
  let failed = 0;
  
  if (useJson) {
    console.log(JSON.stringify(tests, null, 2));
  } else {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║     SalonStream Bridge - Test Suite                 ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    
    for (const test of tests) {
      const status = test.pass ? '✓ PASS' : '✗ FAIL';
      console.log(`${status} | ${test.name}`);
      if (test.pass) passed++; else failed++;
    }
    
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Results: ${passed}/${tests.length} passed`);
    if (failed > 0) console.log(`${failed} test(s) FAILED`);
    console.log(`All tests: ${failed === 0 ? '✓ PASSED' : '✗ FAILED'}`);
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});