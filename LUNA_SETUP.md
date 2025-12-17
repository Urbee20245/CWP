# Luna AI Chat Agent Setup Guide

## Current Status
Luna AI is configured as a text-based chat agent and requires a Google Gemini API key to function.

---

## How to Set Up Luna AI in Vercel

### Step 1: Get Your Gemini API Key

1. Go to: **https://aistudio.google.com/**
2. Sign in with your Google account
3. Click **"Get API Key"** (top right)
4. Create a new API key or use existing
5. Copy the key (it starts with `AIzaSy...`)
6. Keep this key secure!

### Step 2: Add to Vercel Environment Variables

1. Go to your **Vercel Dashboard**
2. Select your project: **CWP**
3. Click **Settings** (top navigation)
4. Click **Environment Variables** (left sidebar)
5. Click **Add New** button

**Add this variable:**
```
Name:   VITE_GEMINI_API_KEY
Value:  AIzaSy... (paste your actual key)

Optional:
Name:   VITE_GEMINI_MODEL
Value:  gemini-2.0-flash-exp (or your preferred model)
```

6. Select environments:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development

7. Click **Save**

### Step 3: Redeploy

**IMPORTANT:** Environment variable changes require a redeploy!

**Option A: Automatic (if you push new code)**
- Git push will trigger auto-deploy

**Option B: Manual Redeploy**
1. Go to **Deployments** tab in Vercel
2. Find the latest deployment
3. Click the **...** menu
4. Click **Redeploy**
5. Wait 2-3 minutes

### Step 4: Test Luna

1. Wait for deployment to complete
2. Go to your live site
3. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
4. Click **"Chat with Luna"** (bottom-right)
5. Open browser console (F12)
6. Click **"Start Conversation"**
7. Check console logs

---

## Debugging Luna

### Open Browser Console
```
Windows/Linux: Press F12
Mac: Cmd + Option + I
Click "Console" tab
```

### What You Should See (Success):
```
✅ Luna AI session started successfully!
```

### What You Might See (API Key Missing):
```
❌ Luna AI Error: API Key not found
```

---

## Common Issues & Solutions

### Issue 1: "API Key check: Missing ❌"

**Cause:** API key not set in Vercel or deployment needed

**Solution:**
1. Verify `VITE_GEMINI_API_KEY` exists in Vercel
2. Check spelling: `VITE_GEMINI_API_KEY` (not GEMINI_API_KEY)
3. Verify it's enabled for Production
4. **Redeploy** the site (must do this!)
5. Wait 2-3 minutes
6. Hard refresh browser
7. Try again

### Issue 2: "Microphone access denied"

**Cause:** Browser blocked microphone permission

**Chrome/Edge Solution:**
1. Click 🔒 lock icon in address bar
2. Find "Microphone"
3. Change to "Allow"
4. Refresh page
5. Try again

**Firefox Solution:**
1. Click 🔒 in address bar
2. Click "More Information"
3. "Permissions" tab
4. "Use the Microphone" → Allow
5. Refresh and try

### Issue 3: "No microphone found"

**Cause:** No microphone connected

**Solution:**
1. Connect microphone/headset
2. Check system sound settings
3. Test mic in other apps first
4. Try different browser

### Issue 4: API Key is Set but Still Missing

**Vercel-Specific Issue:**

The problem is likely that Vercel's environment variables need the `VITE_` prefix to be exposed to the browser.

**Double-check in Vercel:**
- Variable name: `VITE_GEMINI_API_KEY` ✅ (with VITE_ prefix)
- NOT: `GEMINI_API_KEY` ❌ (without prefix won't work)

**After adding/changing:**
1. Must click "Save"
2. Must redeploy
3. Must wait for deployment to complete
4. Must hard refresh browser

---

## Vercel Environment Variable Checklist

Make sure you have:
- [ ] Variable name is exactly: `VITE_GEMINI_API_KEY`
- [ ] Value starts with `AIzaSy...`
- [ ] No extra spaces in the value
- [ ] Enabled for **Production** environment
- [ ] Clicked **Save** button
- [ ] **Redeployed** the site after adding
- [ ] Waited 2-3 minutes for deployment
- [ ] Hard refreshed browser (Ctrl+Shift+R)

---

## API Key Security

### Restrictions (Recommended):
1. Go to Google Cloud Console
2. Find your API key
3. Add restrictions:
   - Application restrictions: HTTP referrers
   - Add your domain: `*.vercel.app/*` and `customwebsitesplus.com/*`
   - API restrictions: Only allow Gemini AI API

### Keep It Safe:
- ✅ Never commit to Git
- ✅ Only in Vercel environment variables
- ✅ Use `.env` for local development (not tracked)
- ✅ Add restrictions in Google Cloud Console

---

## Local Development Setup

If you want to test Luna locally:

1. Create `.env` file in project root:
```env
VITE_GEMINI_API_KEY=AIzaSy_your_actual_key_here
```

2. Restart dev server:
```bash
npm run dev
```

3. Open http://localhost:3000
4. Test Luna

---

## Still Not Working?

### Send These Details:

1. **Console Log Screenshot:**
   - Open F12 → Console
   - Click "Start Conversation"
   - Screenshot all messages

2. **Vercel Environment Variables Screenshot:**
   - Settings → Environment Variables
   - Show the variable name (blur the value!)

3. **Deployment Status:**
   - Is deployment successful?
   - Any errors in deployment logs?

4. **API Key First Characters:**
   - Does it start with `AIzaSy`?
   - Is it 39 characters long?

With this info, I can pinpoint the exact issue!

---

## Contact for Help

If Luna still doesn't work after following all steps:
- 📞 Call: (404) 532-9266
- ✉️ Email: hello@customwebsitesplus.com
- Include console screenshots
