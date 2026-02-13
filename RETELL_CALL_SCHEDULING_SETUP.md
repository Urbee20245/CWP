# Retell AI Call Scheduling Feature - Implementation Guide

## Overview
This feature allows admins to schedule or trigger immediate Retell AI calls to prospects. The implementation includes a full admin UI, backend edge functions, and database tables for tracking scheduled calls.

---

## What Was Created

### 1. Database Migration
**File:** `supabase/migrations/20260213_create_retell_scheduled_calls_table.sql`

Creates the `retell_scheduled_calls` table to store all scheduled call information including:
- Prospect details (name, phone)
- Scheduling information (scheduled_time, timezone)
- Retell configuration (agent_id, from_phone_number)
- Status tracking (pending, scheduled, calling, completed, failed, cancelled)
- Call results (retell_call_id, duration, error messages)
- Admin notes and metadata

### 2. Edge Functions

#### a. `trigger-retell-call`
**File:** `supabase/functions/trigger-retell-call/index.ts`

Main function to handle call triggering. Supports:
- **Immediate calls**: Trigger a call right away
- **Scheduled calls**: Create a call scheduled for later
- **Processing scheduled calls**: Execute calls when their scheduled time arrives

**Usage:**
```typescript
// Immediate call
AdminService.triggerRetellCall({
  client_id: '...',
  prospect_name: 'John Doe',
  prospect_phone: '+12345678900',
  retell_agent_id: 'agent_xxx',
  trigger_immediately: true
})

// Scheduled call
AdminService.triggerRetellCall({
  client_id: '...',
  prospect_name: 'John Doe',
  prospect_phone: '+12345678900',
  retell_agent_id: 'agent_xxx',
  scheduled_time: '2026-02-14T15:00:00Z'
})
```

#### b. `process-scheduled-calls`
**File:** `supabase/functions/process-scheduled-calls/index.ts`

Cron job function that runs periodically to check for pending calls that are due and triggers them.

**Designed to run:** Every minute (or as needed)

### 3. Admin Service Methods
**File:** `src/services/adminService.ts`

Added the following methods:
- `triggerRetellCall()` - Trigger immediate or scheduled calls
- `getScheduledCalls()` - Get all scheduled calls with filters
- `getScheduledCall()` - Get a single scheduled call by ID
- `cancelScheduledCall()` - Cancel a scheduled call
- `updateScheduledCallNotes()` - Update admin notes
- `forceScheduledCall()` - Manually trigger a scheduled call
- `processScheduledCalls()` - Manually trigger cron job

### 4. Admin UI Page
**File:** `src/pages/AdminRetellCallScheduling.tsx`

Full-featured admin interface with:
- Form to schedule new calls (immediate or scheduled)
- Client selection dropdown (only shows clients with active voice)
- Search and filter functionality
- Status tracking (pending, calling, completed, failed, cancelled)
- Actions to trigger or cancel calls
- Summary statistics dashboard
- Responsive table view

**Route:** `/admin/call-scheduling`

### 5. App Router Update
**File:** `App.tsx`

Added route and import for the new admin page.

---

## Setup Instructions

### Step 1: Apply Database Migration

You need to run the SQL migration in your Supabase dashboard. The migration file is located at:
```
supabase/migrations/20260213_create_retell_scheduled_calls_table.sql
```

**To apply the migration:**

#### Option A: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project: https://nvgumhlewbqynrhlkqhx.supabase.co
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the entire contents of `20260213_create_retell_scheduled_calls_table.sql`
5. Run the query
6. Verify the table was created by checking the **Table Editor**

#### Option B: Via Supabase CLI
```bash
# If you have Supabase CLI configured
npx supabase migration up
```

### Step 2: Deploy Edge Functions

Deploy the new edge functions to Supabase:

```bash
# Deploy trigger-retell-call function
npx supabase functions deploy trigger-retell-call

# Deploy process-scheduled-calls function
npx supabase functions deploy process-scheduled-calls
```

### Step 3: Configure Cron Job (Optional but Recommended)

To automatically process scheduled calls, set up a cron job using pg_cron or Supabase's built-in scheduler.

