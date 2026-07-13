create or replace function public.fn_forbid_paypal_order_payment_method()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and lower(coalesce(new.payment_method::text, '')) = 'paypal' then
    raise exception 'INVARIANT-3B-PAYPAL-FROZEN: New PayPal order payment methods are forbidden; use Square/card instead'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE'
     and lower(coalesce(new.payment_method::text, '')) = 'paypal'
     and lower(coalesce(old.payment_method::text, '')) is distinct from lower(coalesce(new.payment_method::text, '')) then
    raise exception 'INVARIANT-3B-PAYPAL-FROZEN: New PayPal order payment methods are forbidden; use Square/card instead'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;