# Authentication Functions Deployment Guide

## Updated/New Functions:
1. `send-password-reset` - Updated with better logging and fallback
2. `send-magic-link` - New function for magic link authentication

## Deployment Steps:

### 1. Deploy Edge Functions:
```bash
# Deploy password reset function
supabase functions deploy send-password-reset --project-ref nvgumhlewbqynrhlkqhx

# Deploy magic link function
supabase functions deploy send-magic-link --project-ref nvgumhlewbqynrhlkqhx
```

### 2. Set Required Environment Variables in Supabase Dashboard:
Go to: **Supabase Dashboard → Edge Functions → Environment Variables**

Add/Update these variables:
```env
# Resend API Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM_EMAIL=noreply@customwebsitesplus.com
SMTP_FROM_NAME="Custom Websites Plus"

# Site URL for redirects
SITE_URL=https://yourdomain.com

# Supabase credentials (should already be set)
SUPABASE_URL=https://nvgumhlewbqynrhlkqhx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. Test the Functions:

#### Test Password Reset:
```bash
curl -X POST https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/send-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "redirect_to": "https://yourdomain.com/login?reset=1"}'
```

#### Test Magic Link:
```bash
curl -X POST https://nvgumhlewbqynrhlkqwqhx.supabase.co/functions/v1/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 4. Check Logs:
Go to: **Supabase Dashboard → Edge Functions → Logs**
- Select `send-password-reset` or `send-magic-link`
- Look for the debug logs to verify environment variables are set correctly

## Troubleshooting:

### Issue: Emails not sending
1. Check if `RESEND_API_KEY` is set correctly
2. Verify the Resend API key has sending permissions
3. Check Supabase logs for error messages

### Issue: Functions not deploying
1. Make sure you're logged in: `supabase login`
2. Check project reference is correct
3. Ensure you have deployment permissions

### Issue: Magic links not working
1. Verify `SITE_URL` is set correctly
2. Check that the redirect URL matches your app's URL
3. Test with a real email address

## Features Implemented:

### Password Reset:
✅ Enhanced logging for debugging
✅ Resend API integration with custom HTML emails
✅ Fallback to Supabase SMTP if Resend fails
✅ Security: Returns success even on failure to prevent email enumeration

### Magic Link Authentication:
✅ New function for magic link generation
✅ Custom branded emails via Resend
✅ Fallback to Supabase's built-in magic link
✅ 24-hour expiration on magic links
✅ Secure redirect to back-office after login

## Next Steps:
1. Deploy the functions using the commands above
2. Set the environment variables in Supabase Dashboard
3. Test both password reset and magic link functionality
4. Monitor logs for any issues
5. Update your production environment variables
