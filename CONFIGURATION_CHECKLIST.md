# SUPABASE AUTH CONFIGURATION CHECKLIST

## ✅ COMPLETED
- [x] Login page updated with magic link UI
- [x] Password reset function enhanced with fallbacks
- [x] Magic link function created locally
- [x] Error handling improved in frontend

## ⚠️ REQUIRED CONFIGURATION (DO THESE NOW)

### 1. SUPABASE AUTHENTICATION SETTINGS
**Location:** Supabase Dashboard → Authentication → Settings

**Required Settings:**
- [ ] **Enable email signup:** Toggle ON
- [ ] **Site URL:** `https://customwebsitesplus.com`
- [ ] **Additional Redirect URLs:** `http://localhost:3000`
- [ ] **Email Provider:** Configure one of:
  - [ ] Supabase Email (easiest)
  - [ ] SMTP (Gmail, SendGrid, etc.)
  - [ ] Resend API (via Edge Functions)

### 2. EDGE FUNCTION DEPLOYMENT
**Location:** Terminal / Command Line

**Required Actions:**
- [ ] **Install Supabase CLI:** `npm install -g supabase`
- [ ] **Login to Supabase:** `supabase login`
- [ ] **Deploy missing function:** `supabase functions deploy send-magic-link --project-ref nvgumhlewbqynrhlkqhx`

### 3. ENVIRONMENT VARIABLES
**Location:** Supabase Dashboard → Edge Functions → Environment Variables

**Required Variables:**
- [ ] `SITE_URL` = `https://customwebsitesplus.com`

**Optional (for custom emails):**
- [ ] `RESEND_API_KEY` = Your Resend API key
- [ ] `SMTP_FROM_EMAIL` = `noreply@customwebsitesplus.com`
- [ ] `SMTP_FROM_NAME` = `"Custom Websites Plus"`

## 🔧 TESTING PROCEDURE

### Test 1: Configuration Check
```bash
node check-supabase-config.js
```
**Expected Output:**
- ✅ Connection successful
- ✅ Magic links are configured
- ✅ Password reset is configured
- ✅ send-magic-link: 200 (not 404)

### Test 2: Browser Test
1. Go to `https://customwebsitesplus.com/login`
2. Click "Prefer a magic link?"
3. Enter your email
4. **Expected:** "Magic link sent! Check your email..."
5. **Not Expected:** CORS errors or "Failed to send request"

### Test 3: Email Delivery
1. Check email inbox
2. Look for magic link email
3. Click link
4. **Expected:** Redirected to back-office dashboard

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue: "CORS preflight response did not succeed. Status code: 404"
**Cause:** Edge Function not deployed
**Solution:** Deploy `send-magic-link` function

### Issue: "Error sending magic link email"
**Cause:** Supabase email not configured
**Solution:** Configure email in Supabase Auth Settings

### Issue: Emails not arriving
**Cause:** Email provider not working
**Solutions:**
1. Check spam folder
2. Verify email configuration
3. Try different email address
4. Use Supabase Email instead of SMTP

### Issue: "Failed to send a request to the Edge Function"
**Cause:** Network or CORS issue
**Solution:** The fallback should work. If not, check:
1. Browser console for details
2. Network tab for failed requests
3. Supabase Edge Function logs

## 📞 SUPPORT INFORMATION

If stuck, provide:
1. Output of `node check-supabase-config.js`
2. Screenshot of Supabase Auth Settings
3. Browser console errors
4. URL you're testing from

## ⏱️ ESTIMATED TIME

- **Initial setup:** 15-20 minutes
- **Testing:** 5-10 minutes
- **Troubleshooting:** 10-30 minutes (if needed)

## 🎯 SUCCESS CRITERIA

- Users can request magic links without errors
- Magic link emails arrive in inbox
- Clicking magic link logs user in
- Password reset works via both methods
- No CORS errors in console

## 🔄 FALLBACK SYSTEM

The system now has robust fallbacks:
1. **Primary:** Custom Edge Function with Resend API
2. **Fallback 1:** Supabase built-in magic link/password reset
3. **Fallback 2:** User-friendly error messages
4. **Fallback 3:** Password login always available

Even if Edge Functions fail, authentication should still work via Supabase's built-in methods.
