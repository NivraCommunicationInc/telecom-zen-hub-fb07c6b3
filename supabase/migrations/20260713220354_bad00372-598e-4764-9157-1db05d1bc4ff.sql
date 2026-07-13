create or replace function public.fn_resolve_technician_profile_id(_user_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_name text;
begin
  if _user_id is null then
    return null;
  end if;

  select t.id into v_profile_id
  from public.technicians t
  where t.user_id = _user_id
  order by t.created_at desc nulls last
  limit 1;

  if v_profile_id is not null then
    return v_profile_id;
  end if;

  select coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.full_name, p.email, 'Technicien')
    into v_name
  from public.profiles p
  where p.id = _user_id
  limit 1;

  select t.id into v_profile_id
  from public.technicians t
  where lower(coalesce(t.full_name, '')) = lower(coalesce(v_name, ''))
  order by t.created_at desc nulls last
  limit 1;

  if v_profile_id is not null then
    update public.technicians
       set user_id = _user_id,
           updated_at = now()
     where id = v_profile_id
       and user_id is null;
    return v_profile_id;
  end if;

  insert into public.technicians(user_id, full_name, status)
  values (_user_id, coalesce(v_name, 'Technicien'), 'active')
  returning id into v_profile_id;

  return v_profile_id;
end;
$$;

grant execute on function public.fn_resolve_technician_profile_id(uuid) to authenticated;
grant execute on function public.fn_resolve_technician_profile_id(uuid) to service_role;

