// PayPal decommissioned — Phase 3.B.
// This function previously created PayPal orders for field agents. It is now a 410 stub.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: 'gone',
      message: 'field-payment-initiate is decommissioned. PayPal is no longer accepted. Use the Square field flow.',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
