-- Migration: Add terms, courses, offerings, and enrollments tables
-- Make faculty.profile_id nullable for CSV uploads without logins

-- 1. Modify Faculty table profile_id to be nullable
ALTER TABLE public.faculty ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Create Terms Table
CREATE TABLE public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  academic_year text NOT NULL,
  semester_number integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Create Courses Table
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  credits integer NOT NULL,
  course_type text CHECK (course_type IN ('theory', 'lab')) NOT NULL,
  semester_number integer NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 4. Create Course Offerings Table
CREATE TABLE public.course_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (course_id, section_id, term_id)
);

-- 5. Create Enrollments Table
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_id, course_offering_id)
);

-- 6. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies

-- TERMS Policies
CREATE POLICY admin_all ON public.terms
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.terms
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- COURSES Policies
CREATE POLICY admin_all ON public.courses
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.courses
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- COURSE OFFERINGS Policies
CREATE POLICY admin_all ON public.course_offerings
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.course_offerings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ENROLLMENTS Policies
CREATE POLICY admin_all ON public.enrollments
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.enrollments
  FOR SELECT
  USING (auth.role() = 'authenticated');
