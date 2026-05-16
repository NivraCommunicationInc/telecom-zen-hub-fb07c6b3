UPDATE public.billing_invoice_lines
SET description = regexp_replace(description, '^Rabais[[:space:]]+Rabais([[:space:]])', 'Rabais\1', 'i')
WHERE line_type = 'discount'
  AND description ILIKE 'Rabais Rabais %';