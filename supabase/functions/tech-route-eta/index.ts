// ETA between origin and destination via Google Routes API (connector gateway).
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
    const { originLat, originLng, destLat, destLng } = await req.json();
    if ([originLat, originLng, destLat, destLng].some((v) => typeof v !== 'number')) {
      return new Response(JSON.stringify({ error: 'missing coords' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const r = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GMAPS,
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.staticDuration',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      return new Response(JSON.stringify({ error: 'routes api', status: r.status, details: errBody }), {
        status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const j = await r.json();
    const route = j?.routes?.[0];
    const dur = route?.duration ? parseInt(String(route.duration).replace('s',''), 10) : null;
    const stat = route?.staticDuration ? parseInt(String(route.staticDuration).replace('s',''), 10) : null;
    return new Response(JSON.stringify({
      seconds: dur,
      staticSeconds: stat,
      trafficDelaySeconds: dur && stat ? dur - stat : null,
      distanceMeters: route?.distanceMeters ?? null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'bad request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
