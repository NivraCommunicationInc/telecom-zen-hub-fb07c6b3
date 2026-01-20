-- Create order internal notes table
CREATE TABLE public.order_internal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by_user_id UUID NOT NULL,
  created_by_role TEXT NOT NULL DEFAULT 'admin',
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_internal_notes ENABLE ROW LEVEL SECURITY;

-- Admin/employee can read notes
CREATE POLICY "Admin and employees can view order notes"
ON public.order_internal_notes FOR SELECT
USING (true);

-- Admin/employee can create notes
CREATE POLICY "Admin and employees can create order notes"
ON public.order_internal_notes FOR INSERT
WITH CHECK (true);

-- Only the author can update their notes
CREATE POLICY "Authors can update their own notes"
ON public.order_internal_notes FOR UPDATE
USING (created_by_user_id = auth.uid());

-- Create index for fast lookups by order
CREATE INDEX idx_order_internal_notes_order_id ON public.order_internal_notes(order_id);
CREATE INDEX idx_order_internal_notes_created_at ON public.order_internal_notes(created_at DESC);