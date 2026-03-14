-- Harden orders.account_id: enforce NOT NULL at DB level
ALTER TABLE public.orders ALTER COLUMN account_id SET NOT NULL;