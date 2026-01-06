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
      JSON.stringify({ request_id, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const MAPBOX_TOKEN = Deno.env.get("MAPBOX_PUBLIC_TOKEN");

    if (!MAPBOX_TOKEN) {
      console.error(`[mapbox-autocomplete] missing token request_id=${request_id}`);
      return new Response(
        JSON.stringify({ request_id, error: "Mapbox token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json().catch(() => null)) as MapboxRequestBody | null;
    if (!body?.action) {
      return new Response(
        JSON.stringify({ request_id, error: "Invalid JSON body" }),
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
          JSON.stringify({ request_id, suggestions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (query.length > 200) {
        return new Response(
          JSON.stringify({ request_id, error: "Query too long" }),
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
        
        // If 401/403, likely token issue - provide helpful message
        if (response.status === 401 || response.status === 403) {
          return new Response(
            JSON.stringify({
              request_id,
              error: "Mapbox token invalid or missing Search API scope",
              mapbox_status: response.status,
              hint: "Ensure MAPBOX_PUBLIC_TOKEN has Search API enabled in Mapbox dashboard",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            request_id,
            error: "Mapbox API error",
            mapbox_status: response.status,
            details: errorText,
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ request_id, mapbox_status: response.status, ...data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "retrieve") {
      if (!mapbox_id) {
        return new Response(
          JSON.stringify({ request_id, error: "mapbox_id is required" }),
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
            request_id,
            error: "Mapbox API error",
            mapbox_status: response.status,
            details: errorText,
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ request_id, mapbox_status: response.status, ...data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ request_id, error: "Invalid action. Use \"suggest\" or \"retrieve\"" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[mapbox-autocomplete] request_id=${request_id} error=${message}`);

    return new Response(
      JSON.stringify({ request_id, error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
