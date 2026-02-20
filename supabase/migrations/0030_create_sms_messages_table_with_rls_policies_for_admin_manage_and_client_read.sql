-- Create SMS messages table
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NULL,
  twilio_message_sid TEXT NULL,
  twilio_account_sid TEXT NULL,
  received_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_messages_client_id_idx ON public.sms_messages(client_id);
CREATE INDEX IF NOT EXISTS sms_messages_created_at_idx ON public.sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS sms_messages_from_number_idx ON public.sms_messages(from_number);
CREATE INDEX IF NOT EXISTS sms_messages_to_number_idx ON public.sms_messages(to_number);

-- Enable RLS (REQUIRED)
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- Admins can manage all SMS messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sms_messages' AND policyname = 'Admins can manage all sms_messages'
  ) THEN
    CREATE POLICY "Admins can manage all sms_messages" ON public.sms_messages
    FOR ALL TO authenticated
    USING (
      auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    )
    WITH CHECK (
      auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    );
  END IF;
END$$;

-- Clients can read their own SMS messages (only when client_id is set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sms_messages' AND policyname = 'Clients can read their own sms_messages'
  ) THEN
    CREATE POLICY "Clients can read their own sms_messages" ON public.sms_messages
    FOR SELECT TO authenticated
    USING (
      client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
    );
  END IF;
END$$;
