DO $$
DECLARE
  v_order_id UUID := '09cc272b-de97-4143-8174-58199178f287';
  v_result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = v_order_id) THEN
    v_result := orchestrate_order(v_order_id);
    RAISE NOTICE 'Orchestration result: %', v_result;
  END IF;
END $$