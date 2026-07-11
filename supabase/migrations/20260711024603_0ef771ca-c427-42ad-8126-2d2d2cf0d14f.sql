UPDATE public.communication_gateway_config
   SET enforce_single_door = true,
       updated_at = now()
 WHERE id = true;

INSERT INTO public.communication_gateway_config(id, enforce_single_door)
VALUES (true, true)
ON CONFLICT (id) DO NOTHING;