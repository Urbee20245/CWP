# IMMEDIATE FIXES FOR AUTHENTICATION ERRORS

## Current Errors:
1. ❌ "Cross-Origin Request Blocked: CORS preflight response did not succeed. Status code: 404"
2. ❌ "Edge Function error: FunctionsFetchError: Failed to send a request to the Edge Function"
3. ❌ "Magic link error: AuthApiError: Error sending magic link email"

## Root Causes:
1. The `send-magic-link` Edge Function is NOT DEPLOYED (404 error)
2. Supabase Auth email configuration is NOT SET UP
3. CORS issues because function doesn't exist

## STEP-BY-STEP SOLUTION:

### STEP 1: Configure Supabase Authentication (MOST IMPORTANT)

Go to: **Supabase Dashboard → Authentication → Settings**

#### A. Enable Email Auth:
1. Scroll to "Enable email signup"
2. Toggle it ON
3. Save changes

#### B. Configure Site URL:
1. Find "Site URL" field
2. Set to: `https://customwebsitesplus.com`
3. Also add: `http://localhost:3000` for development
4. Save changes

#### C. Configure Email Provider (Choose ONE):

**Option A: Use Supabase Email (Easiest)**
1. Go to "Email Templates"
2. Ensure "Confirm signup", "Invite user", "Magic link", "Recovery" templates exist
3. Customize if needed

**Option B: Configure SMTP (Recommended for production)**
1. Go to "SMTP Settings"
2. Enter your email provider details (Gmail, SendGrid, etc.)
3. Test configuration

### STEP 2: Deploy Missing Edge Function

Run in terminal:
```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Deploy the missing function
supabase functions deploy send-magic-link --project-ref nvgumhlewbqynrhlkqhx
```

### STEP 3: Set Environment Variables

Go to: **Supabase Dashboard → Edge Functions → Environment Variables**

Add these variables:
```env
# Required
SITE_URL=https://customwebsitesplus.com

# Optional (for custom emails via Resend)
RESEND_API_KEY=your_resend_api_key_here
SMTP_FROM_EMAIL=noreply@customwebsitesplus.com
SMTP_FROM_NAME="Custom Websites Plus"
```

### STEP 4: Test Configuration

Run the diagnostic script:
```bash
node check-supabase-config.js
```

Expected output:
- ✅ Connection successful
- ✅ Magic links are configured  
- ✅ Password reset is configured
- ✅ send-password-reset: 200
- ✅ send-magic-link: 200

### STEP 5: Test in Browser

1. Go to `https://customwebsitesplus.com/login`
2. Click "Prefer a magic link?"
3. Enter your email
4. Should see: "Magic link sent! Check your email..."
5. Check email for magic link

## TROUBLESHOOTING:

### If still getting CORS errors:
The function `send-magic-link` is still not deployed. Deploy it using Step 2.

### If getting "Error sending magic link email":
Supabase email is not configured. Complete Step 1C.

### If emails not arriving:
1. Check spam folder
2. Verify email configuration in Supabase
3. Test with different email provider

## QUICK FIX (Temporary):

If you need auth working immediately while fixing configuration:

1. **Disable magic links temporarily:**
   Edit `src/pages/Login.tsx` and comment out the magic link section
   
2. **Use password login only:**
   Ensure users have passwords set
   
3. **Manual password reset:**
   As admin, you can reset passwords in Supabase Dashboard → Authentication → Users

## VERIFICATION CHECKLIST:

- [ ] Supabase → Authentication → Settings → "Enable email signup" is ON
- [ ] Site URL is set to `https://customwebsitesplus.com`
- [ ] Email provider is configured (Supabase Email or SMTP)
- [ ] `send-magic-link` function is deployed (status 200, not 404)
- [ ] Environment variables are set in Edge Functions
- [ ] Can send test magic link via Supabase Dashboard

## SUPPORT:

If issues persist after completing all steps:

1. Share output of: `node check-supabase-config.js`
2. Screenshot of Supabase Auth Settings
3. Browser console errors
4. Supabase Edge Function logs

## EXPECTED TIMELINE:

- **5 minutes:** Configure Supabase Auth
- **2 minutes:** Deploy Edge Function  
- **3 minutes:** Set environment variables
- **5 minutes:** Test and verify
- **Total: ~15 minutes**

Your authentication will work once Supabase email is configured and the missing function is deployed.
