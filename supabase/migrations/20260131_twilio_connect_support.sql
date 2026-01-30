-- Add connection_method column to client_integrations table
-- Tracks how the Twilio integration was established: 'manual' or 'twilio_connect'
ALTER TABLE client_integrations
ADD COLUMN IF NOT EXISTS connection_method TEXT DEFAULT 'manual';

-- Add a comment for documentation
COMMENT ON COLUMN client_integrations.connection_method IS 'How credentials were obtained: manual (user entered SID/token) or twilio_connect (OAuth flow)';
