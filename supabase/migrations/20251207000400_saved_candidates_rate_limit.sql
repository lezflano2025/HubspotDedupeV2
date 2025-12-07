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
