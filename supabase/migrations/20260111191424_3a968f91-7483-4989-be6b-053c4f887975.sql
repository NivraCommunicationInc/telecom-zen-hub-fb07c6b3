-- ================================================================
-- Server-side Contest Entry Automation
-- ================================================================
-- Creates a contest entry when an order transitions to a final status
-- Final statuses: 'completed', 'installation_completed'
-- Only for NEW customers (no prior completed/active orders)
-- Idempotent: UNIQUE(contest_slug, user_id) prevents duplicates
-- ================================================================

-- Function to check if user is a new customer
CREATE OR REPLACE FUNCTION public.is_new_customer(p_user_id uuid, p_current_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prior_count int;
BEGIN
  SELECT COUNT(*) INTO prior_count
  FROM orders
  WHERE user_id = p_user_id
    AND id != p_current_order_id
    AND status IN ('completed', 'installation_completed');
  
  RETURN prior_count = 0;
END;
$$;

-- Function to create contest entry on order completion
CREATE OR REPLACE FUNCTION public.handle_order_contest_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_full_name text;
  v_phone text;
  v_is_new boolean;
  v_contest_slug text := 'welcome-500-2026';
BEGIN
  -- Only trigger on transition TO completed/installation_completed
  -- Skip if old status was already a completion status
  IF OLD.status IN ('completed', 'installation_completed') THEN
    RETURN NEW;
  END IF;
  
  -- Only trigger on final statuses
  IF NEW.status NOT IN ('completed', 'installation_completed') THEN
    RETURN NEW;
  END IF;
  
  -- Skip if no user_id
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if new customer
  v_is_new := is_new_customer(NEW.user_id, NEW.id);
  IF NOT v_is_new THEN
    RETURN NEW;
  END IF;
  
  -- Get profile info for snapshots
  SELECT email, full_name, phone
  INTO v_email, v_full_name, v_phone
  FROM profiles
  WHERE user_id = NEW.user_id;
  
  -- Skip if no email found
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Insert contest entry (idempotent due to UNIQUE constraint)
  INSERT INTO contest_entries (
    contest_slug,
    user_id,
    order_id,
    email_snapshot,
    full_name_snapshot,
    phone_snapshot
  ) VALUES (
    v_contest_slug,
    NEW.user_id,
    NEW.id,
    v_email,
    v_full_name,
    v_phone
  )
  ON CONFLICT (contest_slug, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_order_contest_entry ON orders;
CREATE TRIGGER trigger_order_contest_entry
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_contest_entry();

-- Also handle INSERT case (in case order is created already completed)
DROP TRIGGER IF EXISTS trigger_order_contest_entry_insert ON orders;
CREATE TRIGGER trigger_order_contest_entry_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'installation_completed'))
  EXECUTE FUNCTION handle_order_contest_entry();