create or replace function public.fn_normalize_order_installation_flags()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _fulfillment text := lower(coalesce(new.fulfillment_type, ''));
  _installation text := lower(coalesce(new.installation_type, ''));
  _service text := lower(coalesce(new.service_type, ''));
begin
  if _fulfillment in ('technician', 'tech', 'installation', 'professional', 'professionnel')
     or _installation in ('technician', 'tech', 'installation', 'professional', 'professionnel')
     or (
       new.appointment_date is not null
       and (_service like '%internet%' or _service like '%tv%' or _service like '%bundle%' or _service like '%combo%')
       and _fulfillment not in ('self_install', 'self', 'auto', 'auto_install', 'ship', 'shipping')
     ) then
    new.installation_type := 'technician';
    new.fulfillment_type := 'technician';
  elsif _installation in ('auto', 'self', 'self_install', 'self-install', 'auto_install', 'auto-installation')
     or _fulfillment in ('auto', 'self', 'self_install', 'self-install', 'auto_install', 'ship', 'shipping') then
    new.installation_type := 'auto';
    new.fulfillment_type := 'self_install';
  end if;

  return new;
end;
$$;