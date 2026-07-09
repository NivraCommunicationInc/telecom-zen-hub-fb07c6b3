DELETE FROM public.internet_static_ip_assignments WHERE user_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.internet_wifi_settings WHERE user_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.email_queue WHERE to_email ILIKE '%nivra-test.ca%';