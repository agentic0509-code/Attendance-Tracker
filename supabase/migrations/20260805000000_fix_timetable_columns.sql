-- Migration: Adjust timetable policies to align with schema containing period_no and no section_id column

-- 1. Drop old policies
DROP POLICY IF EXISTS pl_all ON public.timetable;
DROP POLICY IF EXISTS auth_read ON public.timetable;
DROP POLICY IF EXISTS admin_all ON public.timetable;

-- 2. Re-create policies joining course_offerings to check permissions
CREATE POLICY pl_all ON public.timetable
  FOR ALL USING (
    public.pl_manages_offering(course_offering_id, auth.uid())
  );

CREATE POLICY auth_read ON public.timetable
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY admin_all ON public.timetable
  FOR ALL USING (public.current_user_role() = 'admin');
