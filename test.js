/**
 * Test script for SalonStream Bridge — Email Parser Edition
 * 
 * Tests the email parser with sample booking emails to verify
 * field extraction works correctly.
 * 
 * Usage:
 *   node test.js
 */

require('dotenv').config();
const EmailParser = require('./email-parser');

// Sample booking confirmation email based on the expected template
const SAMPLE_BOOKING_EMAIL = `New Booking Confirmation

Location: Downtown Salon & Spa
Date: June 15, 2026
Service: Brazilian Wax - Full
Time: 2:30 PM

Client Info:
Name: Jane Smith
Phone: +1 (555) 123-4567

This is the number we have on file for appointment reminders.

Thank you for choosing us!`;

// Sample with slightly different formatting
const SAMPLE_BOOKING_EMAIL_2 = `Booking Reminder

Location: Uptown Studio
Date: 2026-06-20
Service: Eyebrow Threading
Time: 10:00 AM
Staff: Sarah

Contact:
(555) 987-6543 is the number we have on file.

See you soon!`;

// Non-booking email (should be filtered out)
const SAMPLE_NON_BOOKING = `Hey team, just a reminder about the staff meeting tomorrow at 9am. Bring your ideas!`;

async function run() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     SalonStream Email Parser Test                    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const parser = new EmailParser();

  // Test 1: Sample booking email
  console.log('Test 1: Parse booking confirmation email');
  const result1 = parser.parse({
    subject: 'New Booking Confirmation - Appointment #12345',
    text: SAMPLE_BOOKING_EMAIL,
    from: { text: 'bookings@salon.com' },
    date: new Date(),
  });
  console.log('  Location:', result1.location);
  console.log('  Date:', result1.date_appointment);
  console.log('  Service:', result1.service);
  console.log('  Time:', result1.time);
  console.log('  Phone:', result1.phone);
  
  const pass1 = result1.location === 'Downtown Salon & Spa'
    && result1.service === 'Brazilian Wax - Full'
    && result1.phone && result1.phone.includes('555');
  
  console.log(`  Result: ${pass1 ? '✓ PASS' : '✗ FAIL'}\n`);

  // Test 2: Alternate format
  console.log('Test 2: Parse alternate booking format');
  const result2 = parser.parse({
    subject: 'Booking Reminder',
    text: SAMPLE_BOOKING_EMAIL_2,
    from: { text: 'noreply@studio.com' },
    date: new Date(),
  });
  console.log('  Location:', result2.location);
  console.log('  Date:', result2.date_appointment);
  console.log('  Service:', result2.service);
  console.log('  Time:', result2.time);
  console.log('  Phone:', result2.phone);
  
  const pass2 = result2.location === 'Uptown Studio'
    && result2.service === 'Eyebrow Threading'
    && result2.phone && result2.phone.includes('987');
  
  console.log(`  Result: ${pass2 ? '✓ PASS' : '✗ FAIL'}\n`);

  // Test 3: Non-booking email filter
  console.log('Test 3: Non-booking email filtering');
  const result3 = parser.parse({
    subject: 'Staff Meeting Reminder',
    text: SAMPLE_NON_BOOKING,
    from: { text: 'manager@salon.com' },
    date: new Date(),
  });
  const isBooking = parser.isBookingEmail({
    subject: 'Staff Meeting Reminder',
    text: SAMPLE_NON_BOOKING,
  });
  console.log(`  Is booking email: ${isBooking}`);
  console.log(`  Result: ${!isBooking ? '✓ PASS (correctly filtered)' : '✗ FAIL'}\n`);

  // Summary
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log(`║  Summary: ${pass1 && pass2 && !isBooking ? 'All tests PASSED' : 'Some tests FAILED'}          ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
}

run().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});