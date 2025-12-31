-- Create request_replies table for conversation tracking on contact requests
CREATE TABLE public.request_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.contact_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.request_replies ENABLE ROW LEVEL SECURITY;

-- Admins can manage all replies
CREATE POLICY "Admins can manage request replies"
ON public.request_replies
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_request_replies_request_id ON public.request_replies(request_id);