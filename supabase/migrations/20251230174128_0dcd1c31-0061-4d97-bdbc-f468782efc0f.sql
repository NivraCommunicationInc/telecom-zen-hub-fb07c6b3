
-- Add new columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sim_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS imei_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Create messages table for client communication
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  related_request_id UUID REFERENCES public.contact_requests(id) ON DELETE SET NULL,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add priority and internal notes to contact_requests
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Add client management fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sector_tags TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employer_discount TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Create client_documents table
CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_type TEXT DEFAULT 'general',
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contract_name TEXT NOT NULL,
  contract_url TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE,
  is_signed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  admin_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create telecom_analytics table
CREATE TABLE IF NOT EXISTS public.telecom_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contract_savings NUMERIC DEFAULT 0,
  activations_count INTEGER DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add fees and credits columns to billing
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS fees NUMERIC DEFAULT 0;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS credits NUMERIC DEFAULT 0;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS late_fee_applied BOOLEAN DEFAULT false;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS notes TEXT;

-- Enable RLS on new tables
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telecom_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages
CREATE POLICY "Admins can manage all messages" ON public.messages FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (auth.uid() = recipient_id OR auth.uid() = sender_id);

-- RLS policies for client_documents
CREATE POLICY "Admins can manage all documents" ON public.client_documents FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own documents" ON public.client_documents FOR SELECT USING (auth.uid() = user_id);

-- RLS policies for contracts
CREATE POLICY "Admins can manage all contracts" ON public.contracts FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own contracts" ON public.contracts FOR SELECT USING (auth.uid() = user_id);

-- RLS policies for activity_logs (admin only)
CREATE POLICY "Admins can manage activity logs" ON public.activity_logs FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS policies for appointments
CREATE POLICY "Admins can manage all appointments" ON public.appointments FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own appointments" ON public.appointments FOR SELECT USING (auth.uid() = client_id);

-- RLS policies for telecom_analytics
CREATE POLICY "Admins can manage all analytics" ON public.telecom_analytics FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own analytics" ON public.telecom_analytics FOR SELECT USING (auth.uid() = user_id);
