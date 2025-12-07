-- ============================================
-- COMBINED SUPABASE MIGRATIONS
-- ============================================
-- Project: iulypfrqgjqblhsrsqdr
-- URL: https://cvcxpgltdypbcjokxgxb.supabase.co
--
-- This file combines all 6 migrations in order.
-- You can run this in Supabase SQL Editor if needed.
-- ============================================

-- ============================================
-- Migration 1: Core Tables (open_roles, candidates)
-- File: 20251207000100_core_open_roles_candidates.sql
-- ============================================

-- Create open_roles table first (referenced by candidates)
CREATE TABLE IF NOT EXISTS public.open_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  department text,
  location text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  channels text[] DEFAULT ARRAY['linkedin', 'email'],
  prospects_count integer DEFAULT 0,
  contacted_count integer DEFAULT 0,
  replied_count integer DEFAULT 0,
  daily_limits jsonb DEFAULT '{"linkedin": 40, "email": 60}'::jsonb,
  scheduling_window jsonb DEFAULT '{"startHour": 9, "endHour": 17, "timezone": "UTC"}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on open_roles
ALTER TABLE public.open_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for open_roles
CREATE POLICY "Users can view their own roles" ON public.open_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own roles" ON public.open_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own roles" ON public.open_roles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roles" ON public.open_roles
  FOR DELETE USING (auth.uid() = user_id);

-- Create candidates table
CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  first_name text,
  last_name text,
  full_name text,
  title text,
  company text,
  location text,
  linkedin_url text,
  profile_image_url text,
  email text,
  skills text[],
  experience_years integer,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'meeting_booked', 'converted', 'bad_timing', 'irrelevant')),
  role_id uuid REFERENCES public.open_roles(id) ON DELETE SET NULL,
  source text DEFAULT 'linkedin_search' CHECK (source IN ('linkedin_search', 'csv_import', 'manual')),
  sourced_at timestamp with time zone DEFAULT now(),
  last_activity_at timestamp with time zone,
  notes text,
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, linkedin_url)
);

-- Enable RLS on candidates
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- RLS policies for candidates
CREATE POLICY "Users can view their own candidates" ON public.candidates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own candidates" ON public.candidates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own candidates" ON public.candidates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own candidates" ON public.candidates
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS candidates_linkedin_url_idx ON public.candidates(linkedin_url);
CREATE INDEX IF NOT EXISTS candidates_role_id_idx ON public.candidates(role_id);
CREATE INDEX IF NOT EXISTS candidates_status_idx ON public.candidates(status);
CREATE INDEX IF NOT EXISTS candidates_user_id_idx ON public.candidates(user_id);
CREATE INDEX IF NOT EXISTS open_roles_user_id_idx ON public.open_roles(user_id);

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_open_roles_updated_at
  BEFORE UPDATE ON public.open_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Migration 2: Candidate Tracking
-- File: 20251207000200_candidate_tracking.sql
-- ============================================

-- Create candidate tracking table for status and events
CREATE TABLE public.candidate_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  candidate_id TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  last_email_subject TEXT,
  last_email_sent_at TIMESTAMP WITH TIME ZONE,
  events JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, candidate_id)
);

-- Enable Row Level Security
ALTER TABLE public.candidate_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own candidate tracking"
ON public.candidate_tracking
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create candidate tracking"
ON public.candidate_tracking
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own candidate tracking"
ON public.candidate_tracking
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own candidate tracking"
ON public.candidate_tracking
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_candidate_tracking_user_id ON public.candidate_tracking(user_id);
CREATE INDEX idx_candidate_tracking_candidate_id ON public.candidate_tracking(candidate_id);
CREATE INDEX idx_candidate_tracking_status ON public.candidate_tracking(status);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_candidate_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_candidate_tracking_updated_at
BEFORE UPDATE ON public.candidate_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_candidate_tracking_updated_at();

-- ============================================
-- Migration 3: User Profiles
-- File: 20251207000300_user_profiles.sql
-- ============================================

-- Create user_profiles table for storing company and email settings
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- Email integration
  email_provider TEXT,
  email_connected BOOLEAN DEFAULT false,
  email_account TEXT,
  -- Company profile
  company_name TEXT,
  company_website TEXT,
  company_about TEXT,
  company_selling_points TEXT,
  default_location TEXT,
  email_signature TEXT,
  tone_preference TEXT DEFAULT 'friendly_professional',
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index on user_id
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_candidate_tracking_updated_at();

-- ============================================
-- Migration 4: Saved Candidates & Rate Limiting
-- File: 20251207000400_saved_candidates_rate_limit.sql
-- ============================================

-- Create table for saved candidates with RLS
CREATE TABLE IF NOT EXISTS public.saved_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL,
  candidate_data JSONB NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, candidate_id)
);

-- Enable RLS
ALTER TABLE public.saved_candidates ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own saved candidates"
ON public.saved_candidates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can save candidates"
ON public.saved_candidates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their saved candidates"
ON public.saved_candidates
FOR DELETE
USING (auth.uid() = user_id);

-- Create table for rate limiting
CREATE TABLE IF NOT EXISTS public.search_rate_limit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.search_rate_limit ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own rate limit"
ON public.search_rate_limit
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own rate limit"
ON public.search_rate_limit
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Migration 5: Email Outreach
-- File: 20251207000500_email_outreach.sql
-- ============================================

-- Create email outreach tracking table
CREATE TABLE public.email_outreach (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  candidate_id TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_outreach ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own outreach emails"
ON public.email_outreach
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create outreach emails"
ON public.email_outreach
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own outreach emails"
ON public.email_outreach
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own outreach emails"
ON public.email_outreach
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_email_outreach_user_id ON public.email_outreach(user_id);
CREATE INDEX idx_email_outreach_candidate_id ON public.email_outreach(candidate_id);

-- ============================================
-- Migration 6: User Profiles Business Context
-- File: 20251207000600_user_profiles_business_context.sql
-- ============================================

-- ICP (Ideal Candidate Profile) fields
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS target_titles TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_companies TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS must_have_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nice_to_have_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_experience INTEGER,
  ADD COLUMN IF NOT EXISTS max_experience INTEGER;

-- DNC (Do Not Contact) fields
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS dnc_companies TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dnc_individuals TEXT[] DEFAULT '{}';

-- Outreach Examples
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS outreach_examples JSONB DEFAULT '[]'::jsonb;

-- Add index for better query performance (already exists from migration 3, this is safe to re-run)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================
-- END OF MIGRATIONS
-- ============================================
