-- Update 3 operational fees to new pricing
UPDATE public.operational_fees SET amount = 10.00, updated_at = now() WHERE fee_key = 'activation_single';
UPDATE public.operational_fees SET amount = 20.00, updated_at = now() WHERE fee_key = 'delivery_self_install';
UPDATE public.operational_fees SET amount = 25.00, updated_at = now() WHERE fee_key = 'installation_technician';

-- Update field sales config to match
UPDATE public.field_sales_config SET config_value = '10', updated_at = now() WHERE config_key = 'activation_fee_single';