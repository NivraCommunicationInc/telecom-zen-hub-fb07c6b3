
CREATE OR REPLACE FUNCTION public.fn_track_referral_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_account_id UUID;
BEGIN
  IF NEW.status = 'active' AND OLD.status = 'pending' THEN
    SELECT a.id INTO v_account_id
      FROM billing_customers bc
      JOIN accounts a ON a.client_id = bc.user_id
     WHERE bc.id = NEW.customer_id LIMIT 1;

    IF v_account_id IS NOT NULL THEN
      UPDATE client_referrals
         SET qualifying_cycles_paid = qualifying_cycles_paid + 1,
             status = CASE
               WHEN qualifying_cycles_paid + 1 >= required_cycles THEN 'qualified'::referral_status
               ELSE status
             END,
             qualified_at = CASE
               WHEN qualifying_cycles_paid + 1 >= required_cycles THEN now()
               ELSE qualified_at
             END,
             reward_status = CASE
               WHEN qualifying_cycles_paid + 1 >= required_cycles
                    AND reward_status = 'not_eligible'::referral_reward_status
                 THEN 'reward_pending'::referral_reward_status
               ELSE reward_status
             END
       WHERE referred_account_id = v_account_id
         AND status NOT IN ('disqualified'::referral_status, 'reward_issued'::referral_status);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;
