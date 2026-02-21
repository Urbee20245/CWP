


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."apply_deposit_to_milestone"("p_deposit_id" "uuid", "p_milestone_id" "uuid", "p_project_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_deposit_amount_cents INT;
    v_milestone_amount_cents INT;
    v_project_progress INT;
    v_milestone_order INT;
    v_total_milestones INT;
    v_new_progress INT;
BEGIN
    -- 1. Validate Deposit and Milestone
    SELECT amount_cents INTO v_deposit_amount_cents
    FROM deposits
    WHERE id = p_deposit_id AND status = 'paid' AND applied_to_invoice_id IS NULL;

    IF v_deposit_amount_cents IS NULL THEN
        RAISE EXCEPTION 'Deposit not found, not paid, or already applied.';
    END IF;

    SELECT amount_cents, order_index INTO v_milestone_amount_cents, v_milestone_order
    FROM milestones
    WHERE id = p_milestone_id AND status = 'pending' AND project_id = p_project_id;

    IF v_milestone_amount_cents IS NULL THEN
        RAISE EXCEPTION 'Milestone not found, already invoiced/paid, or not linked to project.';
    END IF;

    IF v_deposit_amount_cents < v_milestone_amount_cents THEN
        RAISE EXCEPTION 'Deposit amount is less than milestone amount. Cannot apply.';
    END IF;

    -- 2. Update Deposit Record
    UPDATE deposits
    SET 
        status = 'applied',
        applied_to_invoice_id = p_milestone_id -- Using milestone ID as proxy for application reference
    WHERE id = p_deposit_id;

    -- 3. Update Milestone Record
    UPDATE milestones
    SET 
        status = 'paid',
        stripe_invoice_id = 'DEPOSIT_APPLIED_' || p_deposit_id -- Mark with deposit ID for audit trail
    WHERE id = p_milestone_id;

    -- 4. Update Project Progress (Simplified: Milestone completion updates progress)
    SELECT COUNT(*) INTO v_total_milestones FROM milestones WHERE project_id = p_project_id;
    
    IF v_total_milestones > 0 THEN
        -- Calculate progress based on milestone order index
        v_new_progress := (v_milestone_order * 100) / v_total_milestones;
        
        -- Ensure progress doesn't exceed 100%
        v_new_progress := LEAST(v_new_progress, 100);
        
        UPDATE projects
        SET progress_percent = v_new_progress
        WHERE id = p_project_id;
    END IF;

END;
$$;


ALTER FUNCTION "public"."apply_deposit_to_milestone"("p_deposit_id" "uuid", "p_milestone_id" "uuid", "p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_lead_ingest_config"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.client_lead_ingest_configs (client_id)
  VALUES (NEW.id)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_lead_ingest_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_secret"("ciphertext" "text", "key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN convert_from(
    decrypt(
      decode(ciphertext, 'base64'),
      key::bytea,
      'aes'
    ),
    'utf8'
  );
END;
$$;


ALTER FUNCTION "public"."decrypt_secret"("ciphertext" "text", "key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_pending_deposit"("p_deposit_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if the deposit exists and is in 'pending' status
    PERFORM 1
    FROM public.deposits
    WHERE id = p_deposit_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deposit not found or is not in pending status (paid, failed, or applied deposits cannot be deleted).';
    END IF;

    -- Delete the deposit
    DELETE FROM public.deposits
    WHERE id = p_deposit_id;
END;
$$;


ALTER FUNCTION "public"."delete_pending_deposit"("p_deposit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encrypt_secret"("plaintext" "text", "key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN encode(
    encrypt(
      plaintext::bytea,
      key::bytea,
      'aes'
    ),
    'base64'
  );
END;
$$;


ALTER FUNCTION "public"."encrypt_secret"("plaintext" "text", "key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_active_lead_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  active_count integer;
BEGIN
  SELECT count(*)
    INTO active_count
  FROM public.leads l
  WHERE l.client_id = NEW.client_id
    AND coalesce(l.status, 'new') <> 'resolved'
    AND coalesce(l.status, 'new') <> 'archived';

  IF active_count >= 50 THEN
    RAISE EXCEPTION 'Lead limit reached (50 active leads) for this client.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_active_lead_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_a2p_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."handle_a2p_approval"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), COALESCE(NEW.raw_user_meta_data->>'role', 'client'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_master_terms_to_project"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_master_doc_id UUID;
    v_master_content TEXT;
    v_master_version INTEGER;
BEGIN
    -- Find the latest active Master Terms & Conditions document
    SELECT id, content, version INTO v_master_doc_id, v_master_content, v_master_version
    FROM public.master_legal_documents
    WHERE document_type = 'Master Terms & Conditions' AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_master_doc_id IS NOT NULL THEN
        -- Insert a copy of the master document into the project's documents table
        INSERT INTO public.documents (
            client_id,
            project_id,
            document_type,
            content,
            version,
            is_client_visible,
            created_by
        )
        VALUES (
            NEW.client_id,
            NEW.id,
            'Terms & Conditions (Master v' || v_master_version || ')',
            v_master_content,
            v_master_version,
            TRUE, -- Automatically visible to client
            (SELECT owner_profile_id FROM public.clients WHERE id = NEW.client_id) -- Use client owner as placeholder creator
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_master_terms_to_project"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admin_of_new_data"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_subject TEXT;
    v_html_body TEXT;
    v_project_title TEXT;
    v_client_name TEXT;
    v_client_id UUID;
BEGIN
    -- Determine the type of event and construct the notification content
    IF TG_TABLE_NAME = 'messages' THEN
        -- New Message in a Thread
        SELECT title INTO v_project_title FROM project_threads WHERE id = NEW.thread_id;
        v_subject := 'New Message in Thread: ' || v_project_title;
        v_html_body := 'A new message was posted in the thread "' || v_project_title || '".<br><br>Message: ' || NEW.body || '<br><br>View in Portal: [Link to Project]';
    
    ELSIF TG_TABLE_NAME = 'client_addon_requests' THEN
        -- New Add-on Request
        SELECT business_name INTO v_client_name FROM clients WHERE id = NEW.client_id;
        v_subject := 'NEW Add-on Request: ' || NEW.addon_name || ' from ' || v_client_name;
        v_html_body := 'Client ' || v_client_name || ' requested the add-on: ' || NEW.addon_name || '.<br><br>Notes: ' || COALESCE(NEW.notes, 'None') || '<br><br>View Client: [Link to Client]';
        
    ELSIF TG_TABLE_NAME = 'appointments' THEN
        -- New Appointment Booking
        SELECT business_name INTO v_client_name FROM clients WHERE id = NEW.client_id;
        v_subject := 'NEW Appointment Booked: ' || v_client_name;
        v_html_body := 'A new ' || NEW.appointment_type || ' appointment was booked by ' || v_client_name || ' for ' || NEW.appointment_time || '.<br><br>View Appointments: [Link to Admin Appointments]';
        
    END IF;

    -- Invoke the Edge Function asynchronously
    PERFORM net.http_post(
        url := 'https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/send-admin-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('request.jwt', true)
        ),
        body := jsonb_build_object(
            'subject', v_subject,
            'html_body', v_html_body
        )
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_admin_of_new_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_blog_schedules_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_blog_schedules_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_client_proposals_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_client_proposals_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_retell_scheduled_calls_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_retell_scheduled_calls_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addon_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_cents" integer,
    "setup_fee_cents" integer,
    "monthly_price_cents" integer,
    "billing_type" "text" DEFAULT 'subscription'::"text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "is_jet_suite_only" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "billing_type_check" CHECK (("billing_type" = ANY (ARRAY['one_time'::"text", 'subscription'::"text", 'setup_plus_subscription'::"text"])))
);


ALTER TABLE "public"."addon_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_profile_id" "uuid",
    "day_of_week" smallint NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "admin_availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."admin_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "email_type" "text" NOT NULL,
    "tone" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notification_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_notification_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agent_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "retell_agent_id" "text",
    "agent_name" "text" DEFAULT 'AI Assistant'::"text",
    "system_prompt" "text" DEFAULT ''::"text",
    "greeting_message" "text" DEFAULT ''::"text",
    "can_check_availability" boolean DEFAULT true NOT NULL,
    "can_book_meetings" boolean DEFAULT true NOT NULL,
    "can_transfer_calls" boolean DEFAULT false NOT NULL,
    "can_send_sms" boolean DEFAULT false NOT NULL,
    "default_meeting_duration" integer DEFAULT 30 NOT NULL,
    "booking_buffer_minutes" integer DEFAULT 0 NOT NULL,
    "max_advance_booking_days" integer DEFAULT 60 NOT NULL,
    "allowed_meeting_types" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "business_hours" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "timezone" "text" DEFAULT 'America/New_York'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "webhook_check_availability" "text",
    "webhook_book_meeting" "text",
    "webhook_call_started" "text",
    "webhook_call_ended" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "calendar_provider" "text" DEFAULT 'none'::"text" NOT NULL,
    CONSTRAINT "ai_agent_settings_calendar_provider_check" CHECK (("calendar_provider" = ANY (ARRAY['none'::"text", 'cal'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."ai_agent_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "booked_by_profile_id" "uuid",
    "appointment_time" timestamp with time zone NOT NULL,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "appointment_type" "text" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "google_event_id" "text",
    "caller_name" "text",
    "caller_phone" "text",
    "caller_email" "text",
    "meeting_notes" "text",
    "booked_by" "text" DEFAULT 'web'::"text",
    "retell_call_id" "text",
    "billing_type" "text" DEFAULT 'free'::"text" NOT NULL,
    "price_cents" integer DEFAULT 0 NOT NULL,
    "stripe_invoice_id" "text",
    "hosted_invoice_url" "text",
    CONSTRAINT "appointments_booked_by_check" CHECK (("booked_by" = ANY (ARRAY['manual'::"text", 'ai_agent'::"text", 'web'::"text"])))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "billing_type" "text" NOT NULL,
    "amount_cents" integer,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "stripe_product_id" "text" NOT NULL,
    "stripe_price_id" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "setup_fee_cents" integer,
    "monthly_price_cents" integer,
    "bundled_with_product_id" "uuid",
    CONSTRAINT "billing_products_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['one_time'::"text", 'subscription'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."billing_products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."billing_products"."setup_fee_cents" IS 'One-time setup fee in cents (for setup_plus_subscription type)';



COMMENT ON COLUMN "public"."billing_products"."monthly_price_cents" IS 'Monthly recurring price in cents (for subscription types)';



CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt" "text",
    "category" "text",
    "author" "text" DEFAULT 'Admin'::"text",
    "featured_image_url" "text",
    "seo_title" "text",
    "seo_description" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "published_at" timestamp with time zone,
    "word_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "meta_title" "text",
    "meta_description" "text",
    "seo_keywords" "text"[] DEFAULT '{}'::"text"[],
    "featured_image_alt" "text",
    CONSTRAINT "blog_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "days_of_week" integer[] DEFAULT '{1,3,5}'::integer[] NOT NULL,
    "post_count_limit" integer,
    "posts_generated" integer DEFAULT 0 NOT NULL,
    "topic_focus" "text",
    "tone" "text" DEFAULT 'professional'::"text",
    "auto_publish" boolean DEFAULT false NOT NULL,
    "last_run_at" timestamp with time zone,
    "next_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blog_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cal_oauth_states" (
    "state_token" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "return_to" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cal_oauth_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_addon_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "addon_key" "text" NOT NULL,
    "addon_name" "text" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "notes" "text",
    "requested_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_addon_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_cal_calendar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "cal_access_token" "text" DEFAULT ''::"text" NOT NULL,
    "cal_refresh_token" "text" DEFAULT ''::"text" NOT NULL,
    "access_token_expires_at" timestamp with time zone,
    "refresh_token_present" boolean DEFAULT false NOT NULL,
    "connection_status" "text" DEFAULT 'disconnected'::"text" NOT NULL,
    "reauth_reason" "text",
    "last_error" "text",
    "cal_user_id" "text",
    "default_event_type_id" "text",
    "last_synced_at" timestamp with time zone,
    "last_successful_calendar_call" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auth_method" "text" DEFAULT 'oauth'::"text" NOT NULL,
    "cal_booking_link" "text",
    CONSTRAINT "client_cal_calendar_auth_method_check" CHECK (("auth_method" = ANY (ARRAY['oauth'::"text", 'api_key'::"text"]))),
    CONSTRAINT "client_cal_calendar_connected_requires_auth" CHECK ((("connection_status" <> 'connected'::"text") OR ("auth_method" = 'api_key'::"text") OR (("refresh_token_present" = true) AND ("length"(TRIM(BOTH FROM "cal_refresh_token")) > 0)))),
    CONSTRAINT "client_cal_calendar_connection_status_check" CHECK (("connection_status" = ANY (ARRAY['connected'::"text", 'disconnected'::"text", 'needs_reauth'::"text"])))
);


ALTER TABLE "public"."client_cal_calendar" OWNER TO "postgres";


COMMENT ON COLUMN "public"."client_cal_calendar"."cal_booking_link" IS 'The public Cal.com booking URL (e.g., "username/30min" or full URL "https://cal.com/username/30min"). Used for embedding the booking widget.';



CREATE TABLE IF NOT EXISTS "public"."client_domain_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "registrar_name" "text",
    "login_url" "text",
    "username" "text",
    "password" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_domain_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_google_calendar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "google_access_token" "text" NOT NULL,
    "google_refresh_token" "text" NOT NULL,
    "calendar_id" "text" DEFAULT 'primary'::"text",
    "connection_status" "text" DEFAULT 'disconnected'::"text" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "access_token_expires_at" timestamp with time zone,
    "refresh_token_present" boolean DEFAULT false NOT NULL,
    "reauth_reason" "text",
    "last_error" "text",
    "last_successful_calendar_call" timestamp with time zone,
    CONSTRAINT "client_google_calendar_connected_requires_refresh" CHECK ((("connection_status" <> 'connected'::"text") OR (("refresh_token_present" = true) AND ("length"(TRIM(BOTH FROM "google_refresh_token")) > 0))))
);


ALTER TABLE "public"."client_google_calendar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "account_sid_encrypted" "text" NOT NULL,
    "auth_token_encrypted" "text" NOT NULL,
    "phone_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "connection_method" "text" DEFAULT 'manual'::"text"
);


ALTER TABLE "public"."client_integrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."client_integrations"."connection_method" IS 'How credentials were obtained: manual (user entered SID/token) or twilio_connect (OAuth flow)';



CREATE TABLE IF NOT EXISTS "public"."client_lead_ingest_configs" (
    "client_id" "uuid" NOT NULL,
    "ingest_key" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "allowed_origins" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_lead_ingest_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_proposal_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "source_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "billing_type" "text",
    "amount_cents" integer,
    "monthly_price_cents" integer,
    "setup_fee_cents" integer,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_proposal_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['billing_product'::"text", 'addon'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."client_proposal_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "title" "text" DEFAULT 'Your Service Proposal'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "notes" "text",
    "client_message" "text",
    "client_response" "text",
    "approved_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "converted_to_invoice_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_proposals_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'approved'::"text", 'declined'::"text", 'revised'::"text"])))
);


ALTER TABLE "public"."client_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "reminder_date" timestamp with time zone NOT NULL,
    "note" "text" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_voice_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "retell_phone_id" "text",
    "phone_number" "text",
    "number_source" "text" NOT NULL,
    "voice_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "a2p_registration_data" "jsonb" DEFAULT '{}'::"jsonb",
    "a2p_status" "text" DEFAULT 'none'::"text",
    "provisioned_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "retell_agent_id" "text",
    "manually_provisioned" boolean DEFAULT false,
    "a2p_generated_templates" "jsonb",
    "a2p_templates_generated_at" timestamp with time zone,
    "retell_workspace_id" "text",
    "retell_workspace_api_key" "text",
    "voice_monthly_budget_cents" integer DEFAULT 1000 NOT NULL,
    "voice_budget_alert_sent_at" timestamp with time zone,
    CONSTRAINT "client_voice_integrations_number_source_check" CHECK (("number_source" = ANY (ARRAY['client'::"text", 'platform'::"text"])))
);


ALTER TABLE "public"."client_voice_integrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."client_voice_integrations"."a2p_generated_templates" IS 'AI-generated A2P registration templates (campaign description, sample messages, opt-in, etc.)';



COMMENT ON COLUMN "public"."client_voice_integrations"."a2p_templates_generated_at" IS 'Timestamp when A2P templates were last generated';



CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_profile_id" "uuid",
    "business_name" "text" NOT NULL,
    "phone" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "stripe_customer_id" "text",
    "billing_email" "text",
    "stripe_subscription_id" "text",
    "service_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "address" "text",
    "cancellation_reason" "text",
    "cancellation_effective_date" timestamp with time zone,
    "blog_enabled" boolean DEFAULT false,
    CONSTRAINT "clients_service_status_check" CHECK (("service_status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'onboarding'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deposits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "stripe_invoice_id" "text",
    "stripe_payment_intent_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "applied_to_invoice_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deposits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "document_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "is_client_visible" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "to_email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text",
    "status" "text" NOT NULL,
    "error_message" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "sent_by" "uuid"
);


ALTER TABLE "public"."email_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "task_id" "uuid",
    "uploader_profile_id" "uuid",
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text",
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_oauth_states" (
    "state_token" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "return_to" "text"
);


ALTER TABLE "public"."google_oauth_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incoming_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_name" "text",
    "from_email" "text" NOT NULL,
    "subject" "text",
    "body" "text",
    "status" "text" DEFAULT 'unread'::"text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."incoming_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "discount_type" "text" NOT NULL,
    "discount_value" integer NOT NULL,
    "applied_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoice_discounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "stripe_invoice_id" "text",
    "amount_due" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "hosted_invoice_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pdf_url" "text",
    "due_date" timestamp with time zone,
    "last_reminder_sent_at" timestamp with time zone,
    "disable_reminders" boolean DEFAULT false
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "message" "text",
    "source" "text",
    "page_url" "text",
    "referrer" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "user_agent" "text",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_legal_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."master_legal_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_profile_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "thread_id" "uuid"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "order_index" integer NOT NULL,
    "stripe_invoice_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "stripe_event_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "stripe_payment_intent_id" "text",
    "amount" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_phone_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone_number" "text" NOT NULL,
    "label" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_phone_numbers" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_phone_numbers" IS 'Platform outbound phone numbers used to call prospects';



CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "text" DEFAULT 'client'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "admin_role" "text" DEFAULT 'project_manager'::"text",
    "permissions" "jsonb" DEFAULT '{"access": ["dashboard", "clients", "projects", "appointments", "revenue", "billing_products", "addons_catalog", "ai_docs", "ai_email", "settings"]}'::"jsonb"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."project_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "progress_percent" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sla_days" integer,
    "sla_start_date" timestamp with time zone,
    "sla_due_date" timestamp with time zone,
    "sla_status" "text" DEFAULT 'on_track'::"text",
    "required_deposit_cents" integer,
    "deposit_paid" boolean DEFAULT false NOT NULL,
    "service_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "service_paused_at" timestamp with time zone,
    "service_resumed_at" timestamp with time zone,
    "sla_paused_at" timestamp with time zone,
    "sla_resume_offset_days" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "projects_progress_percent_check" CHECK ((("progress_percent" >= 0) AND ("progress_percent" <= 100))),
    CONSTRAINT "projects_service_status_check" CHECK (("service_status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'awaiting_payment'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resend_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_key_encrypted" "text" NOT NULL,
    "from_name" "text" NOT NULL,
    "from_email" "text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."resend_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."retell_scheduled_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "prospect_name" "text" NOT NULL,
    "prospect_phone" "text" NOT NULL,
    "scheduled_time" timestamp with time zone NOT NULL,
    "timezone" "text" DEFAULT 'America/New_York'::"text",
    "retell_agent_id" "text" NOT NULL,
    "from_phone_number" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "retell_call_id" "text",
    "call_duration_seconds" integer,
    "call_started_at" timestamp with time zone,
    "call_ended_at" timestamp with time zone,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "last_retry_at" timestamp with time zone,
    "admin_notes" "text",
    "call_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "prospect_email" "text",
    "prospect_company" "text",
    "is_non_client" boolean DEFAULT false,
    "connection_type" "text",
    "referrer_name" "text",
    "event_name" "text",
    "direct_context" "text",
    CONSTRAINT "retell_scheduled_calls_connection_type_check" CHECK ((("connection_type" IS NULL) OR ("connection_type" = ANY (ARRAY['referral'::"text", 'event'::"text", 'linkedin'::"text", 'website'::"text", 'direct'::"text"])))),
    CONSTRAINT "retell_scheduled_calls_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'scheduled'::"text", 'calling'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."retell_scheduled_calls" OWNER TO "postgres";


COMMENT ON TABLE "public"."retell_scheduled_calls" IS 'Stores scheduled Retell AI calls to prospects (both clients and non-clients)';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."client_id" IS 'Optional reference to clients table. NULL for non-client prospects';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."status" IS 'Call status: pending (not yet scheduled), scheduled (job queued), calling (in progress), completed (successful), failed (error occurred), cancelled (manually cancelled)';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."retell_call_id" IS 'The call ID returned by Retell AI after initiating the call';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."call_metadata" IS 'Additional metadata such as call transcript, analysis, or custom data';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."prospect_email" IS 'Email address of the prospect (for record keeping)';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."prospect_company" IS 'Company name for non-client prospects';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."is_non_client" IS 'True if this is a prospect not yet in the clients table';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."connection_type" IS 'How the admin connected with this prospect: referral, event, linkedin, website, or direct';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."referrer_name" IS 'Name of person who referred this prospect (when connection_type = referral)';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."event_name" IS 'Name of event where prospect was met (when connection_type = event)';



COMMENT ON COLUMN "public"."retell_scheduled_calls"."direct_context" IS 'Brief context for direct connections (when connection_type = direct)';



CREATE TABLE IF NOT EXISTS "public"."service_pause_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "action" "text" NOT NULL,
    "internal_note" "text",
    "client_acknowledged" boolean DEFAULT false NOT NULL,
    "client_acknowledged_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "service_pause_logs_action_check" CHECK (("action" = ANY (ARRAY['paused'::"text", 'resumed'::"text"])))
);


ALTER TABLE "public"."service_pause_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "direction" "text" NOT NULL,
    "from_number" "text" NOT NULL,
    "to_number" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "text",
    "twilio_message_sid" "text",
    "twilio_account_sid" "text",
    "received_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sms_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."sms_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "stripe_subscription_id" "text" NOT NULL,
    "stripe_price_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "due_date" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_client_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "metrics" "jsonb" NOT NULL,
    "source" "text" DEFAULT 'google'::"text",
    "last_refreshed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."voice_client_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "event_source" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "agent_id" "text",
    "retell_call_id" "text",
    "external_id" "text",
    "request_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "response_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "slug" "text" NOT NULL,
    "industry" "text",
    "services" "text",
    "location" "text",
    "tone" "text",
    "brand_color" "text" DEFAULT '#3B82F6'::"text",
    "art_direction_notes" "text",
    "generated_structure" "jsonb",
    "is_published" boolean DEFAULT false,
    "is_generation_complete" boolean DEFAULT false,
    "phone" "text",
    "email" "text",
    "business_hours" "jsonb",
    "service_descriptions" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "website_json" "jsonb" DEFAULT '{}'::"jsonb",
    "premium_features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "custom_domain" "text"
);


ALTER TABLE "public"."website_briefs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."addon_catalog"
    ADD CONSTRAINT "addon_catalog_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."addon_catalog"
    ADD CONSTRAINT "addon_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_availability"
    ADD CONSTRAINT "admin_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_emails"
    ADD CONSTRAINT "admin_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notification_emails"
    ADD CONSTRAINT "admin_notification_emails_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."admin_notification_emails"
    ADD CONSTRAINT "admin_notification_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agent_settings"
    ADD CONSTRAINT "ai_agent_settings_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."ai_agent_settings"
    ADD CONSTRAINT "ai_agent_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agent_settings"
    ADD CONSTRAINT "ai_agent_settings_retell_agent_id_key" UNIQUE ("retell_agent_id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_products"
    ADD CONSTRAINT "billing_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_products"
    ADD CONSTRAINT "billing_products_stripe_price_id_key" UNIQUE ("stripe_price_id");



ALTER TABLE ONLY "public"."billing_products"
    ADD CONSTRAINT "billing_products_stripe_product_id_key" UNIQUE ("stripe_product_id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_client_id_slug_key" UNIQUE ("client_id", "slug");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_schedules"
    ADD CONSTRAINT "blog_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cal_oauth_states"
    ADD CONSTRAINT "cal_oauth_states_pkey" PRIMARY KEY ("state_token");



ALTER TABLE ONLY "public"."client_addon_requests"
    ADD CONSTRAINT "client_addon_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_cal_calendar"
    ADD CONSTRAINT "client_cal_calendar_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."client_cal_calendar"
    ADD CONSTRAINT "client_cal_calendar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_domain_credentials"
    ADD CONSTRAINT "client_domain_credentials_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."client_domain_credentials"
    ADD CONSTRAINT "client_domain_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_google_calendar"
    ADD CONSTRAINT "client_google_calendar_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."client_google_calendar"
    ADD CONSTRAINT "client_google_calendar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_integrations"
    ADD CONSTRAINT "client_integrations_client_id_provider_key" UNIQUE ("client_id", "provider");



ALTER TABLE ONLY "public"."client_integrations"
    ADD CONSTRAINT "client_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_lead_ingest_configs"
    ADD CONSTRAINT "client_lead_ingest_configs_pkey" PRIMARY KEY ("client_id");



ALTER TABLE ONLY "public"."client_proposal_items"
    ADD CONSTRAINT "client_proposal_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_proposals"
    ADD CONSTRAINT "client_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_reminders"
    ADD CONSTRAINT "client_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_voice_integrations"
    ADD CONSTRAINT "client_voice_integrations_client_id_unique" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."client_voice_integrations"
    ADD CONSTRAINT "client_voice_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_voice_integrations"
    ADD CONSTRAINT "client_voice_integrations_retell_phone_id_key" UNIQUE ("retell_phone_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."deposits"
    ADD CONSTRAINT "deposits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_oauth_states"
    ADD CONSTRAINT "google_oauth_states_pkey" PRIMARY KEY ("state_token");



ALTER TABLE ONLY "public"."incoming_emails"
    ADD CONSTRAINT "incoming_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_discounts"
    ADD CONSTRAINT "invoice_discounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_legal_documents"
    ADD CONSTRAINT "master_legal_documents_document_type_key" UNIQUE ("document_type");



ALTER TABLE ONLY "public"."master_legal_documents"
    ADD CONSTRAINT "master_legal_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_phone_numbers"
    ADD CONSTRAINT "platform_phone_numbers_phone_number_key" UNIQUE ("phone_number");



ALTER TABLE ONLY "public"."platform_phone_numbers"
    ADD CONSTRAINT "platform_phone_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_threads"
    ADD CONSTRAINT "project_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resend_settings"
    ADD CONSTRAINT "resend_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."retell_scheduled_calls"
    ADD CONSTRAINT "retell_scheduled_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_pause_logs"
    ADD CONSTRAINT "service_pause_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_client_metrics"
    ADD CONSTRAINT "unique_client_metrics" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."voice_client_metrics"
    ADD CONSTRAINT "voice_client_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_briefs"
    ADD CONSTRAINT "website_briefs_custom_domain_key" UNIQUE ("custom_domain");



ALTER TABLE ONLY "public"."website_briefs"
    ADD CONSTRAINT "website_briefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_briefs"
    ADD CONSTRAINT "website_briefs_slug_key" UNIQUE ("slug");



CREATE INDEX "appointments_client_time_idx" ON "public"."appointments" USING "btree" ("client_id", "appointment_time" DESC);



CREATE UNIQUE INDEX "client_integrations_client_id_provider_idx" ON "public"."client_integrations" USING "btree" ("client_id", "provider");



CREATE INDEX "idx_addon_catalog_active" ON "public"."addon_catalog" USING "btree" ("is_active");



CREATE INDEX "idx_addon_catalog_key" ON "public"."addon_catalog" USING "btree" ("key");



CREATE INDEX "idx_addon_catalog_sort" ON "public"."addon_catalog" USING "btree" ("sort_order");



CREATE INDEX "idx_ai_agent_settings_client_id" ON "public"."ai_agent_settings" USING "btree" ("client_id");



CREATE INDEX "idx_ai_agent_settings_retell_agent_id" ON "public"."ai_agent_settings" USING "btree" ("retell_agent_id");



CREATE INDEX "idx_appointments_google_event_id" ON "public"."appointments" USING "btree" ("google_event_id");



CREATE INDEX "idx_appointments_retell_call_id" ON "public"."appointments" USING "btree" ("retell_call_id");



CREATE INDEX "idx_blog_posts_client_id" ON "public"."blog_posts" USING "btree" ("client_id");



CREATE INDEX "idx_blog_posts_published_at" ON "public"."blog_posts" USING "btree" ("published_at" DESC) WHERE ("status" = 'published'::"text");



CREATE INDEX "idx_blog_posts_slug" ON "public"."blog_posts" USING "btree" ("client_id", "slug");



CREATE INDEX "idx_blog_posts_status" ON "public"."blog_posts" USING "btree" ("status");



CREATE INDEX "idx_cal_oauth_states_client_id" ON "public"."cal_oauth_states" USING "btree" ("client_id");



CREATE INDEX "idx_cal_oauth_states_expires_at" ON "public"."cal_oauth_states" USING "btree" ("expires_at");



CREATE INDEX "idx_client_cal_calendar_client_id" ON "public"."client_cal_calendar" USING "btree" ("client_id");



CREATE INDEX "idx_client_cal_calendar_status" ON "public"."client_cal_calendar" USING "btree" ("connection_status");



CREATE INDEX "idx_client_domain_credentials_client_id" ON "public"."client_domain_credentials" USING "btree" ("client_id");



CREATE INDEX "idx_client_google_calendar_last_success" ON "public"."client_google_calendar" USING "btree" ("last_successful_calendar_call" DESC);



CREATE INDEX "idx_client_google_calendar_status" ON "public"."client_google_calendar" USING "btree" ("connection_status");



CREATE INDEX "idx_client_voice_client_id" ON "public"."client_voice_integrations" USING "btree" ("client_id");



CREATE INDEX "idx_google_oauth_states_client_id" ON "public"."google_oauth_states" USING "btree" ("client_id");



CREATE INDEX "idx_google_oauth_states_expires_at" ON "public"."google_oauth_states" USING "btree" ("expires_at");



CREATE INDEX "idx_retell_scheduled_calls_client_id" ON "public"."retell_scheduled_calls" USING "btree" ("client_id");



CREATE INDEX "idx_retell_scheduled_calls_connection_type" ON "public"."retell_scheduled_calls" USING "btree" ("connection_type") WHERE ("connection_type" IS NOT NULL);



CREATE INDEX "idx_retell_scheduled_calls_created_by" ON "public"."retell_scheduled_calls" USING "btree" ("created_by");



CREATE INDEX "idx_retell_scheduled_calls_retell_call_id" ON "public"."retell_scheduled_calls" USING "btree" ("retell_call_id") WHERE ("retell_call_id" IS NOT NULL);



CREATE INDEX "idx_retell_scheduled_calls_scheduled_time" ON "public"."retell_scheduled_calls" USING "btree" ("scheduled_time");



CREATE INDEX "idx_retell_scheduled_calls_status" ON "public"."retell_scheduled_calls" USING "btree" ("status");



CREATE INDEX "idx_webhook_events_client_created_at" ON "public"."webhook_events" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_webhook_events_retell_call_id" ON "public"."webhook_events" USING "btree" ("retell_call_id");



CREATE INDEX "idx_webhook_events_source_type_created_at" ON "public"."webhook_events" USING "btree" ("event_source", "event_type", "created_at" DESC);



CREATE INDEX "idx_website_briefs_client_id" ON "public"."website_briefs" USING "btree" ("client_id");



CREATE INDEX "idx_website_briefs_custom_domain" ON "public"."website_briefs" USING "btree" ("custom_domain");



CREATE INDEX "idx_website_briefs_published" ON "public"."website_briefs" USING "btree" ("is_published");



CREATE INDEX "idx_website_briefs_slug" ON "public"."website_briefs" USING "btree" ("slug");



CREATE INDEX "leads_client_created_at_idx" ON "public"."leads" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "sms_messages_client_id_idx" ON "public"."sms_messages" USING "btree" ("client_id");



CREATE INDEX "sms_messages_created_at_idx" ON "public"."sms_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "sms_messages_from_number_idx" ON "public"."sms_messages" USING "btree" ("from_number");



CREATE INDEX "sms_messages_to_number_idx" ON "public"."sms_messages" USING "btree" ("to_number");



CREATE OR REPLACE TRIGGER "enforce_active_lead_limit" BEFORE INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_active_lead_limit"();



CREATE OR REPLACE TRIGGER "on_a2p_approved_provision" AFTER UPDATE OF "a2p_status" ON "public"."client_voice_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_a2p_approval"();



CREATE OR REPLACE TRIGGER "on_client_created_lead_ingest" AFTER INSERT ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_lead_ingest_config"();



CREATE OR REPLACE TRIGGER "on_new_addon_request_notify_admin" AFTER INSERT ON "public"."client_addon_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_admin_of_new_data"();



CREATE OR REPLACE TRIGGER "on_new_appointment_notify_admin" AFTER INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_admin_of_new_data"();



CREATE OR REPLACE TRIGGER "on_new_message_notify_admin" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_admin_of_new_data"();



CREATE OR REPLACE TRIGGER "on_project_created_link_terms" AFTER INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."link_master_terms_to_project"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."addon_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."client_google_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."client_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."client_lead_ingest_configs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_ai_agent_settings" BEFORE UPDATE ON "public"."ai_agent_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_client_cal_calendar" BEFORE UPDATE ON "public"."client_cal_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_voice" BEFORE UPDATE ON "public"."client_voice_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_blog_schedules_updated_at" BEFORE UPDATE ON "public"."blog_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_blog_schedules_updated_at"();



CREATE OR REPLACE TRIGGER "trg_client_proposals_updated_at" BEFORE UPDATE ON "public"."client_proposals" FOR EACH ROW EXECUTE FUNCTION "public"."update_client_proposals_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_retell_scheduled_calls_updated_at" BEFORE UPDATE ON "public"."retell_scheduled_calls" FOR EACH ROW EXECUTE FUNCTION "public"."update_retell_scheduled_calls_updated_at"();



CREATE OR REPLACE TRIGGER "update_blog_posts_updated_at" BEFORE UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_domain_credentials_updated_at" BEFORE UPDATE ON "public"."client_domain_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_platform_settings_updated_at" BEFORE UPDATE ON "public"."platform_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_website_briefs_updated_at" BEFORE UPDATE ON "public"."website_briefs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_availability"
    ADD CONSTRAINT "admin_availability_admin_profile_id_fkey" FOREIGN KEY ("admin_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_emails"
    ADD CONSTRAINT "admin_emails_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_emails"
    ADD CONSTRAINT "admin_emails_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_emails"
    ADD CONSTRAINT "admin_emails_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_agent_settings"
    ADD CONSTRAINT "ai_agent_settings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_booked_by_profile_id_fkey" FOREIGN KEY ("booked_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_products"
    ADD CONSTRAINT "billing_products_bundled_with_product_id_fkey" FOREIGN KEY ("bundled_with_product_id") REFERENCES "public"."billing_products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_schedules"
    ADD CONSTRAINT "blog_schedules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cal_oauth_states"
    ADD CONSTRAINT "cal_oauth_states_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cal_oauth_states"
    ADD CONSTRAINT "cal_oauth_states_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_addon_requests"
    ADD CONSTRAINT "client_addon_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_cal_calendar"
    ADD CONSTRAINT "client_cal_calendar_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_domain_credentials"
    ADD CONSTRAINT "client_domain_credentials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_google_calendar"
    ADD CONSTRAINT "client_google_calendar_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_integrations"
    ADD CONSTRAINT "client_integrations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_lead_ingest_configs"
    ADD CONSTRAINT "client_lead_ingest_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_proposal_items"
    ADD CONSTRAINT "client_proposal_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."client_proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_proposals"
    ADD CONSTRAINT "client_proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_proposals"
    ADD CONSTRAINT "client_proposals_converted_to_invoice_id_fkey" FOREIGN KEY ("converted_to_invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."client_proposals"
    ADD CONSTRAINT "client_proposals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."client_reminders"
    ADD CONSTRAINT "client_reminders_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_reminders"
    ADD CONSTRAINT "client_reminders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_voice_integrations"
    ADD CONSTRAINT "client_voice_integrations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deposits"
    ADD CONSTRAINT "deposits_applied_to_invoice_id_fkey" FOREIGN KEY ("applied_to_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deposits"
    ADD CONSTRAINT "deposits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deposits"
    ADD CONSTRAINT "deposits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_uploader_profile_id_fkey" FOREIGN KEY ("uploader_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."google_oauth_states"
    ADD CONSTRAINT "google_oauth_states_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_oauth_states"
    ADD CONSTRAINT "google_oauth_states_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_discounts"
    ADD CONSTRAINT "invoice_discounts_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_discounts"
    ADD CONSTRAINT "invoice_discounts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_profile_id_fkey" FOREIGN KEY ("sender_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."project_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_threads"
    ADD CONSTRAINT "project_threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_threads"
    ADD CONSTRAINT "project_threads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."retell_scheduled_calls"
    ADD CONSTRAINT "retell_scheduled_calls_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."retell_scheduled_calls"
    ADD CONSTRAINT "retell_scheduled_calls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_pause_logs"
    ADD CONSTRAINT "service_pause_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_pause_logs"
    ADD CONSTRAINT "service_pause_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_briefs"
    ADD CONSTRAINT "website_briefs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete billing products" ON "public"."billing_products" FOR DELETE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can delete calendar connections" ON "public"."client_google_calendar" FOR DELETE TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can delete platform phone numbers" ON "public"."platform_phone_numbers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete profiles" ON "public"."profiles" FOR DELETE TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can delete scheduled calls" ON "public"."retell_scheduled_calls" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert billing products" ON "public"."billing_products" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can insert email logs" ON "public"."email_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can insert platform phone numbers" ON "public"."platform_phone_numbers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can insert scheduled calls" ON "public"."retell_scheduled_calls" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all addon requests" ON "public"."client_addon_requests" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all admin emails" ON "public"."admin_emails" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all appointments" ON "public"."appointments" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all availability" ON "public"."admin_availability" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all blog posts" ON "public"."blog_posts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all calendar connections" ON "public"."client_google_calendar" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage all client reminders" ON "public"."client_reminders" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all clients" ON "public"."clients" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all deposits" ON "public"."deposits" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all documents" ON "public"."documents" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all files" ON "public"."files" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all incoming emails" ON "public"."incoming_emails" TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text")) WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admins can manage all invoice discounts" ON "public"."invoice_discounts" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all invoices" ON "public"."invoices" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all messages" ON "public"."messages" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all milestones" ON "public"."milestones" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all pause logs" ON "public"."service_pause_logs" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all payment events" ON "public"."payment_events" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all payments" ON "public"."payments" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all project threads" ON "public"."project_threads" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all projects" ON "public"."projects" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all scheduled calls" ON "public"."retell_scheduled_calls" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all sms_messages" ON "public"."sms_messages" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all subscriptions" ON "public"."subscriptions" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all tasks" ON "public"."tasks" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage all website briefs" ON "public"."website_briefs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage master legal documents" ON "public"."master_legal_documents" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage notification emails" ON "public"."admin_notification_emails" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can manage platform settings" ON "public"."platform_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage resend settings" ON "public"."resend_settings" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can read all domain credentials" ON "public"."client_domain_credentials" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles_1"."id"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles_1"."id"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can update billing products" ON "public"."billing_products" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can update calendar connections" ON "public"."client_google_calendar" FOR UPDATE TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can update platform phone numbers" ON "public"."platform_phone_numbers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can update scheduled calls" ON "public"."retell_scheduled_calls" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all billing products" ON "public"."billing_products" FOR SELECT TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can view all calendar connections" ON "public"."client_google_calendar" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view all email logs" ON "public"."email_logs" FOR SELECT TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins can view all scheduled calls" ON "public"."retell_scheduled_calls" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view platform phone numbers" ON "public"."platform_phone_numbers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage all voice" ON "public"."client_voice_integrations" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins manage blog schedules" ON "public"."blog_schedules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage platform settings" ON "public"."platform_settings" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins manage proposal items" ON "public"."client_proposal_items" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Admins manage proposals" ON "public"."client_proposals" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Allow authenticated delete on addon_catalog" ON "public"."addon_catalog" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated insert on addon_catalog" ON "public"."addon_catalog" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated update on addon_catalog" ON "public"."addon_catalog" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow read access to addon_catalog" ON "public"."addon_catalog" FOR SELECT USING (true);



CREATE POLICY "Anon can read clients" ON "public"."clients" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can read integrations" ON "public"."client_integrations" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Authenticated users can read active billing products" ON "public"."billing_products" FOR SELECT TO "authenticated" USING (("active" = true));



CREATE POLICY "Authenticated users can read client integrations" ON "public"."client_integrations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Clients can insert their own addon requests" ON "public"."client_addon_requests" FOR INSERT TO "authenticated" WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can manage their own appointments" ON "public"."appointments" TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"())))) WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can manage their own domain credentials" ON "public"."client_domain_credentials" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"())))) WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can manage their own integrations" ON "public"."client_integrations" TO "authenticated" WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read active master legal documents" ON "public"."master_legal_documents" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Clients can read all availability" ON "public"."admin_availability" FOR SELECT USING (true);



CREATE POLICY "Clients can read their invoice discounts" ON "public"."invoice_discounts" FOR SELECT TO "authenticated" USING (("invoice_id" IN ( SELECT "invoices"."id"
   FROM "public"."invoices"
  WHERE ("invoices"."client_id" IN ( SELECT "clients"."id"
           FROM "public"."clients"
          WHERE ("clients"."owner_profile_id" = "auth"."uid"()))))));



CREATE POLICY "Clients can read their invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their own addon requests" ON "public"."client_addon_requests" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their own blog posts" ON "public"."blog_posts" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their own calendar connection" ON "public"."client_google_calendar" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their own client record" ON "public"."clients" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_profile_id"));



CREATE POLICY "Clients can read their own deposits" ON "public"."deposits" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their own integrations" ON "public"."client_integrations" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their own pause logs" ON "public"."service_pause_logs" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their own payment events" ON "public"."payment_events" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their own sms_messages" ON "public"."sms_messages" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their own subscriptions" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their payments" ON "public"."payments" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read their project milestones" ON "public"."milestones" FOR SELECT TO "authenticated" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."client_id" IN ( SELECT "clients"."id"
           FROM "public"."clients"
          WHERE ("clients"."owner_profile_id" = "auth"."uid"()))))));



