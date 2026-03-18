
-- FIX 1: Invoice 8548553 subtotal was 0, correct to 195.99 (sum of lines before tax)
UPDATE billing_invoices 
SET subtotal = 195.99
WHERE invoice_number = '8548553' AND subtotal = 0;

-- FIX 2: Order 80876 total_amount was 86.23, correct to 248.34 (matching canonical invoice total)
UPDATE orders 
SET total_amount = 248.34
WHERE order_number = '80876' AND total_amount = 86.23;

-- FIX 3: Appointment NVR-APT-10077 missing order_id, client_email, service_address
UPDATE appointments 
SET order_id = 'c692a860-b9cf-46b3-9705-0348ee086460',
    client_email = 'lavaud.oldo9902@icloud.com',
    service_address = '1477 rue des rossignols, saint jerome, QC, J7Z6Z3',
    service_city = 'Saint-Jérôme'
WHERE appointment_number = 'NVR-APT-10077' AND order_id IS NULL;
