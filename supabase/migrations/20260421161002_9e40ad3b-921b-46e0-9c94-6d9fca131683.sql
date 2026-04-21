UPDATE orders
SET
  ship_to_different_address = true,
  shipping_first_name = 'Marie',
  shipping_last_name = 'Lavoie',
  shipping_address_line = '450 Rue Sherbrooke Ouest',
  shipping_apartment = 'Apt 12',
  shipping_city = 'Montréal',
  shipping_province = 'QC',
  shipping_postal_code = 'H3A 1B5',
  shipping_instructions = 'Sonner deux fois. Code interphone : 4521.',
  activation_preference = 'SCHEDULED',
  requested_activation_date = (CURRENT_DATE + INTERVAL '10 days')::date,
  installation_details = jsonb_build_object(
    'coaxAvailable', 'yes',
    'occupancyStatus', 'occupied',
    'accessNotes', 'Stationnement visiteur disponible côté nord.'
  )
WHERE order_number = '98412';