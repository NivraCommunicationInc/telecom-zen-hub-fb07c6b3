-- RULE 5 backfill: strip duplicate "Rabais " prefix from historical discount lines.
UPDATE public.billing_invoice_lines
SET description = regexp_replace(description, '^Rabais\s+Rabais\b', 'Rabais', 'i')
WHERE line_type = 'discount'
  AND description ~* '^Rabais\s+Rabais\b';