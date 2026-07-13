UPDATE public.appointments a
   SET status = CASE WHEN a.id = 'b27ede33-7463-4815-baa5-2c231c8c898d'::uuid THEN 'scheduled' ELSE 'cancelled' END,
       scheduled_at = CASE WHEN a.id = 'b27ede33-7463-4815-baa5-2c231c8c898d'::uuid THEN '2026-07-13 17:30:00 America/Toronto'::timestamptz ELSE a.scheduled_at END,
       duration_minutes = CASE WHEN a.id = 'b27ede33-7463-4815-baa5-2c231c8c898d'::uuid THEN 90 ELSE a.duration_minutes END,
       installation_method = CASE WHEN a.id = 'b27ede33-7463-4815-baa5-2c231c8c898d'::uuid THEN 'professional' ELSE a.installation_method END,
       service_type = CASE WHEN a.id = 'b27ede33-7463-4815-baa5-2c231c8c898d'::uuid THEN 'internet' ELSE a.service_type END,
       updated_at = now()
 WHERE a.order_id = '13b96291-7760-401c-963a-c2b0a0bd8be0'::uuid
   AND a.id <> 'f00fa386-d2ff-4a1c-ac0f-d75f85fd9f8f'::uuid;

UPDATE public.technician_assignments ta
   SET status = CASE WHEN ta.id = 'e78bcaee-e175-4cb1-a085-f507f37b3543'::uuid THEN 'scheduled' ELSE 'cancelled' END,
       scheduled_date = CASE WHEN ta.id = 'e78bcaee-e175-4cb1-a085-f507f37b3543'::uuid THEN '2026-07-13'::date ELSE ta.scheduled_date END,
       scheduled_time_start = CASE WHEN ta.id = 'e78bcaee-e175-4cb1-a085-f507f37b3543'::uuid THEN '17:30:00'::time ELSE ta.scheduled_time_start END,
       scheduled_time_end = CASE WHEN ta.id = 'e78bcaee-e175-4cb1-a085-f507f37b3543'::uuid THEN '19:00:00'::time ELSE ta.scheduled_time_end END,
       technician_id = CASE WHEN ta.id = 'e78bcaee-e175-4cb1-a085-f507f37b3543'::uuid THEN NULL ELSE ta.technician_id END,
       service_address_id = CASE WHEN ta.id = 'e78bcaee-e175-4cb1-a085-f507f37b3543'::uuid THEN '4b2cb9c9-d0a2-414e-aa22-9a2ebb98639a'::uuid ELSE ta.service_address_id END,
       updated_at = now()
 WHERE ta.order_id = '13b96291-7760-401c-963a-c2b0a0bd8be0'::uuid;