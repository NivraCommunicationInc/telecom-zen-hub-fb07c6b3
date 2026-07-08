// PayPal decommissioned — Phase 3.B.
// This function previously captured card payments via PayPal. It is now a 410 stub.
// Use the Square-based flow instead.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: 'gone',
      message: 'core-process-card-payment is decommissioned. PayPal is no longer accepted. Use the Square manual card flow.',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
