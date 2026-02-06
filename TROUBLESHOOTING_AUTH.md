# Troubleshooting Authentication Issues

## Problem: "Failed to send a request to the Edge Function"

### Immediate Solutions:

### 1. Check Which Functions Are Deployed:
Run the check script:
```bash
node check-functions.js
```

Or manually test:
```bash
# Test password reset
curl -X POST https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/send-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Test magic link  
curl -X POST https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 2. Deploy Missing Functions:
If `send-magic-link` is missing:
```bash
# Option 1: Use the batch file
./deploy-magic-link.bat

# Option 2: Manual deployment
supabase functions deploy send-magic-link --project-ref nvgumhlewbqynrhlkqhx
```

### 3. Check Browser Console:
Open Developer Tools (F12) → Console tab
Look for errors when clicking "Send Magic Link" or "Send Reset Link"

### 4. Check Network Tab:
In Developer Tools → Network tab
1. Filter by "fetch" or "xhr"
2. Click the auth buttons
3. Look for failed requests (red status)
4. Click on failed requests to see details

## Common Issues & Fixes:

### Issue 1: Function Not Deployed
**Symptoms:** 404 error, "function not found"
**Fix:** Deploy the function using Supabase CLI

### Issue 2: CORS Errors
**Symptoms:** Network errors mentioning CORS
**Fix:** The Edge Functions already have CORS headers. If issues persist:
1. Check Supabase Dashboard → Edge Functions
2. Ensure CORS origins include your domain

### Issue 3: Environment Variables Missing
**Symptoms:** Function works but emails don't send
**Fix:** Set in Supabase Dashboard → Edge Functions → Environment Variables:
- `RESEND_API_KEY`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `SITE_URL`

### Issue 4: Authentication Token Issues
**Symptoms:** 401 errors
**Fix:** The functions use service role key. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set.

## Fallback System:
The updated code now has fallbacks:

### Password Reset Fallback:
1. Tries Edge Function first
2. Falls back to `supabase.auth.resetPasswordForEmail()`
3. Uses Supabase's built-in email system

### Magic Link Fallback:
1. Tries Edge Function first  
2. Falls back to `supabase.auth.signInWithOtp()`
3. Uses Supabase's built-in magic link

## Testing Steps:

1. **Test Password Reset:**
   - Go to `/login`
   - Click "Forgot your password?"
   - Enter test email
   - Check console for errors
   - Check Supabase logs

2. **Test Magic Link:**
   - Go to `/login`
   - Click "Prefer a magic link?"
   - Enter test email
   - Check console for errors
   - Check Supabase logs

3. **Check Logs:**
   - Supabase Dashboard → Edge Functions → Logs
   - Select function name
   - Look for debug messages

## Quick Fix Summary:

1. **Run deployment script:** `deploy-magic-link.bat`
2. **Set environment variables** in Supabase Dashboard
3. **Test with curl commands** above
4. **Check browser console** for specific errors
5. **Use fallback system** - already implemented in updated code

## If All Else Fails:

1. **Disable Edge Functions temporarily:**
   - Comment out the Edge Function calls in `Login.tsx`
   - Use only Supabase's built-in methods
   - Test if basic auth works

2. **Check Supabase Auth Settings:**
   - Go to Supabase Dashboard → Authentication → Settings
   - Ensure "Enable email signup" is on
   - Check SMTP configuration
   - Verify redirect URLs

3. **Test with simple curl:**
   ```bash
   # Test Supabase auth directly
   curl -X POST https://nvgumhlewbqynrhlkqhx.supabase.co/auth/v1/recover \
     -H "apikey: YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","redirect_to":"http://localhost:3000"}'
   ```

## Support:
If issues persist, provide:
1. Browser console errors
2. Network tab screenshots
3. Supabase Edge Function logs
4. Exact error messages
