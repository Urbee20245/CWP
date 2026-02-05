-- Add cal_booking_link field to store the admin's public Cal.com booking URL
-- This is used for embedding the Cal.com calendar widget on the client appointments page

ALTER TABLE public.client_cal_calendar
  ADD COLUMN IF NOT EXISTS cal_booking_link TEXT;

-- Add a comment explaining the field
COMMENT ON COLUMN public.client_cal_calendar.cal_booking_link IS
  'The public Cal.com booking URL (e.g., "username/30min" or full URL "https://cal.com/username/30min"). Used for embedding the booking widget.';
