create or replace function public.fn_sync_order_installation_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _appt_id uuid;
  _start_time text;
  _scheduled_at timestamptz;
begin
  if lower(coalesce(new.installation_type, '')) = 'auto'
     or lower(coalesce(new.fulfillment_type, '')) = 'self_install' then
    update public.appointments
       set status = 'cancelled',
           installation_method = 'auto',
           cancellation_reason = coalesce(cancellation_reason, 'Commande basculée en auto-installation'),
           updated_at = now()
     where order_id = new.id
       and coalesce(status, '') not in ('cancelled', 'completed');
    return new;
  end if;

  if lower(coalesce(new.installation_type, '')) <> 'technician'
     and lower(coalesce(new.fulfillment_type, '')) <> 'technician' then
    return new;
  end if;

  if new.appointment_date is null then
    return new;
  end if;

  _scheduled_at := new.appointment_date;
  if coalesce(new.appointment_notes, '') ~ '^\d{2}:\d{2}-\d{2}:\d{2}$' then
    _start_time := split_part(new.appointment_notes, '-', 1);
    _scheduled_at := ((new.appointment_date::date::text || ' ' || _start_time || ':00')::timestamp at time zone 'America/Toronto');
  end if;

  select id into _appt_id
  from public.appointments
  where order_id = new.id
    and coalesce(status, '') <> 'cancelled'
  order by created_at desc
  limit 1;

  if _appt_id is null then
    insert into public.appointments (
      order_id,
      client_id,
      service_address_id,
      client_email,
      client_phone,
      service_address,
      service_city,
      service_postal_code,
      title,
      scheduled_at,
      status,
      service_type,
      installation_method,
      equipment_details,
      internal_notes,
      updated_at
    ) values (
      new.id,
      new.user_id,
      new.service_address_id,
      new.client_email,
      new.client_phone,
      coalesce(new.shipping_address, new.client_full_address),
      new.shipping_city,
      new.shipping_postal_code,
      'Installation — ' || coalesce(new.order_number, new.id::text),
      _scheduled_at,
      'hold',
      new.service_type,
      'technician',
      new.equipment_details,
      '[SYSTEM] Rendez-vous technicien synchronisé depuis la commande',
      now()
    );
  else
    update public.appointments
       set scheduled_at = _scheduled_at,
           service_address_id = coalesce(new.service_address_id, service_address_id),
           client_email = coalesce(new.client_email, client_email),
           client_phone = coalesce(new.client_phone, client_phone),
           service_address = coalesce(new.shipping_address, new.client_full_address, service_address),
           service_city = coalesce(new.shipping_city, service_city),
           service_postal_code = coalesce(new.shipping_postal_code, service_postal_code),
           service_type = coalesce(new.service_type, service_type),
           installation_method = 'technician',
           equipment_details = coalesce(new.equipment_details, equipment_details),
           updated_at = now()
     where id = _appt_id;
  end if;

  return new;
end;
$$;