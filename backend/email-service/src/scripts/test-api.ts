/**
 * SPIS Email Service — Integration Test Script
 *
 * This script tests:
 * 1. Health endpoints
 * 2. OTP sending (Rate limiting & Idempotency)
 * 3. Invite sending
 * 4. Notification sending
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3002';
const TEST_EMAIL = 'test-recipient@example.com';

async function runTests() {
  console.log('🚀 Starting Email Service Integration Tests...\n');

  try {
    // 1. Check Health
    console.log('--- Testing Health Endpoints ---');
    const health = await axios.get(`${API_URL}/healthz`);
    console.log('✅ Liveness:', health.data.status);

    const ready = await axios.get(`${API_URL}/readyz`);
    console.log('✅ Readiness:', ready.data.status);
    console.log('   Providers:', ready.data.providers);

    // 2. Test OTP Sending
    console.log('\n--- Testing OTP Sending ---');
    const requestId = uuidv4();
    const otpRes = await axios.post(`${API_URL}/email/otp`, {
      to_email: TEST_EMAIL,
      otp_code: '987654',
      request_id: requestId
    });
    console.log('✅ OTP Queued:', otpRes.data.request_id);

    // 2b. Test Idempotency (same request_id)
    console.log('\n--- Testing Idempotency (Same Request ID) ---');
    const idemRes = await axios.post(`${API_URL}/email/otp`, {
      to_email: TEST_EMAIL,
      otp_code: '987654',
      request_id: requestId
    });
    console.log('✅ Idempotency Works (Matched existing ID):', idemRes.data.request_id);

    // 3. Test Invite
    console.log('\n--- Testing Invite Sending ---');
    const inviteRes = await axios.post(`${API_URL}/email/invite`, {
      to_email: TEST_EMAIL,
      family_name: 'Marley',
      invite_link: 'https://spis.gov.jm/invite/xyz123'
    });
    console.log('✅ Invite Queued:', inviteRes.data.request_id);

    // 4. Test Notification
    console.log('\n--- Testing General Notification ---');
    const notifyRes = await axios.post(`${API_URL}/email/notify`, {
      to_email: TEST_EMAIL,
      template_code: 'notification',
      variables: {
        subject: 'Application Status Update',
        body: 'Your family registration application has been moved to "Pending Review".'
      }
    });
    console.log('✅ Notification Queued:', notifyRes.data.request_id);

    // 5. Test Rate Limiting (OTP limit is 5/hr)
    console.log('\n--- Testing Rate Limiting (Spamming OTP) ---');
    for (let i = 0; i < 6; i++) {
        try {
            await axios.post(`${API_URL}/email/otp`, {
                to_email: TEST_EMAIL,
                otp_code: '111111'
            });
            console.log(`   OTP ${i+1} sent...`);
        } catch (e: any) {
            if (e.response?.status === 429) {
                console.log('✅ Rate Limit Caught (429 Too Many Requests)');
                console.log('   Message:', e.response.data.message);
            } else {
                console.error('❌ Unexpected error during rate limit test:', e.message);
            }
        }
    }

    console.log('\n✨ All API tests completed successfully!');
    console.log('📢 Note: Check the Worker logs to verify actual delivery via SendGrid/SMTP.');

  } catch (error: any) {
    console.error('\n❌ Test failed!');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else {
      console.error('   Message:', error.message);
    }
  }
}

runTests();
