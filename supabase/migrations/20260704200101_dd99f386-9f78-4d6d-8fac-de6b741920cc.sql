UPDATE public.contracts 
SET contract_pdf_url = '8728e4f2-add2-42a4-8b92-e5007889ee62/orders/28184/order_contract.pdf',
    contract_pdf_stored_at = now(),
    pdf_generated_at = now()
WHERE id = 'b40111cd-9bca-453b-8406-647dc8f8c50f';

UPDATE public.contracts
SET contract_pdf_url = '8728e4f2-add2-42a4-8b92-e5007889ee62/orders/99666/order_contract.pdf',
    contract_pdf_stored_at = now(),
    pdf_generated_at = now()
WHERE id = '5dd0e2c1-4020-4f83-9c19-5ef70d158617';