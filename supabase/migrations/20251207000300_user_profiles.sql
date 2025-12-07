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