CREATE POLICY "Clients can read their project tasks" ON "public"."tasks" FOR SELECT TO "authenticated" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."client_id" IN ( SELECT "clients"."id"
           FROM "public"."clients"
          WHERE ("clients"."owner_profile_id" = "auth"."uid"()))))));



CREATE POLICY "Clients can read their projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can read visible documents" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("is_client_visible" = true) AND ("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"())))));



CREATE POLICY "Clients can read/create threads for their projects" ON "public"."project_threads" TO "authenticated" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."client_id" IN ( SELECT "clients"."id"
           FROM "public"."clients"
          WHERE ("clients"."owner_profile_id" = "auth"."uid"())))))) WITH CHECK (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."client_id" IN ( SELECT "clients"."id"
           FROM "public"."clients"
          WHERE ("clients"."owner_profile_id" = "auth"."uid"()))))));



CREATE POLICY "Clients can read/write messages in their project threads" ON "public"."messages" TO "authenticated" USING (("thread_id" IN ( SELECT "project_threads"."id"
   FROM "public"."project_threads"
  WHERE ("project_threads"."project_id" IN ( SELECT "projects"."id"
           FROM "public"."projects"
          WHERE ("projects"."client_id" IN ( SELECT "clients"."id"
                   FROM "public"."clients"
                  WHERE ("clients"."owner_profile_id" = "auth"."uid"())))))))) WITH CHECK (("thread_id" IN ( SELECT "project_threads"."id"
   FROM "public"."project_threads"
  WHERE ("project_threads"."project_id" IN ( SELECT "projects"."id"
           FROM "public"."projects"
          WHERE ("projects"."client_id" IN ( SELECT "clients"."id"
                   FROM "public"."clients"
                  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))))))));