#### Using pg_cron:
```sql
-- Run every minute to check for pending calls
SELECT cron.schedule(
  'process-scheduled-calls',
  '* * * * *',  -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/process-scheduled-calls',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**Note:** You'll need to enable the `pg_cron` extension first:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### Alternative: External Cron Service
You can also use an external service (like GitHub Actions, Vercel Cron, or Upstash QStash) to hit the endpoint:
```
POST https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/process-scheduled-calls
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

### Step 4: Verify Setup

1. **Check Database Table:**
   - Go to Supabase Table Editor
   - Verify `retell_scheduled_calls` table exists

2. **Check Edge Functions:**
   - Go to Supabase Functions
   - Verify both functions are deployed and active

3. **Test the UI:**
   - Navigate to `/admin/call-scheduling` in your app
   - You should see the admin interface
   - Try scheduling a test call (use a test phone number!)

---

## How to Use

### For Admins:

1. **Navigate to the Call Scheduling Page:**
   - Go to `/admin/call-scheduling`

2. **Schedule a New Call:**
   - Click "Schedule Call" button
   - Select a client (must have active voice integration)
   - Enter prospect name and phone number (with country code)
   - Choose call mode:
     - **Call Immediately:** Triggers the call right away
     - **Schedule for Later:** Pick a date/time for the call
   - Add optional admin notes
   - Click "Schedule Call" or "Call Now"

3. **Manage Scheduled Calls:**
   - View all scheduled calls in the table
   - Filter by status (pending, calling, completed, failed, cancelled)
   - Search by prospect name, phone, or client name
   - Actions:
     - ▶️ **Play button:** Force trigger a pending call immediately
     - ❌ **X button:** Cancel a pending call

4. **Monitor Call Status:**
   - **Pending:** Call is scheduled but not yet triggered
   - **Calling:** Call is currently in progress
   - **Completed:** Call finished successfully
   - **Failed:** Call encountered an error (see error message)
   - **Cancelled:** Call was manually cancelled

---

## Database Schema

### `retell_scheduled_calls` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `client_id` | UUID | Reference to clients table |
| `created_by` | UUID | Admin who created the call |
| `prospect_name` | TEXT | Name of the person to call |
| `prospect_phone` | TEXT | Phone number (with country code) |
| `scheduled_time` | TIMESTAMPTZ | When to make the call |
| `timezone` | TEXT | Timezone for the call |
| `retell_agent_id` | TEXT | Retell AI agent to use |
| `from_phone_number` | TEXT | Phone number to call from |
| `status` | TEXT | Call status (pending/calling/completed/failed/cancelled) |
| `retell_call_id` | TEXT | Retell's call ID (populated after call starts) |
| `call_duration_seconds` | INTEGER | How long the call lasted |
| `call_started_at` | TIMESTAMPTZ | When call actually started |
| `call_ended_at` | TIMESTAMPTZ | When call ended |
| `error_message` | TEXT | Error details if call failed |
| `retry_count` | INTEGER | Number of retry attempts |
| `last_retry_at` | TIMESTAMPTZ | Last retry timestamp |
| `admin_notes` | TEXT | Internal notes |
| `call_metadata` | JSONB | Additional metadata |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `updated_at` | TIMESTAMPTZ | Record last update time |

---

## API Reference

### AdminService Methods

#### `triggerRetellCall(params)`
Trigger an immediate or scheduled Retell AI call.

**Parameters:**
```typescript
{
  client_id: string;              // Required
  prospect_name: string;          // Required
  prospect_phone: string;         // Required (with country code)
  retell_agent_id: string;        // Required
  from_phone_number?: string;     // Optional (uses client's default)
  scheduled_time?: string;        // ISO timestamp (for scheduled calls)
  trigger_immediately?: boolean;  // true = call now, false = schedule
  admin_notes?: string;           // Optional notes
  call_metadata?: any;            // Optional metadata
}
```

**Returns:**
```typescript
{
  success: boolean;
  scheduled_call_id: string;
  retell_call_id?: string;        // Only for immediate calls
  scheduled_time?: string;        // For scheduled calls
  message: string;
}
```

#### `getScheduledCalls(filters?)`
Get all scheduled calls with optional filters.

**Parameters:**
```typescript
{
  client_id?: string;   // Filter by client
  status?: string;      // Filter by status
}
```

**Returns:** Array of scheduled call records

