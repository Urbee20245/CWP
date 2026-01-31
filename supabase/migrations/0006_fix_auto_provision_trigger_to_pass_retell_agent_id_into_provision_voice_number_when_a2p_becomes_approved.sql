CREATE OR REPLACE FUNCTION public.handle_a2p_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_retell_phone_id TEXT;
BEGIN
    -- Check if the a2p_status transitioned to 'approved'
    IF NEW.a2p_status = 'approved' AND OLD.a2p_status IS DISTINCT FROM 'approved' THEN
        
        -- Idempotency: If already provisioned, skip.
        SELECT retell_phone_id INTO v_retell_phone_id
        FROM public.client_voice_integrations
        WHERE client_id = NEW.client_id;

        IF v_retell_phone_id IS NULL THEN
            -- Invoke the provision-voice-number Edge Function asynchronously
            PERFORM net.http_post(
                url := 'https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/provision-voice-number',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('request.jwt', true)
                ),
                body := jsonb_build_object(
                    'client_id', NEW.client_id,
                    'source', NEW.number_source,
                    'phone_number', NEW.phone_number,
                    'a2p_data', NEW.a2p_registration_data,
                    'retell_agent_id', NEW.retell_agent_id
                )
            );
            RAISE NOTICE 'Auto-provisioning triggered for client %', NEW.client_id;
        ELSE
            RAISE NOTICE 'Client % already provisioned (ID: %). Skipping auto-provisioning.', NEW.client_id, v_retell_phone_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;