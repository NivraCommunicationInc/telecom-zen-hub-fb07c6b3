import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type Action = "suggest" | "retrieve";

type MapboxRequestBody = {
  action: Action;
  query?: string;
  mapbox_id?: string;
  session_token?: string;
};

const getAllowedOrigin = (origin: string | null): string => {
  const o = origin ?? "";
  if (!o) return "https://nivratelecom.ca";

  const allowedExact = new Set([
    "https://nivratelecom.ca",
    "https://www.nivratelecom.ca",
  ]);

  if (allowedExact.has(o)) return o;

  // Allow Lovable preview domains (variable subdomains)
  if (o.endsWith(".lovableproject.com")) return o;
  if (o.endsWith(".lovable.app")) return o;
  
  // Allow localhost for development
  if (o.startsWith("http://localhost:")) return o;

  // Fallback (do NOT reflect unknown origins)
  return "https://nivratelecom.ca";
};

const buildCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowOrigin = getAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
};

serve(async (req) => {
  const request_id = crypto.randomUUID();
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    console.log(`[mapbox-autocomplete] preflight request_id=${request_id} origin=${origin ?? ""}`);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, request_id, status: 405, message: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const MAPBOX_TOKEN = Deno.env.get("MAPBOX_PUBLIC_TOKEN");

    if (!MAPBOX_TOKEN) {
      console.error(`[mapbox-autocomplete] missing token request_id=${request_id}`);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          request_id, 
          status: 401,
          message: "Mapbox token not configured",
          hint: "MAPBOX_PUBLIC_TOKEN secret is missing"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json().catch(() => null)) as MapboxRequestBody | null;
    if (!body?.action) {
      return new Response(
        JSON.stringify({ ok: false, request_id, status: 400, message: "Invalid JSON body - action required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const action = body.action;
    const query = (body.query ?? "").trim();
    const mapbox_id = (body.mapbox_id ?? "").trim();
    const session_token = (body.session_token ?? "").trim() || crypto.randomUUID();

    console.log(
      `[mapbox-autocomplete] request_id=${request_id} origin=${origin ?? ""} method=${req.method} action=${action} query_len=${query.length}`
    );

    if (action === "suggest") {
      if (query.length < 3) {
        return new Response(
          JSON.stringify({ ok: true, request_id, suggestions: [], mapbox_status: 200 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (query.length > 200) {
        return new Response(
          JSON.stringify({ ok: false, request_id, status: 400, message: "Query too long (max 200 chars)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Proximity near Laval/Montreal for better Quebec relevance
      const proximityLaval = "-73.75,45.55";

      const params = new URLSearchParams({
        q: query,
        access_token: MAPBOX_TOKEN,
        session_token,
        country: "CA",
        types: "address",
        limit: "6",
        language: "fr",
        proximity: proximityLaval,
      });

      const url = `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`;
      const response = await fetch(url);

      console.log(
        `[mapbox-autocomplete] request_id=${request_id} mapbox_suggest_status=${response.status}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[mapbox-autocomplete] request_id=${request_id} mapbox_error status=${response.status} body=${errorText}`
        );
        
        // Provide clear error messages for common issues
        let message = "Mapbox API error";
        let hint = "";
        
        if (response.status === 401) {
          message = "Mapbox token invalid";
          hint = "Check MAPBOX_PUBLIC_TOKEN secret value";
        } else if (response.status === 403) {
          message = "Mapbox token missing Search API scope";
          hint = "Enable Search API in Mapbox dashboard for this token";
        } else if (response.status === 429) {
          message = "Mapbox rate limit exceeded";
          hint = "Too many requests - please wait";
        }

        return new Response(
          JSON.stringify({
            ok: false,
            request_id,
            status: response.status,
            mapbox_status: response.status,
            message,
            hint,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ 
          ok: true, 
          request_id, 
          mapbox_status: response.status, 
          suggestions: data.suggestions || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "retrieve") {
      if (!mapbox_id) {
        return new Response(
          JSON.stringify({ ok: false, request_id, status: 400, message: "mapbox_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        session_token,
      });

      const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapbox_id}?${params}`;
      const response = await fetch(url);

      console.log(
        `[mapbox-autocomplete] request_id=${request_id} mapbox_retrieve_status=${response.status}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({
            ok: false,
            request_id,
            status: response.status,
            mapbox_status: response.status,
            message: "Mapbox retrieve API error",
            details: errorText,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ 
          ok: true, 
          request_id, 
          mapbox_status: response.status, 
          features: data.features || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, request_id, status: 400, message: "Invalid action. Use 'suggest' or 'retrieve'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[mapbox-autocomplete] request_id=${request_id} error=${message}`);

    return new Response(
      JSON.stringify({ ok: false, request_id, status: 500, message: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