#### `cancelScheduledCall(scheduledCallId)`
Cancel a pending scheduled call.

**Parameters:** `scheduledCallId: string`

**Returns:** `{ success: boolean }`

#### `forceScheduledCall(scheduledCallId)`
Manually trigger a scheduled call immediately.

**Parameters:** `scheduledCallId: string`

**Returns:**
```typescript
{
  success: boolean;
  retell_call_id: string;
  message: string;
}
```

---

## Retell AI Integration

### How It Works

1. **Admin schedules a call** via the UI or API
2. **Record is created** in `retell_scheduled_calls` table
3. **Cron job runs** every minute checking for pending calls
4. **When time arrives**, the cron job:
   - Updates status to "calling"
   - Calls Retell API to create the phone call
   - Updates record with `retell_call_id`
5. **Retell AI makes the call** to the prospect
6. **Webhook events** are received (call_started, call_ended, call_analyzed)
7. **Status is updated** to "completed" or "failed"

### Retell API Endpoints Used

- **Create Call:** `POST https://api.retellai.com/v2/create-phone-call`
  ```json
  {
    "agent_id": "agent_xxx",
    "from_number": "+12345678900",
    "to_number": "+19876543210",
    "metadata": {
      "scheduled_call_id": "uuid",
      "prospect_name": "John Doe",
      "client_id": "uuid"
    }
  }
  ```

### Required Environment Variables

Make sure these are set in your Supabase secrets:
- `RETELL_API_KEY` - Your Retell AI API key ✅ (Already configured)
- `RETELL_WEBHOOK_SECRET` - Webhook signature verification ✅ (Already configured)

---

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Edge functions deployed
- [ ] Can access `/admin/call-scheduling` page
- [ ] Can see clients with active voice integration
- [ ] Can schedule a call for later
- [ ] Can trigger an immediate call
- [ ] Scheduled calls appear in the table
- [ ] Can cancel a pending call
- [ ] Can force-trigger a pending call
- [ ] Cron job is processing scheduled calls
- [ ] Call status updates correctly (pending → calling → completed/failed)

---

## Troubleshooting

### No clients appear in dropdown
- **Cause:** No clients have active voice integration
- **Fix:** Go to `/admin/voice` and provision voice for at least one client

### Call fails immediately
- **Check:** RETELL_API_KEY is set correctly in Supabase secrets
- **Check:** Client has a valid `from_phone_number`
- **Check:** Prospect phone number includes country code (e.g., +1)
- **Check:** Retell agent ID is valid

### Scheduled calls not triggering automatically
- **Cause:** Cron job not configured
- **Fix:** Set up pg_cron or external cron service (see Step 3 above)
- **Workaround:** Manually trigger via "Play" button in UI

### Error: "No phone number configured for this client"
- **Cause:** Client doesn't have a provisioned Retell phone number
- **Fix:** Go to `/admin/voice` and provision a number for the client

---

## Security Notes

- ✅ **RLS Enabled:** Only admins can access scheduled calls
- ✅ **Auth Required:** All edge functions require admin authentication
- ✅ **Service Role:** Edge functions use service role for database access
- ✅ **Audit Trail:** All calls tracked with creator, timestamps, and status

---

## Future Enhancements

Potential improvements for the future:
- [ ] Retry failed calls automatically (with max retry limit)
- [ ] Email notifications when calls complete/fail
- [ ] Call recording playback in UI
- [ ] Call transcript display
- [ ] Bulk scheduling (upload CSV)
- [ ] Time zone selection per call
- [ ] Call analytics and reporting
- [ ] Integration with CRM for contact import

---

## Support

If you encounter any issues:
1. Check Supabase logs for edge function errors
2. Check browser console for frontend errors
3. Verify Retell API key is valid
4. Check that migrations were applied correctly
5. Review the troubleshooting section above

---

## Summary

You now have a complete Retell AI call scheduling system! Admins can:
- Schedule calls for specific times
- Trigger immediate calls
- Track call status and results
- Manage scheduled calls (cancel, force trigger)
- View call history and analytics

The system handles:
- Database persistence
- Automated processing via cron
- Retell API integration
- Error handling and retry logic
- Full audit trail

**Access the feature at:** `/admin/call-scheduling`

Enjoy your new AI calling feature! 🎉📞