CREATE POLICY "Clients can read/write project files" ON "public"."files" TO "authenticated" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."client_id" IN ( SELECT "clients"."id"
           FROM "public"."clients"
          WHERE ("clients"."owner_profile_id" = "auth"."uid"())))))) WITH CHECK (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."client_id" IN ( SELECT "clients"."id"
           FROM "public"."clients"
          WHERE ("clients"."owner_profile_id" = "auth"."uid"()))))));



CREATE POLICY "Clients can update their editable fields only" ON "public"."website_briefs" FOR UPDATE TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can update their own calendar connection" ON "public"."client_google_calendar" FOR UPDATE TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients can view their own website brief" ON "public"."website_briefs" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients read own proposals" ON "public"."client_proposals" FOR SELECT TO "authenticated" USING ((("status" <> 'draft'::"text") AND ("client_id" IN ( SELECT "c"."id"
   FROM "public"."clients" "c"
  WHERE ("c"."owner_profile_id" = "auth"."uid"())))));



CREATE POLICY "Clients read proposal items" ON "public"."client_proposal_items" FOR SELECT TO "authenticated" USING (("proposal_id" IN ( SELECT "cp"."id"
   FROM ("public"."client_proposals" "cp"
     JOIN "public"."clients" "c" ON (("c"."id" = "cp"."client_id")))
  WHERE (("c"."owner_profile_id" = "auth"."uid"()) AND ("cp"."status" <> 'draft'::"text")))));



