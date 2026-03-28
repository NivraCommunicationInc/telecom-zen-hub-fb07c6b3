
-- Add pdf_url to tax_documents for storing generated PDFs
ALTER TABLE public.tax_documents ADD COLUMN IF NOT EXISTS pdf_url text;

-- Add payroll_paid and tax_document notification types 
ALTER TYPE public.staff_notification_type ADD VALUE IF NOT EXISTS 'payroll_paid';
ALTER TYPE public.staff_notification_type ADD VALUE IF NOT EXISTS 'payroll_ready';
ALTER TYPE public.staff_notification_type ADD VALUE IF NOT EXISTS 'commission_approved';
ALTER TYPE public.staff_notification_type ADD VALUE IF NOT EXISTS 'withdrawal_update';
ALTER TYPE public.staff_notification_type ADD VALUE IF NOT EXISTS 'tax_document';
