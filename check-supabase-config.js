// Supabase Configuration Check Script
// Run with: node check-supabase-config.js

const SUPABASE_URL = 'https://nvgumhlewbqynrhlkqhx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52Z3VtaGxld2JxeW5yaGxrcWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MTQzNTcsImV4cCI6MjA4MzM5MDM1N30.OQb2wiXmof5xneC_HTorjnguBmfA19yghSluozTvmKU';

async function checkConfiguration() {
  console.log('🔍 Checking Supabase Configuration...\n');
  
  // 1. Check basic connection
  console.log('1. Testing Supabase connection...');
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    console.log(`   ✅ Connection successful: ${response.status}`);
  } catch (error) {
    console.log(`   ❌ Connection failed: ${error.message}`);
  }
  
  // 2. Check auth configuration for magic links
  console.log('\n2. Testing magic link configuration...');
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        type: 'magiclink',
        options: {
          emailRedirectTo: 'https://customwebsitesplus.com/back-office'
        }
      }),
    });
    
    const data = await response.json();
    console.log(`   Response: ${response.status}`);
    
    if (response.status === 200 || response.status === 201) {
      console.log('   ✅ Magic links are configured');
    } else if (response.status === 400 && data.msg?.includes('email signup')) {
      console.log('   ❌ Email signup is disabled in Supabase');
      console.log('   Fix: Enable "Enable email signup" in Supabase Dashboard → Authentication → Settings');
    } else if (response.status === 400 && data.msg?.includes('SMTP')) {
      console.log('   ❌ SMTP is not configured');
      console.log('   Fix: Configure SMTP in Supabase Dashboard → Authentication → SMTP Settings');
    } else {
      console.log('   ⚠️  Auth response:', JSON.stringify(data).substring(0, 200));
    }
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
  }
  
  // 3. Check password reset configuration
  console.log('\n3. Testing password reset configuration...');
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        redirectTo: 'https://customwebsitesplus.com/login?reset=1'
      }),
    });
    
    const data = await response.json();
    console.log(`   Response: ${response.status}`);
    
    if (response.status === 200 || response.status === 201) {
      console.log('   ✅ Password reset is configured');
    } else if (response.status === 400 && data.msg?.includes('disabled')) {
      console.log('   ❌ Password recovery is disabled');
    } else {
      console.log('   ⚠️  Response:', JSON.stringify(data).substring(0, 200));
    }
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
  }
  
  // 4. Check Edge Functions
  console.log('\n4. Checking Edge Functions...');
  const functions = [
    { name: 'send-password-reset', required: true },
    { name: 'send-magic-link', required: false },
    { name: 'get-consultation-slots', required: false },
  ];
  
  for (const func of functions) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${func.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      });
      
      const status = response.status;
      const icon = status === 404 ? '❌' : (status >= 200 && status < 300 ? '✅' : '⚠️');
      console.log(`   ${icon} ${func.name}: ${status} ${func.required ? '(REQUIRED)' : '(optional)'}`);
      
      if (status === 404 && func.required) {
        console.log(`      → Deploy with: supabase functions deploy ${func.name} --project-ref nvgumhlewbqynrhlkqhx`);
      }
    } catch (error) {
      console.log(`   ❌ ${func.name}: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300)); // Delay between requests
  }
  
  console.log('\n=== SUMMARY ===');
  console.log('\nRequired Actions:');
  console.log('1. Check Supabase Auth Settings:');
  console.log('   - Go to Supabase Dashboard → Authentication → Settings');
  console.log('   - Enable "Enable email signup"');
  console.log('   - Configure Site URL: https://customwebsitesplus.com');
  console.log('\n2. Configure Email:');
  console.log('   Option A: Use Supabase Email (free tier)');
  console.log('   Option B: Configure SMTP with your email provider');
  console.log('   Option C: Use Resend API (requires RESEND_API_KEY in Edge Functions)');
  console.log('\n3. Deploy Missing Functions:');
  console.log('   supabase functions deploy send-magic-link --project-ref nvgumhlewbqynrhlkqhx');
  console.log('\n4. Set Environment Variables:');
  console.log('   In Supabase Dashboard → Edge Functions → Environment Variables');
  console.log('   - SITE_URL: https://customwebsitesplus.com');
  console.log('   - (Optional) RESEND_API_KEY for custom emails');
}

// Run the check
checkConfiguration().catch(console.error);