CREATE POLICY "Clients respond to proposals" ON "public"."client_proposals" FOR UPDATE TO "authenticated" USING ((("status" = 'sent'::"text") AND ("client_id" IN ( SELECT "c"."id"
   FROM "public"."clients" "c"
  WHERE ("c"."owner_profile_id" = "auth"."uid"()))))) WITH CHECK (("status" = ANY (ARRAY['approved'::"text", 'declined'::"text"])));



CREATE POLICY "Clients see their voice status" ON "public"."client_voice_integrations" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Clients view own blog schedules" ON "public"."blog_schedules" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "Public can check site status by slug" ON "public"."website_briefs" FOR SELECT TO "anon" USING (("slug" IS NOT NULL));



CREATE POLICY "Public can read cal booking link for published sites" ON "public"."client_cal_calendar" FOR SELECT TO "anon" USING (("client_id" IN ( SELECT "website_briefs"."client_id"
   FROM "public"."website_briefs"
  WHERE (("website_briefs"."is_published" = true) AND ("website_briefs"."slug" IS NOT NULL)))));



CREATE POLICY "Public can read platform settings" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "Published blog posts are publicly viewable" ON "public"."blog_posts" FOR SELECT TO "anon" USING (("status" = 'published'::"text"));



CREATE POLICY "Published sites are publicly viewable" ON "public"."website_briefs" FOR SELECT TO "anon" USING (("is_published" = true));



