-- Migration: Add Business Context fields to user_profiles

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

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
