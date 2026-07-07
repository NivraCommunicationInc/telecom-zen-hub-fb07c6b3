-- Cohérence classification order_items :
--   service_type ∈ (equipment, fee)  ⇒  is_recurring = false
--   is_recurring = true              ⇒  service_type ∈ (internet, tv, mobile, streaming, security, addon)
ALTER TABLE public.order_items
  ADD CONSTRAINT chk_order_items_service_type_recurring_coherence
  CHECK (
    CASE
      WHEN service_type IN ('equipment','fee') THEN is_recurring = false
      WHEN is_recurring = true THEN service_type IN ('internet','tv','mobile','streaming','security','addon')
      ELSE true
    END
  );

COMMENT ON CONSTRAINT chk_order_items_service_type_recurring_coherence ON public.order_items IS
  'INVARIANT-ORDER-ITEM-CLASSIFICATION — Un équipement ou frais unique ne peut jamais être récurrent. Un service récurrent doit appartenir à internet/tv/mobile/streaming/security/addon.';