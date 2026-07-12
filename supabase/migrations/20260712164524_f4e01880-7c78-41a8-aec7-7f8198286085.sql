-- QA HARNESS Phase 6.5 STEP 1 : promote seed order to confirmed
UPDATE public.orders
   SET status = 'confirmed'
 WHERE id = '5dc1e845-a6f8-4322-9589-9f96ad2929f4';