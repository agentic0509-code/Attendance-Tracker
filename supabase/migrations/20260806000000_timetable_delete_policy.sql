-- Migration: Add PL Delete policy on timetable

DROP POLICY IF EXISTS pl_all ON public.timetable;
DROP POLICY IF EXISTS pl_delete ON public.timetable;

-- 1. General policy for PL to manage timetables
CREATE POLICY pl_all ON public.timetable
  FOR ALL USING (
    public.pl_manages_offering(course_offering_id, auth.uid())
  );

-- 2. Explicit policy for PL to delete timetable slots
CREATE POLICY pl_delete ON public.timetable
  FOR DELETE TO authenticated
  USING (
    public.pl_manages_offering(course_offering_id, auth.uid())
  );