create or replace function public.reserve_dispatch_slot(p_order_id uuid, p_technician_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_tech_id uuid;
  v_existing public.dispatch_reservations%rowtype;
begin
  if v_actor is null then
    raise exception 'Non authentifié';
  end if;

  if p_technician_id <> v_actor
     and not (
       public.has_role(v_actor, 'admin'::app_role)
       or public.has_role(v_actor, 'employee'::app_role)
       or public.has_role(v_actor, 'supervisor'::app_role)
       or public.has_role(v_actor, 'techops'::app_role)
     ) then
    raise exception 'Accès refusé';
  end if;

  if not (
    public.has_role(v_actor, 'technician'::app_role)
    or public.has_role(v_actor, 'admin'::app_role)
    or public.has_role(v_actor, 'employee'::app_role)
    or public.has_role(v_actor, 'supervisor'::app_role)
    or public.has_role(v_actor, 'techops'::app_role)
  ) then
    raise exception 'Accès refusé';
  end if;

  v_tech_id := public.fn_resolve_technician_profile_id(p_technician_id);

  delete from public.dispatch_reservations where expires_at <= now();

  select * into v_existing
  from public.dispatch_reservations
  where order_id = p_order_id
    and expires_at > now()
  limit 1;

  if found and v_existing.technician_id <> v_tech_id then
    return jsonb_build_object('success', false, 'error', 'Mission réservée par un autre technicien');
  end if;

  insert into public.dispatch_reservations(order_id, technician_id, expires_at)
  values (p_order_id, v_tech_id, now() + interval '15 minutes')
  on conflict (order_id) do update
    set technician_id = excluded.technician_id,
        expires_at = excluded.expires_at;

  return jsonb_build_object('success', true, 'expires_at', now() + interval '15 minutes');
end;
$$;

create or replace function public.claim_dispatch_assignment(p_order_id uuid, p_technician_id uuid, p_scheduled_date date, p_time_start time without time zone, p_time_end time without time zone)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_tech_id uuid;
  v_assignment_id uuid;
  v_scheduled_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Non authentifié';
  end if;

  if p_technician_id <> v_actor
     and not (
       public.has_role(v_actor, 'admin'::app_role)
       or public.has_role(v_actor, 'employee'::app_role)
       or public.has_role(v_actor, 'supervisor'::app_role)
       or public.has_role(v_actor, 'techops'::app_role)
     ) then
    raise exception 'Accès refusé';
  end if;

  if not (
    public.has_role(v_actor, 'technician'::app_role)
    or public.has_role(v_actor, 'admin'::app_role)
    or public.has_role(v_actor, 'employee'::app_role)
    or public.has_role(v_actor, 'supervisor'::app_role)
    or public.has_role(v_actor, 'techops'::app_role)
  ) then
    raise exception 'Accès refusé';
  end if;

  v_tech_id := public.fn_resolve_technician_profile_id(p_technician_id);

  delete from public.dispatch_reservations where expires_at <= now();

  if exists (
    select 1 from public.dispatch_reservations
    where order_id = p_order_id
      and technician_id <> v_tech_id
      and expires_at > now()
  ) then
    return jsonb_build_object('success', false, 'error', 'Mission réservée par un autre technicien');
  end if;

  select id into v_assignment_id
  from public.technician_assignments
  where order_id = p_order_id
    and status not in ('completed','cancelled','missed')
  order by case when service_address_id is not null then 0 else 1 end, created_at desc
  limit 1
  for update;

  if v_assignment_id is null then
    insert into public.technician_assignments(order_id, technician_id, scheduled_date, scheduled_time_start, scheduled_time_end, status)
    values (p_order_id, v_tech_id, p_scheduled_date, p_time_start, p_time_end, 'scheduled')
    returning id into v_assignment_id;
  else
    update public.technician_assignments
    set technician_id = v_tech_id,
        scheduled_date = p_scheduled_date,
        scheduled_time_start = p_time_start,
        scheduled_time_end = p_time_end,
        status = 'scheduled',
        updated_at = now()
    where id = v_assignment_id
      and (technician_id is null or technician_id = v_tech_id);

    if not found then
      return jsonb_build_object('success', false, 'error', 'Mission déjà attribuée');
    end if;
  end if;

  v_scheduled_at := (p_scheduled_date::text || ' ' || p_time_start::text)::timestamp at time zone 'America/Toronto';

  update public.appointments
  set technician_id = v_tech_id,
      scheduled_at = v_scheduled_at,
      status = case when status in ('completed','cancelled','no_show') then status else 'scheduled' end,
      updated_at = now(),
      updated_by = v_actor
  where order_id = p_order_id
    and status not in ('completed','cancelled','no_show');

  update public.orders
  set scheduling_status = 'scheduled',
      updated_at = now()
  where id = p_order_id;

  delete from public.dispatch_reservations where order_id = p_order_id;

  return jsonb_build_object('success', true, 'assignment_id', v_assignment_id);
end;
$$;

create or replace function public.upsert_my_technician_location(
  p_assignment_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_heading double precision default null,
  p_speed_kmh double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_tech_id uuid;
  v_assignment public.technician_assignments%rowtype;
begin
  if v_actor is null then
    raise exception 'Non authentifié';
  end if;

  v_tech_id := public.fn_resolve_technician_profile_id(v_actor);

  select * into v_assignment
  from public.technician_assignments
  where id = p_assignment_id
  limit 1;

  if not found then
    raise exception 'Mission introuvable';
  end if;

  if v_assignment.technician_id is null then
    update public.technician_assignments
       set technician_id = v_tech_id,
           updated_at = now()
     where id = p_assignment_id;
  elsif v_assignment.technician_id <> v_tech_id
        and not (
          public.has_role(v_actor, 'admin'::app_role)
          or public.has_role(v_actor, 'employee'::app_role)
          or public.has_role(v_actor, 'supervisor'::app_role)
          or public.has_role(v_actor, 'techops'::app_role)
        ) then
    raise exception 'Accès refusé';
  end if;

  insert into public.technician_locations(
    technician_id, installation_job_id, latitude, longitude, accuracy_meters, heading, speed_kmh, is_active, recorded_at, updated_at
  ) values (
    v_tech_id, null, p_latitude, p_longitude, p_accuracy_meters, p_heading, p_speed_kmh, true, now(), now()
  )
  on conflict (technician_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_meters = excluded.accuracy_meters,
        heading = excluded.heading,
        speed_kmh = excluded.speed_kmh,
        is_active = true,
        recorded_at = now(),
        updated_at = now();

  update public.technician_assignments
     set live_location = jsonb_build_object(
          'lat', p_latitude,
          'lng', p_longitude,
          'accuracy', p_accuracy_meters,
          'heading', p_heading,
          'speed_kmh', p_speed_kmh,
          'updated_at', now()
        ),
        updated_at = now()
   where id = p_assignment_id;

  return jsonb_build_object('success', true, 'technician_id', v_tech_id);
end;
$$;

grant execute on function public.reserve_dispatch_slot(uuid, uuid) to authenticated;
grant execute on function public.claim_dispatch_assignment(uuid, uuid, date, time without time zone, time without time zone) to authenticated;
grant execute on function public.upsert_my_technician_location(uuid, double precision, double precision, double precision, double precision, double precision) to authenticated;