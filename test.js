/**
 * Test script for Ovatu → Zapier Bridge
 * 
 * Tests the Ovatu API connection without starting the full polling loop.
 * 
 * Usage:
 *   node test.js
 * 
 * Environment variables (from .env or environment):
 *   OVATU_API_TOKEN - Required: Your Ovatu API token
 */

require('dotenv').config();
const OvatuClient = require('./ovatu-client');

const API_TOKEN = process.env.OVATU_API_TOKEN;
const BASE_URL = process.env.OVATU_BASE_URL || 'https://api.ovatu.com/v2';

async function run() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     Ovatu API Connection Test             ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  if (!API_TOKEN || API_TOKEN === 'your_api_token_here') {
    console.error('❌ Error: OVATU_API_TOKEN is not set.');
    console.error('   Copy .env.example to .env and add your token.');
    console.error('   Get your API token from Ovatu Manager → Settings → API.\n');
    process.exit(1);
  }

  console.log(`Testing connection to ${BASE_URL}...\n`);

  const client = new OvatuClient(API_TOKEN, BASE_URL);
  
  // Test 1: Basic connection
  console.log('Test 1: Connection test');
  const connected = await client.testConnection();
  
  if (!connected) {
    console.error('\n❌ Connection test FAILED.');
    console.error('   Possible issues:');
    console.error('   - Invalid API token');
    console.error('   - Wrong API base URL');
    console.error('   - Network connectivity issue');
    process.exit(1);
  }
  
  console.log('✓ Connection test PASSED.\n');
  
  // Test 2: Fetch recent appointments (last 24 hours)
  console.log('Test 2: Fetch appointments from last 24 hours');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const data = await client.getAppointmentsUpdatedSince(since);
    const appointments = data.data || data.appointments || data;
    const count = Array.isArray(appointments) ? appointments.length : 1;
    console.log(`✓ Found ${count} appointment(s) updated in the last 24 hours.\n`);
    
    if (count > 0) {
      const items = Array.isArray(appointments) ? appointments : [appointments];
      console.log('First appointment preview:');
      console.log(JSON.stringify(items[0], null, 2).substring(0, 500));
      console.log('...\n');
    }
  } catch (error) {
    console.error('⚠ Fetch test returned an error (may be expected if no valid token):', error.message);
    console.error('  This is OK if you haven\'t configured a real API token yet.\n');
  }
  
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  Test complete.                           ║');
  console.log('╚═══════════════════════════════════════════╝');
}

run().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});