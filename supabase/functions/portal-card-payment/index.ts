// PayPal decommissioned — Phase 3.B.
// This function previously created and captured PayPal orders from the customer portal.
// It is now a 410 stub. Use the Square-based portal payment flow instead.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: 'gone',
      message: 'portal-card-payment is decommissioned. PayPal is no longer accepted. Use the Square portal payment flow.',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
