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