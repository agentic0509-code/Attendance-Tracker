-- Migration: Create Database Schema for RollCall AI College Attendance Tracker
-- Setup roles, profiles, structural tables, and security policies

-- 1. Create Roles Enum
CREATE TYPE user_role AS ENUM ('admin', 'program_leader', 'faculty', 'student', 'parent');

-- 2. Create Profiles Table (extends auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text,
  email text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  phone text,
  created_at timestamptz DEFAULT now()
);

-- 3. Create Departments Table
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL
);

-- 4. Create Batches Table
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  admission_year integer NOT NULL,
  current_semester integer NOT NULL,
  UNIQUE (department_id, admission_year)
);

-- 5. Create Sections Table
CREATE TABLE public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (batch_id, name)
);

-- 6. Create Faculty Table
CREATE TABLE public.faculty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code text UNIQUE NOT NULL,
  name text NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE
);

-- 7. Create Students Table
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  roll_no text UNIQUE NOT NULL,
  enrollment_no text UNIQUE NOT NULL,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  name text NOT NULL,
  dob date,
  gender text,
  personal_email text,
  phone text
);

-- 8. Enable Row Level Security (RLS) on all tables (default-deny)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 9. Create Helper Function to retrieve current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  r user_role;
BEGIN
  SELECT role INTO r FROM public.profiles WHERE id = auth.uid();
  RETURN r;
END;
$$;

-- 10. Define RLS Policies

-- PROFILES Policies
CREATE POLICY admin_all ON public.profiles
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY user_read_own ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- DEPARTMENTS Policies
CREATE POLICY admin_all ON public.departments
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.departments
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- BATCHES Policies
CREATE POLICY admin_all ON public.batches
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.batches
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- SECTIONS Policies
CREATE POLICY admin_all ON public.sections
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.sections
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- FACULTY Policies
CREATE POLICY admin_all ON public.faculty
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.faculty
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- STUDENTS Policies
CREATE POLICY admin_all ON public.students
  FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY auth_read ON public.students
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 11. Create Trigger to automatically create a profiles row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email,
    'student', -- default role for signups
    new.phone
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
