// Test script for authentication functions
// Run with: node test-auth-functions.js

const SUPABASE_URL = 'https://nvgumhlewbqynrhlkqhx.supabase.co';

async function testPasswordReset() {
  console.log('Testing password reset function...');
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'test@example.com',
      redirect_to: 'https://customwebsitesplus.com/login?reset=1',
    }),
  });
  
  const data = await response.json();
  console.log('Password reset response:', {
    status: response.status,
    data,
  });
}

async function testMagicLink() {
  console.log('\nTesting magic link function...');
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-magic-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'test@example.com',
    }),
  });
  
  const data = await response.json();
  console.log('Magic link response:', {
    status: response.status,
    data,
  });
}

async function runTests() {
  try {
    await testPasswordReset();
    await testMagicLink();
    console.log('\n✅ Tests completed. Check Supabase Edge Function logs for details.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runTests();
}

module.exports = { testPasswordReset, testMagicLink };