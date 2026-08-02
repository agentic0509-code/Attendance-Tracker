-- Migration: Create timetable, program_leaders, sessions, and attendance tables
-- Configure RLS policies and PL department access helper functions

-- 1. Create Program Leaders Table
CREATE TABLE public.program_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. Create Timetable Grid Table
CREATE TABLE public.timetable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  day_of_week text CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')) NOT NULL,
  period_number integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (section_id, day_of_week, period_number)
);

-- 3. Create Session Status and Attendance Status Enums (if not already created)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent');
  END IF;
END
$$;

-- 4. Create Sessions Table
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  date date NOT NULL,
  period_number integer NOT NULL,
  status session_status NOT NULL DEFAULT 'scheduled',
  marked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  substitute_for_id uuid REFERENCES public.faculty(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (course_offering_id, date, period_number)
);

-- 5. Create Attendance Table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status attendance_status NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.program_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 7. RLS Helper Functions

-- Helper 1: Check if PL manages section
CREATE OR REPLACE FUNCTION public.pl_manages_section(sec_id uuid, user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.program_leaders pl
    JOIN public.batches b ON b.department_id = pl.department_id
    JOIN public.sections s ON s.batch_id = b.id
    WHERE pl.profile_id = user_id AND s.id = sec_id
  );
END;
$$;

-- Helper 2: Check if PL manages course offering
CREATE OR REPLACE FUNCTION public.pl_manages_offering(offering_id uuid, user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  sec_id uuid;
BEGIN
  SELECT section_id INTO sec_id FROM public.course_offerings WHERE id = offering_id;
  RETURN public.pl_manages_section(sec_id, user_id);
END;
$$;

-- Helper 3: Check if session belongs to PL managed offering
CREATE OR REPLACE FUNCTION public.pl_manages_session(sess_id uuid, user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  offering_id uuid;
BEGIN
  SELECT course_offering_id INTO offering_id FROM public.sessions WHERE id = sess_id;
  RETURN public.pl_manages_offering(offering_id, user_id);
END;
$$;

-- 8. Define RLS Policies

-- PROGRAM LEADERS Policies
CREATE POLICY admin_all ON public.program_leaders
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.program_leaders
  FOR SELECT USING (auth.role() = 'authenticated');

-- TIMETABLE Policies
CREATE POLICY admin_all ON public.timetable
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY pl_all ON public.timetable
  FOR ALL USING (public.pl_manages_section(section_id, auth.uid()));

CREATE POLICY auth_read ON public.timetable
  FOR SELECT USING (auth.role() = 'authenticated');

-- SESSIONS Policies
CREATE POLICY admin_all ON public.sessions
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY pl_all ON public.sessions
  FOR ALL USING (public.pl_manages_offering(course_offering_id, auth.uid()));

CREATE POLICY faculty_all ON public.sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.course_offerings co
      JOIN public.faculty f ON f.id = co.faculty_id
      WHERE co.id = course_offering_id AND f.profile_id = auth.uid()
    )
    OR marked_by = auth.uid()
  );

CREATE POLICY auth_read ON public.sessions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ATTENDANCE Policies
CREATE POLICY admin_all ON public.attendance
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY pl_all ON public.attendance
  FOR ALL USING (public.pl_manages_session(session_id, auth.uid()));

CREATE POLICY faculty_all ON public.attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND (
        EXISTS (
          SELECT 1 FROM public.course_offerings co
          JOIN public.faculty f ON f.id = co.faculty_id
          WHERE co.id = s.course_offering_id AND f.profile_id = auth.uid()
        )
        OR s.marked_by = auth.uid()
      )
    )
  );

CREATE POLICY auth_read ON public.attendance
  FOR SELECT USING (auth.role() = 'authenticated');