CREATE POLICY "Service role full access to client integrations" ON "public"."client_integrations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to voice integrations" ON "public"."client_voice_integrations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access" ON "public"."retell_scheduled_calls" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role has full access to blog posts" ON "public"."blog_posts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."addon_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_notification_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agent_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_agent_settings_admin_all" ON "public"."ai_agent_settings" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "ai_agent_settings_client_owner_insert" ON "public"."ai_agent_settings" FOR INSERT TO "authenticated" WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "ai_agent_settings_client_owner_select" ON "public"."ai_agent_settings" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "ai_agent_settings_client_owner_update" ON "public"."ai_agent_settings" FOR UPDATE TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"())))) WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cal_oauth_states" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cal_oauth_states_admin_all" ON "public"."cal_oauth_states" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "cal_oauth_states_insert_own" ON "public"."cal_oauth_states" FOR INSERT TO "authenticated" WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "cal_oauth_states_select_own" ON "public"."cal_oauth_states" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."client_addon_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_cal_calendar" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_cal_calendar_admin_all" ON "public"."client_cal_calendar" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "client_cal_calendar_client_owner_select" ON "public"."client_cal_calendar" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "client_cal_calendar_client_owner_update" ON "public"."client_cal_calendar" FOR UPDATE TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"())))) WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."client_domain_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_google_calendar" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_lead_ingest_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_lead_ingest_configs_admin_all" ON "public"."client_lead_ingest_configs" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "client_lead_ingest_configs_client_select" ON "public"."client_lead_ingest_configs" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "client_lead_ingest_configs_client_update" ON "public"."client_lead_ingest_configs" FOR UPDATE TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"())))) WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."client_proposal_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_voice_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deposits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_oauth_states" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "google_oauth_states_admin_all" ON "public"."google_oauth_states" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "google_oauth_states_insert_own" ON "public"."google_oauth_states" FOR INSERT TO "authenticated" WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "google_oauth_states_select_own" ON "public"."google_oauth_states" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."incoming_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_discounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_admin_all" ON "public"."leads" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "leads_client_delete" ON "public"."leads" FOR DELETE TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "leads_client_select" ON "public"."leads" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "leads_client_update" ON "public"."leads" FOR UPDATE TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"())))) WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."master_legal_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_phone_numbers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_read_all" ON "public"."profiles" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "profiles_read_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."project_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read voice metrics" ON "public"."voice_client_metrics" FOR SELECT USING (true);



