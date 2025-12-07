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