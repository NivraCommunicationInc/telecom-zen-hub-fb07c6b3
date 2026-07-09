-- QA M14 cleanup + docs
DELETE FROM public.email_queue WHERE to_email ILIKE '%@nivra-test.ca';
DELETE FROM public.tv_plan_changes WHERE user_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.tv_addon_subscriptions WHERE user_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.tv_vod_purchases WHERE user_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.tv_terminal_actions WHERE user_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.tv_parental_controls WHERE user_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.channel_selections WHERE user_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.admin_audit_log WHERE target_id::text='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND action LIKE 'tv.%';