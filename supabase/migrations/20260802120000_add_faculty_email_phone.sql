-- Migration: Add email and phone columns to Faculty table, and password_changed to profiles
-- Create get_login_email security definer function for custom auth

-- Add email and phone to faculty
ALTER TABLE public.faculty ADD COLUMN email text UNIQUE;
ALTER TABLE public.faculty ADD COLUMN phone text;

-- Add password_changed to profiles
ALTER TABLE public.profiles ADD COLUMN password_changed boolean DEFAULT false;

-- Create get_login_email function (Security Definer, anon execution)
CREATE OR REPLACE FUNCTION public.get_login_email(identifier text)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_email text;
BEGIN
  -- 1. Check in profiles.email
  SELECT email INTO resolved_email FROM public.profiles WHERE email = identifier;
  IF FOUND THEN
    RETURN resolved_email;
  END IF;

  -- 2. Check in faculty.employee_code
  SELECT email INTO resolved_email FROM public.faculty WHERE employee_code = identifier;
  IF FOUND AND resolved_email IS NOT NULL THEN
    RETURN resolved_email;
  END IF;

  -- 3. Check in students.roll_no
  SELECT official_email INTO resolved_email FROM public.students WHERE roll_no = identifier;
  IF FOUND AND resolved_email IS NOT NULL THEN
    RETURN resolved_email;
  END IF;

  -- Return NULL if none matches
  RETURN NULL;
END;
$$;

-- Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;
