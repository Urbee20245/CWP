-- ============================================================
-- Split Payment Project Link Migration
-- Links client_proposals <-> projects for split_50_50 flow
-- ============================================================

-- Add project_id to client_proposals (set when project is auto-created on approval)
ALTER TABLE public.client_proposals
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add proposal_id to projects (set when project is created from a proposal)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.client_proposals(id) ON DELETE SET NULL;

-- Index for fast lookup in both directions
CREATE INDEX IF NOT EXISTS idx_client_proposals_project_id ON public.client_proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_proposal_id ON public.projects(proposal_id);
