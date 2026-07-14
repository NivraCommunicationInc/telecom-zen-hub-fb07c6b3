// Weather batch for Mission Control — Google Maps Weather API via connector gateway
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_maps';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GMAPS = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!LOVABLE_API_KEY || !GMAPS) {
    return new Response(JSON.stringify({ error: 'Google Maps connector missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const body = await req.json();
    const points: Array<{ id?: string; lat: number; lng: number }> = Array.isArray(body?.points) ? body.points : [];
    if (points.length === 0) {
      return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const results = await Promise.all(points.slice(0, 12).map(async (p) => {
      try {
        const r = await fetch(`${GATEWAY}/weather/v1/currentConditions:lookup?location.latitude=${p.lat}&location.longitude=${p.lng}`, {
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': GMAPS },
        });
        if (!r.ok) return { id: p.id, error: `weather ${r.status}` };
        const j = await r.json();
        return {
          id: p.id,
          tempC: j?.temperature?.degrees ?? null,
          feelsLikeC: j?.feelsLikeTemperature?.degrees ?? null,
          condition: j?.weatherCondition?.description?.text ?? j?.weatherCondition?.type ?? null,
          iconBase: j?.weatherCondition?.iconBaseUri ?? null,
          precipProbability: j?.precipitation?.probability?.percent ?? null,
        };
      } catch (e) {
        return { id: p.id, error: e instanceof Error ? e.message : 'weather error' };
      }
    }));
    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'bad request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
