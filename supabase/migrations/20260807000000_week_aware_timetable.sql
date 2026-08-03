-- Migration: Week-Aware Timetable table constraints and policies

-- 1. Add week_start_date column if not exists
ALTER TABLE public.timetable ADD COLUMN IF NOT EXISTS week_start_date date;

-- 2. Drop old unique constraints
ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_section_id_day_of_week_period_number_key;
ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_section_id_day_of_week_period_no_key;
ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_course_offering_id_week_start_date_day_of_week_perio_key;
ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_offering_week_slot_uniq;

-- 3. Add new week-aware unique constraint
ALTER TABLE public.timetable ADD CONSTRAINT timetable_offering_week_slot_uniq UNIQUE (course_offering_id, week_start_date, day_of_week, period_no);

-- 4. Re-create RLS Policies on timetable table to support all actions
DROP POLICY IF EXISTS pl_all ON public.timetable;
DROP POLICY IF EXISTS pl_delete ON public.timetable;

CREATE POLICY pl_all ON public.timetable
  FOR ALL USING (
    public.pl_manages_offering(course_offering_id, auth.uid())
  );

CREATE POLICY pl_delete ON public.timetable
  FOR DELETE TO authenticated
  USING (
    public.pl_manages_offering(course_offering_id, auth.uid())
  );
