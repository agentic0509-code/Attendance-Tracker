-- Migration: Alter Students table
-- Rename enrollment_no to admission_no, and add official_email

-- Rename enrollment_no to admission_no
ALTER TABLE public.students RENAME COLUMN enrollment_no TO admission_no;

-- Add official_email column
ALTER TABLE public.students ADD COLUMN official_email text UNIQUE;
