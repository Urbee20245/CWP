-- =============================================================================
-- BASE SCHEMA — must run before ALL other migrations
-- File: 00000_base_schema.sql
-- Sorts alphabetically before 0000_... because "00000" < "0000_" (ASCII 48 < 95)
--
-- Creates all foundational tables that later migrations reference via foreign keys.
-- Every statement is idempotent (IF NOT EXISTS / DO $$ blocks) so this is safe
-- to run against an existing production database that already has these tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. PROFILES (mirrors auth.users, role-based)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        UNIQUE,
  full_name     TEXT,
  role          TEXT        NOT NULL DEFAULT 'client',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  admin_role    TEXT        DEFAULT 'project_manager',
  permissions   JSONB       DEFAULT '{"access": ["dashboard","clients","projects","appointments","revenue","billing_products","addons_catalog","ai_docs","ai_email","settings"]}'::jsonb
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_read_own') THEN
    CREATE POLICY profiles_read_own ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_admin_read_all') THEN
    CREATE POLICY profiles_admin_read_all ON public.profiles FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can insert profiles') THEN
    CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK ((auth.jwt() ->> 'role') = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can update profiles') THEN
    CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING ((auth.jwt() ->> 'role') = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can delete profiles') THEN
    CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING ((auth.jwt() ->> 'role') = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can update any profile') THEN
    CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
END $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. CLIENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id                         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_profile_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  business_name              TEXT        NOT NULL,
  phone                      TEXT,
  status                     TEXT        NOT NULL DEFAULT 'active',
  notes                      TEXT,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  stripe_customer_id         TEXT        UNIQUE,
  billing_email              TEXT,
  stripe_subscription_id     TEXT,
  service_status             TEXT        NOT NULL DEFAULT 'active'
    CHECK (service_status IN ('active','paused','onboarding','completed')),
  address                    TEXT,
  cancellation_reason        TEXT,
  cancellation_effective_date TIMESTAMPTZ,
  blog_enabled               BOOLEAN     DEFAULT FALSE
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='Admins can manage all clients') THEN
    CREATE POLICY "Admins can manage all clients" ON public.clients FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='Clients can read their own client record') THEN
    CREATE POLICY "Clients can read their own client record" ON public.clients FOR SELECT TO authenticated
      USING (auth.uid() = owner_profile_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='Anon can read clients') THEN
    CREATE POLICY "Anon can read clients" ON public.clients FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. BILLING PRODUCTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_products (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    TEXT        NOT NULL,
  description             TEXT,
  billing_type            TEXT        NOT NULL CHECK (billing_type IN ('one_time','subscription','yearly')),
  amount_cents            INTEGER,
  monthly_price_cents     INTEGER,
  setup_fee_cents         INTEGER,
  currency                TEXT        NOT NULL DEFAULT 'usd',
  stripe_product_id       TEXT        UNIQUE,
  stripe_price_id         TEXT        UNIQUE,
  active                  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  bundled_with_product_id UUID        REFERENCES public.billing_products(id)
);

ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_products' AND policyname='Admins can view all billing products') THEN
    CREATE POLICY "Admins can view all billing products" ON public.billing_products FOR SELECT TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_products' AND policyname='Admins can insert billing products') THEN
    CREATE POLICY "Admins can insert billing products" ON public.billing_products FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_products' AND policyname='Admins can update billing products') THEN
    CREATE POLICY "Admins can update billing products" ON public.billing_products FOR UPDATE TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_products' AND policyname='Admins can delete billing products') THEN
    CREATE POLICY "Admins can delete billing products" ON public.billing_products FOR DELETE TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_products' AND policyname='Authenticated users can read active billing products') THEN
    CREATE POLICY "Authenticated users can read active billing products" ON public.billing_products FOR SELECT TO authenticated
      USING (active = TRUE);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. ADDON CATALOG
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.addon_catalog (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  key               TEXT        NOT NULL UNIQUE,
  name              TEXT        NOT NULL,
  description       TEXT,
  price_cents       INTEGER,
  setup_fee_cents   INTEGER,
  monthly_price_cents INTEGER,
  billing_type      TEXT        NOT NULL DEFAULT 'subscription'
    CHECK (billing_type IN ('one_time','subscription','setup_plus_subscription')),
  is_active         BOOLEAN     DEFAULT TRUE,
  sort_order        INTEGER     DEFAULT 0,
  is_jet_suite_only BOOLEAN     DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at        TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.addon_catalog ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='addon_catalog' AND policyname='Allow read access to addon_catalog') THEN
    CREATE POLICY "Allow read access to addon_catalog" ON public.addon_catalog FOR SELECT TO public USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='addon_catalog' AND policyname='Allow authenticated insert on addon_catalog') THEN
    CREATE POLICY "Allow authenticated insert on addon_catalog" ON public.addon_catalog FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='addon_catalog' AND policyname='Allow authenticated update on addon_catalog') THEN
    CREATE POLICY "Allow authenticated update on addon_catalog" ON public.addon_catalog FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='addon_catalog' AND policyname='Allow authenticated delete on addon_catalog') THEN
    CREATE POLICY "Allow authenticated delete on addon_catalog" ON public.addon_catalog FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. PROJECTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             UUID        REFERENCES public.clients(id) ON DELETE CASCADE,
  title                 TEXT        NOT NULL,
  description           TEXT,
  status                TEXT        NOT NULL DEFAULT 'draft',
  progress_percent      INTEGER     NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  sla_days              INTEGER,
  sla_start_date        TIMESTAMPTZ,
  sla_due_date          TIMESTAMPTZ,
  sla_status            TEXT        DEFAULT 'on_track',
  required_deposit_cents INTEGER,
  deposit_paid          BOOLEAN     NOT NULL DEFAULT FALSE,
  service_status        TEXT        NOT NULL DEFAULT 'active'
    CHECK (service_status IN ('active','paused','awaiting_payment','completed')),
  service_paused_at     TIMESTAMPTZ,
  service_resumed_at    TIMESTAMPTZ,
  sla_paused_at         TIMESTAMPTZ,
  sla_resume_offset_days INTEGER    NOT NULL DEFAULT 0
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='Admins can manage all projects') THEN
    CREATE POLICY "Admins can manage all projects" ON public.projects FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='Clients can read their projects') THEN
    CREATE POLICY "Clients can read their projects" ON public.projects FOR SELECT TO authenticated
      USING (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. INVOICES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             UUID        REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_invoice_id     TEXT,
  amount_due            INTEGER     NOT NULL,
  currency              TEXT        NOT NULL DEFAULT 'usd',
  status                TEXT        NOT NULL,
  hosted_invoice_url    TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  pdf_url               TEXT,
  due_date              TIMESTAMPTZ,
  last_reminder_sent_at TIMESTAMPTZ,
  disable_reminders     BOOLEAN     DEFAULT FALSE
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='Admins can manage all invoices') THEN
    CREATE POLICY "Admins can manage all invoices" ON public.invoices FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='Clients can read their invoices') THEN
    CREATE POLICY "Clients can read their invoices" ON public.invoices FOR SELECT TO authenticated
      USING (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. MILESTONES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.milestones (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  amount_cents      INTEGER     NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',
  order_index       INTEGER     NOT NULL,
  stripe_invoice_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='milestones' AND policyname='Admins can manage all milestones') THEN
    CREATE POLICY "Admins can manage all milestones" ON public.milestones FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='milestones' AND policyname='Clients can read their project milestones') THEN
    CREATE POLICY "Clients can read their project milestones" ON public.milestones FOR SELECT TO authenticated
      USING (project_id IN (SELECT id FROM public.projects WHERE client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. DEPOSITS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deposits (
  id                        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id                 UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id                UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  amount_cents              INTEGER     NOT NULL,
  currency                  TEXT        NOT NULL DEFAULT 'usd',
  stripe_invoice_id         TEXT,
  stripe_payment_intent_id  TEXT,
  status                    TEXT        NOT NULL DEFAULT 'pending',
  applied_to_invoice_id     UUID        REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deposits' AND policyname='Admins can manage all deposits') THEN
    CREATE POLICY "Admins can manage all deposits" ON public.deposits FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deposits' AND policyname='Clients can read their own deposits') THEN
    CREATE POLICY "Clients can read their own deposits" ON public.deposits FOR SELECT TO authenticated
      USING (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. SUBSCRIPTIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id               UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT        NOT NULL UNIQUE,
  stripe_price_id         TEXT        NOT NULL,
  status                  TEXT        NOT NULL,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN     DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions' AND policyname='Admins can manage all subscriptions') THEN
    CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions' AND policyname='Clients can read their own subscriptions') THEN
    CREATE POLICY "Clients can read their own subscriptions" ON public.subscriptions FOR SELECT TO authenticated
      USING (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 10. PAYMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id                        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id                 UUID        REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_payment_intent_id  TEXT,
  amount                    INTEGER     NOT NULL,
  currency                  TEXT        NOT NULL DEFAULT 'usd',
  status                    TEXT        NOT NULL,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='Admins can manage all payments') THEN
    CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='Clients can read their payments') THEN
    CREATE POLICY "Clients can read their payments" ON public.payments FOR SELECT TO authenticated
      USING (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11. PAYMENT EVENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_events (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       UUID        REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_event_id TEXT        NOT NULL UNIQUE,
  type            TEXT        NOT NULL,
  payload         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_events' AND policyname='Admins can manage all payment events') THEN
    CREATE POLICY "Admins can manage all payment events" ON public.payment_events FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_events' AND policyname='Clients can read their own payment events') THEN
    CREATE POLICY "Clients can read their own payment events" ON public.payment_events FOR SELECT TO authenticated
      USING (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 12. TASKS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID        REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  status      TEXT        NOT NULL DEFAULT 'todo',
  due_date    DATE,
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tasks' AND policyname='Admins can manage all tasks') THEN
    CREATE POLICY "Admins can manage all tasks" ON public.tasks FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tasks' AND policyname='Clients can read their project tasks') THEN
    CREATE POLICY "Clients can read their project tasks" ON public.tasks FOR SELECT TO authenticated
      USING (project_id IN (SELECT id FROM public.projects WHERE client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 13. PROJECT THREADS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_threads (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.project_threads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_threads' AND policyname='Admins can manage all project threads') THEN
    CREATE POLICY "Admins can manage all project threads" ON public.project_threads FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_threads' AND policyname='Clients can read/create threads for their projects') THEN
    CREATE POLICY "Clients can read/create threads for their projects" ON public.project_threads FOR ALL TO authenticated
      USING (project_id IN (SELECT id FROM public.projects WHERE client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())))
      WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 14. MESSAGES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_profile_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  body              TEXT        NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  thread_id         UUID        REFERENCES public.project_threads(id) ON DELETE CASCADE
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='Admins can manage all messages') THEN
    CREATE POLICY "Admins can manage all messages" ON public.messages FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='Clients can read/write messages in their project threads') THEN
    CREATE POLICY "Clients can read/write messages in their project threads" ON public.messages FOR ALL TO authenticated
      USING (thread_id IN (SELECT id FROM public.project_threads WHERE project_id IN (SELECT id FROM public.projects WHERE client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()))))
      WITH CHECK (thread_id IN (SELECT id FROM public.project_threads WHERE project_id IN (SELECT id FROM public.projects WHERE client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()))));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 15. FILES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.files (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id          UUID        REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id             UUID        REFERENCES public.tasks(id) ON DELETE SET NULL,
  uploader_profile_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path        TEXT        NOT NULL,
  file_name           TEXT        NOT NULL,
  file_type           TEXT,
  file_size           INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='files' AND policyname='Admins can manage all files') THEN
    CREATE POLICY "Admins can manage all files" ON public.files FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='files' AND policyname='Clients can read/write project files') THEN
    CREATE POLICY "Clients can read/write project files" ON public.files FOR ALL TO authenticated
      USING (project_id IN (SELECT id FROM public.projects WHERE client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())))
      WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 16. DOCUMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id        UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  document_type     TEXT        NOT NULL,
  content           TEXT        NOT NULL,
  version           INTEGER     NOT NULL DEFAULT 1,
  is_client_visible BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='Admins can manage all documents') THEN
    CREATE POLICY "Admins can manage all documents" ON public.documents FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='Clients can read visible documents') THEN
    CREATE POLICY "Clients can read visible documents" ON public.documents FOR SELECT TO authenticated
      USING (is_client_visible = true AND client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 17. EMAIL LOGS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  to_email      TEXT        NOT NULL,
  subject       TEXT        NOT NULL,
  body          TEXT,
  status        TEXT        NOT NULL,
  error_message TEXT,
  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  sent_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_logs' AND policyname='Admins can view all email logs') THEN
    CREATE POLICY "Admins can view all email logs" ON public.email_logs FOR SELECT TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_logs' AND policyname='Admins can insert email logs') THEN
    CREATE POLICY "Admins can insert email logs" ON public.email_logs FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 18. ADMIN EMAILS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_emails (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id  UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  subject     TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  email_type  TEXT        NOT NULL,
  tone        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'draft',
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_emails' AND policyname='Admins can manage all admin emails') THEN
    CREATE POLICY "Admins can manage all admin emails" ON public.admin_emails FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 19. SERVICE PAUSE LOGS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_pause_logs (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id               UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id              UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  action                  TEXT        NOT NULL CHECK (action IN ('paused','resumed')),
  internal_note           TEXT,
  client_acknowledged     BOOLEAN     NOT NULL DEFAULT FALSE,
  client_acknowledged_at  TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.service_pause_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_pause_logs' AND policyname='Admins can manage all pause logs') THEN
    CREATE POLICY "Admins can manage all pause logs" ON public.service_pause_logs FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_pause_logs' AND policyname='Clients can read their own pause logs') THEN
    CREATE POLICY "Clients can read their own pause logs" ON public.service_pause_logs FOR SELECT TO authenticated
      USING (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 20. ADMIN AVAILABILITY
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_availability (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_profile_id  UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week       SMALLINT    NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time        TIME        NOT NULL,
  end_time          TIME        NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_availability ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_availability' AND policyname='Admins can manage all availability') THEN
    CREATE POLICY "Admins can manage all availability" ON public.admin_availability FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_availability' AND policyname='Clients can read all availability') THEN
    CREATE POLICY "Clients can read all availability" ON public.admin_availability FOR SELECT TO public USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 21. APPOINTMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  booked_by_profile_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointment_time      TIMESTAMPTZ NOT NULL,
  duration_minutes      INTEGER     NOT NULL DEFAULT 30,
  appointment_type      TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'scheduled',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  google_event_id       TEXT,
  caller_name           TEXT,
  caller_phone          TEXT,
  caller_email          TEXT,
  meeting_notes         TEXT,
  booked_by             TEXT        DEFAULT 'web' CHECK (booked_by IN ('manual','ai_agent','web')),
  retell_call_id        TEXT,
  billing_type          TEXT        NOT NULL DEFAULT 'free',
  price_cents           INTEGER     NOT NULL DEFAULT 0,
  stripe_invoice_id     TEXT,
  hosted_invoice_url    TEXT
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='Admins can manage all appointments') THEN
    CREATE POLICY "Admins can manage all appointments" ON public.appointments FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='Clients can manage their own appointments') THEN
    CREATE POLICY "Clients can manage their own appointments" ON public.appointments FOR ALL TO authenticated
      USING (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()))
      WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 22. ADMIN NOTIFICATION EMAILS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_notification_emails (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT        NOT NULL UNIQUE,
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_notification_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_notification_emails' AND policyname='Admins can manage notification emails') THEN
    CREATE POLICY "Admins can manage notification emails" ON public.admin_notification_emails FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 23. INVOICE DISCOUNTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_discounts (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id      UUID        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  discount_type   TEXT        NOT NULL,
  discount_value  INTEGER     NOT NULL,
  applied_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoice_discounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoice_discounts' AND policyname='Admins can manage all invoice discounts') THEN
    CREATE POLICY "Admins can manage all invoice discounts" ON public.invoice_discounts FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoice_discounts' AND policyname='Clients can read their invoice discounts') THEN
    CREATE POLICY "Clients can read their invoice discounts" ON public.invoice_discounts FOR SELECT TO authenticated
      USING (invoice_id IN (SELECT id FROM public.invoices WHERE client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 24. CLIENT REMINDERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_reminders (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  admin_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_date   TIMESTAMPTZ NOT NULL,
  note            TEXT        NOT NULL,
  is_completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_reminders' AND policyname='Admins can manage all client reminders') THEN
    CREATE POLICY "Admins can manage all client reminders" ON public.client_reminders FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 25. INCOMING EMAILS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incoming_emails (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  from_name   TEXT,
  from_email  TEXT        NOT NULL,
  subject     TEXT,
  body        TEXT,
  status      TEXT        NOT NULL DEFAULT 'unread',
  received_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.incoming_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='incoming_emails' AND policyname='Admins can manage all incoming emails') THEN
    CREATE POLICY "Admins can manage all incoming emails" ON public.incoming_emails FOR ALL TO authenticated
      USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
      WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 26. RESEND SETTINGS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resend_settings (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_encrypted TEXT        NOT NULL,
  from_name         TEXT        NOT NULL,
  from_email        TEXT        NOT NULL,
  is_active         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.resend_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='resend_settings' AND policyname='Admins can manage resend settings') THEN
    CREATE POLICY "Admins can manage resend settings" ON public.resend_settings FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 27. MASTER LEGAL DOCUMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.master_legal_documents (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type   TEXT        NOT NULL UNIQUE,
  content         TEXT        NOT NULL,
  version         INTEGER     NOT NULL DEFAULT 1,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.master_legal_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='master_legal_documents' AND policyname='Admins can manage master legal documents') THEN
    CREATE POLICY "Admins can manage master legal documents" ON public.master_legal_documents FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='master_legal_documents' AND policyname='Clients can read active master legal documents') THEN
    CREATE POLICY "Clients can read active master legal documents" ON public.master_legal_documents FOR SELECT TO authenticated
      USING (is_active = true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 28. CLIENT ADDON REQUESTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_addon_requests (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  addon_key   TEXT        NOT NULL,
  addon_name  TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'requested',
  notes       TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_addon_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_addon_requests' AND policyname='Admins can manage all addon requests') THEN
    CREATE POLICY "Admins can manage all addon requests" ON public.client_addon_requests FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_addon_requests' AND policyname='Clients can read their own addon requests') THEN
    CREATE POLICY "Clients can read their own addon requests" ON public.client_addon_requests FOR SELECT TO authenticated
      USING (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_addon_requests' AND policyname='Clients can insert their own addon requests') THEN
    CREATE POLICY "Clients can insert their own addon requests" ON public.client_addon_requests FOR INSERT TO authenticated
      WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 29. PLATFORM SETTINGS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         TEXT        PRIMARY KEY,
  value       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_settings' AND policyname='Admins manage platform settings') THEN
    CREATE POLICY "Admins manage platform settings" ON public.platform_settings FOR ALL TO authenticated
      USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
  END IF;
END $$;

-- =============================================================================
-- END OF BASE SCHEMA
-- =============================================================================
