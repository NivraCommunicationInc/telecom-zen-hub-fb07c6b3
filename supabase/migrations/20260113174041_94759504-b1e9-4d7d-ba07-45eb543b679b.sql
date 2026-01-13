-- Enable realtime for telephony_logs to get instant SMS updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.telephony_logs;