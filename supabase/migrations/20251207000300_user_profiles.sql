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