ALTER TABLE "public"."resend_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."retell_scheduled_calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_pause_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_client_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "voice_integrations_admin_all" ON "public"."client_voice_integrations" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text")))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "voice_integrations_client_owner_select" ON "public"."client_voice_integrations" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "voice_integrations_client_owner_update" ON "public"."client_voice_integrations" FOR UPDATE TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"())))) WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "webhook_events_admin_select" ON "public"."webhook_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "webhook_events_client_owner_select" ON "public"."webhook_events" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."website_briefs" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_deposit_to_milestone"("p_deposit_id" "uuid", "p_milestone_id" "uuid", "p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_deposit_to_milestone"("p_deposit_id" "uuid", "p_milestone_id" "uuid", "p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_deposit_to_milestone"("p_deposit_id" "uuid", "p_milestone_id" "uuid", "p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_lead_ingest_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_lead_ingest_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_lead_ingest_config"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrypt_secret"("ciphertext" "text", "key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_secret"("ciphertext" "text", "key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_secret"("ciphertext" "text", "key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_pending_deposit"("p_deposit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_pending_deposit"("p_deposit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_pending_deposit"("p_deposit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."encrypt_secret"("plaintext" "text", "key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encrypt_secret"("plaintext" "text", "key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encrypt_secret"("plaintext" "text", "key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_active_lead_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_active_lead_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_active_lead_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_a2p_approval"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_a2p_approval"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_a2p_approval"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_master_terms_to_project"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_master_terms_to_project"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_master_terms_to_project"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_admin_of_new_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_admin_of_new_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_admin_of_new_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_blog_schedules_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_blog_schedules_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_blog_schedules_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_client_proposals_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_client_proposals_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_client_proposals_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_retell_scheduled_calls_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_retell_scheduled_calls_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_retell_scheduled_calls_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."addon_catalog" TO "anon";
GRANT ALL ON TABLE "public"."addon_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."addon_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."admin_availability" TO "anon";
GRANT ALL ON TABLE "public"."admin_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_availability" TO "service_role";



GRANT ALL ON TABLE "public"."admin_emails" TO "anon";
GRANT ALL ON TABLE "public"."admin_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_emails" TO "service_role";



GRANT ALL ON TABLE "public"."admin_notification_emails" TO "anon";
GRANT ALL ON TABLE "public"."admin_notification_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notification_emails" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agent_settings" TO "anon";
GRANT ALL ON TABLE "public"."ai_agent_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agent_settings" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."billing_products" TO "anon";
GRANT ALL ON TABLE "public"."billing_products" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_products" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."blog_schedules" TO "anon";
GRANT ALL ON TABLE "public"."blog_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."cal_oauth_states" TO "anon";
GRANT ALL ON TABLE "public"."cal_oauth_states" TO "authenticated";
GRANT ALL ON TABLE "public"."cal_oauth_states" TO "service_role";



GRANT ALL ON TABLE "public"."client_addon_requests" TO "anon";
GRANT ALL ON TABLE "public"."client_addon_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."client_addon_requests" TO "service_role";



GRANT ALL ON TABLE "public"."client_cal_calendar" TO "anon";
GRANT ALL ON TABLE "public"."client_cal_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."client_cal_calendar" TO "service_role";



GRANT ALL ON TABLE "public"."client_domain_credentials" TO "anon";
GRANT ALL ON TABLE "public"."client_domain_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."client_domain_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."client_google_calendar" TO "anon";
GRANT ALL ON TABLE "public"."client_google_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."client_google_calendar" TO "service_role";



GRANT ALL ON TABLE "public"."client_integrations" TO "anon";
GRANT ALL ON TABLE "public"."client_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."client_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."client_lead_ingest_configs" TO "anon";
GRANT ALL ON TABLE "public"."client_lead_ingest_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."client_lead_ingest_configs" TO "service_role";



GRANT ALL ON TABLE "public"."client_proposal_items" TO "anon";
GRANT ALL ON TABLE "public"."client_proposal_items" TO "authenticated";
GRANT ALL ON TABLE "public"."client_proposal_items" TO "service_role";



GRANT ALL ON TABLE "public"."client_proposals" TO "anon";
GRANT ALL ON TABLE "public"."client_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."client_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."client_reminders" TO "anon";
GRANT ALL ON TABLE "public"."client_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."client_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."client_voice_integrations" TO "anon";
GRANT ALL ON TABLE "public"."client_voice_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."client_voice_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."deposits" TO "anon";
GRANT ALL ON TABLE "public"."deposits" TO "authenticated";
GRANT ALL ON TABLE "public"."deposits" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."email_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_logs" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."google_oauth_states" TO "anon";
GRANT ALL ON TABLE "public"."google_oauth_states" TO "authenticated";
GRANT ALL ON TABLE "public"."google_oauth_states" TO "service_role";



GRANT ALL ON TABLE "public"."incoming_emails" TO "anon";
GRANT ALL ON TABLE "public"."incoming_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."incoming_emails" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_discounts" TO "anon";
GRANT ALL ON TABLE "public"."invoice_discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_discounts" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."master_legal_documents" TO "anon";
GRANT ALL ON TABLE "public"."master_legal_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."master_legal_documents" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."milestones" TO "anon";
GRANT ALL ON TABLE "public"."milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."milestones" TO "service_role";



GRANT ALL ON TABLE "public"."payment_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_events" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."platform_phone_numbers" TO "anon";
GRANT ALL ON TABLE "public"."platform_phone_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_phone_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_threads" TO "anon";
GRANT ALL ON TABLE "public"."project_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."project_threads" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."resend_settings" TO "anon";
GRANT ALL ON TABLE "public"."resend_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."resend_settings" TO "service_role";



GRANT ALL ON TABLE "public"."retell_scheduled_calls" TO "anon";
GRANT ALL ON TABLE "public"."retell_scheduled_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."retell_scheduled_calls" TO "service_role";



GRANT ALL ON TABLE "public"."service_pause_logs" TO "anon";
GRANT ALL ON TABLE "public"."service_pause_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."service_pause_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sms_messages" TO "anon";
GRANT ALL ON TABLE "public"."sms_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_messages" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."voice_client_metrics" TO "anon";
GRANT ALL ON TABLE "public"."voice_client_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_client_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."website_briefs" TO "anon";
GRANT ALL ON TABLE "public"."website_briefs" TO "authenticated";
GRANT ALL ON TABLE "public"."website_briefs" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







