// Quick check for available Edge Functions
const SUPABASE_URL = 'https://nvgumhlewbqynrhlkqhx.supabase.co';

async function checkFunction(funcName) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${funcName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    
    const data = await response.json();
    console.log(`${funcName}: ${response.status} - ${JSON.stringify(data).substring(0, 100)}`);
    return response.status !== 404;
  } catch (error) {
    console.log(`${funcName}: ERROR - ${error.message}`);
    return false;
  }
}

async function checkAllFunctions() {
  console.log('Checking available Edge Functions...\n');
  
  const functions = [
    'send-password-reset',
    'send-magic-link',
    'get-consultation-slots',
    'refresh-voice-metrics',
  ];
  
  for (const func of functions) {
    const exists = await checkFunction(func);
    console.log(`${exists ? '✅' : '❌'} ${func}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between requests
  }
  
  console.log('\nDone!');
}

// Run if called directly
if (typeof require !== 'undefined' && require.main === module) {
  checkAllFunctions();
}

module.exports = { checkFunction, checkAllFunctions };