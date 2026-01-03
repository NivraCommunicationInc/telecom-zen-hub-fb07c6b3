import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    
    if (!MAPBOX_TOKEN) {
      console.error('MAPBOX_PUBLIC_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, query, mapbox_id, session_token } = await req.json();
    console.log(`Mapbox autocomplete request: action=${action}, query=${query}, mapbox_id=${mapbox_id}`);

    if (action === 'suggest') {
      if (!query || query.length < 3) {
        return new Response(
          JSON.stringify({ suggestions: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const params = new URLSearchParams({
        q: query,
        access_token: MAPBOX_TOKEN,
        session_token: session_token || crypto.randomUUID(),
        country: 'CA',
        types: 'address',
        limit: '6',
        language: 'fr'
      });

      const url = `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`;
      console.log('Calling Mapbox suggest API');
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Mapbox suggest error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Mapbox API error', details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Mapbox returned ${data.suggestions?.length || 0} suggestions`);
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'retrieve') {
      if (!mapbox_id) {
        return new Response(
          JSON.stringify({ error: 'mapbox_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        session_token: session_token || crypto.randomUUID()
      });

      const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapbox_id}?${params}`;
      console.log('Calling Mapbox retrieve API for:', mapbox_id);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Mapbox retrieve error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Mapbox API error', details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log('Mapbox retrieve response received');
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "suggest" or "retrieve"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Mapbox autocomplete error:', errorMessage);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
