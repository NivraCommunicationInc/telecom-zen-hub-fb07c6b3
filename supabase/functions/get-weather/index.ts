import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lon } = await req.json();

    if (!lat || !lon) {
      return new Response(
        JSON.stringify({ error: "Latitude and longitude are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENWEATHERMAP_API_KEY");
    if (!apiKey) {
      console.error("OPENWEATHERMAP_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Weather service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("OpenWeatherMap error:", data);
      return new Response(
        JSON.stringify({ error: "Failed to fetch weather data" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract relevant weather info
    const weatherInfo = {
      condition: data.weather?.[0]?.main?.toLowerCase() || "clear",
      description: data.weather?.[0]?.description || "",
      temp: data.main?.temp || 0,
      icon: data.weather?.[0]?.icon || "01d",
      isDay: data.weather?.[0]?.icon?.includes("d") ?? true,
    };

    console.log("Weather fetched:", weatherInfo);

    return new Response(
      JSON.stringify(weatherInfo),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in get-weather function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
