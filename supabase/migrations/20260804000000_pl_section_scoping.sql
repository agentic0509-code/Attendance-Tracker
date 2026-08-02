-- Migration: Create program_leader_sections and update PL RLS helper function
-- Drop old department-wide program_leaders table

-- 1. Drop old program_leaders table
DROP TABLE IF EXISTS public.program_leaders CASCADE;

-- 2. Create Program Leader Sections Table
CREATE TABLE public.program_leader_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (faculty_id, section_id, term_id)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.program_leader_sections ENABLE ROW LEVEL SECURITY;

-- 4. Define Policies for program_leader_sections
CREATE POLICY admin_all ON public.program_leader_sections
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.program_leader_sections
  FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Redefine pl_manages_section helper to check program_leader_sections
CREATE OR REPLACE FUNCTION public.pl_manages_section(sec_id uuid, user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  active_term_id uuid;
  fac_id uuid;
  assigned boolean;
BEGIN
  -- Find active term
  SELECT id INTO active_term_id FROM public.terms WHERE is_active = true LIMIT 1;
  IF active_term_id IS NULL THEN
    RETURN false;
  END IF;

  -- Find faculty record for the user (using profile_id)
  SELECT id INTO fac_id FROM public.faculty WHERE profile_id = user_id LIMIT 1;
  IF fac_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if assignment exists
  SELECT EXISTS (
    SELECT 1 
    FROM public.program_leader_sections
    WHERE faculty_id = fac_id AND section_id = sec_id AND term_id = active_term_id
  ) INTO assigned;

  RETURN assigned;
END;
$$;
