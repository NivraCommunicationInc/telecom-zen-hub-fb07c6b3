import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

type WeatherCondition = "clear" | "clouds" | "rain" | "snow" | "thunderstorm" | "drizzle" | "mist" | "fog" | "haze";

interface WeatherData {
  condition: WeatherCondition;
  isDay: boolean;
  temp: number;
}

const WeatherBackground = () => {
  const [weather, setWeather] = useState<WeatherData>({ condition: "clear", isDay: true, temp: 0 });
  const [loading, setLoading] = useState(true);

  // Generate particles for effects
  const snowflakes = useMemo(() => 
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
      size: Math.random() * 6 + 2,
      opacity: Math.random() * 0.6 + 0.4,
    })), []
  );

  const raindrops = useMemo(() => 
    Array.from({ length: 100 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 0.5 + Math.random() * 0.5,
    })), []
  );

  const stars = useMemo(() => 
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 3,
      size: Math.random() * 2 + 1,
    })), []
  );

  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const { data, error } = await supabase.functions.invoke("get-weather", {
          body: { lat, lon },
        });

        if (error) {
          console.error("Weather fetch error:", error);
          return;
        }

        setWeather({
          condition: data.condition as WeatherCondition || "clear",
          isDay: data.isDay ?? true,
          temp: data.temp ?? 0,
        });
      } catch (err) {
        console.error("Failed to fetch weather:", err);
      } finally {
        setLoading(false);
      }
    };

    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.log("Geolocation error, using Montreal:", error);
          // Fallback to Montreal coordinates
          fetchWeather(45.5017, -73.5673);
        },
        { timeout: 5000 }
      );
    } else {
      // Fallback to Montreal
      fetchWeather(45.5017, -73.5673);
    }

    // Refresh weather every 10 minutes
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
          () => fetchWeather(45.5017, -73.5673)
        );
      }
    }, 600000);

    return () => clearInterval(interval);
  }, []);

  // Background gradients based on weather and time
  const getGradient = () => {
    const { condition, isDay } = weather;

    if (!isDay) {
      // Night variations
      switch (condition) {
        case "snow":
          return "from-slate-800 via-blue-900 to-slate-900";
        case "rain":
        case "drizzle":
        case "thunderstorm":
          return "from-gray-900 via-slate-900 to-gray-950";
        case "clouds":
          return "from-slate-800 via-gray-900 to-slate-950";
        case "mist":
        case "fog":
        case "haze":
          return "from-slate-700 via-gray-800 to-slate-900";
        default:
          return "from-indigo-950 via-slate-900 to-slate-950";
      }
    }

    // Day variations
    switch (condition) {
      case "snow":
        return "from-slate-200 via-blue-100 to-white";
      case "rain":
      case "drizzle":
        return "from-slate-400 via-gray-500 to-slate-600";
      case "thunderstorm":
        return "from-gray-600 via-slate-700 to-gray-800";
      case "clouds":
        return "from-slate-300 via-gray-400 to-slate-500";
      case "mist":
      case "fog":
      case "haze":
        return "from-gray-300 via-slate-400 to-gray-400";
      default:
        return "from-sky-400 via-blue-500 to-cyan-400";
    }
  };

  const { condition, isDay } = weather;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Main gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getGradient()} transition-all`} style={{ transitionDuration: '2000ms' }} />

      {/* Sun (clear day) */}
      {condition === "clear" && isDay && (
        <div className="absolute top-16 right-20 w-24 h-24 rounded-full bg-gradient-to-br from-yellow-200 to-orange-400 opacity-90 shadow-[0_0_80px_20px_rgba(255,200,50,0.4)] animate-pulse-slow" />
      )}

      {/* Moon (clear night) */}
      {condition === "clear" && !isDay && (
        <>
          <div className="absolute top-16 right-20 w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-300 opacity-90 shadow-[0_0_60px_15px_rgba(255,255,255,0.2)]" />
          {stars.map((star) => (
            <div
              key={star.id}
              className="absolute rounded-full bg-white animate-twinkle"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animationDelay: `${star.delay}s`,
              }}
            />
          ))}
        </>
      )}

      {/* Stars for night (all conditions) */}
      {!isDay && condition !== "clear" && (
        <>
          {stars.slice(0, 20).map((star) => (
            <div
              key={star.id}
              className="absolute rounded-full bg-white/50 animate-twinkle"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animationDelay: `${star.delay}s`,
              }}
            />
          ))}
        </>
      )}

      {/* Snow effect */}
      {condition === "snow" && (
        <div className="absolute inset-0 pointer-events-none">
          {snowflakes.map((flake) => (
            <div
              key={flake.id}
              className="absolute rounded-full bg-white animate-snowfall"
              style={{
                left: `${flake.left}%`,
                width: `${flake.size}px`,
                height: `${flake.size}px`,
                opacity: flake.opacity,
                animationDuration: `${flake.duration}s`,
                animationDelay: `${flake.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Rain effect */}
      {(condition === "rain" || condition === "drizzle" || condition === "thunderstorm") && (
        <div className="absolute inset-0 pointer-events-none">
          {raindrops.map((drop) => (
            <div
              key={drop.id}
              className="absolute w-0.5 h-4 bg-gradient-to-b from-transparent via-blue-300/60 to-blue-400/80 animate-rainfall"
              style={{
                left: `${drop.left}%`,
                animationDuration: `${drop.duration}s`,
                animationDelay: `${drop.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Lightning flash for thunderstorm */}
      {condition === "thunderstorm" && (
        <div className="absolute inset-0 bg-white/0 animate-lightning pointer-events-none" />
      )}

      {/* Cloud layers */}
      {(condition === "clouds" || condition === "rain" || condition === "drizzle" || condition === "snow") && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className={`absolute -top-20 -left-20 w-96 h-48 rounded-full blur-3xl ${isDay ? "bg-gray-400/40" : "bg-gray-700/40"} animate-float-slow`} />
          <div className={`absolute top-10 right-10 w-80 h-40 rounded-full blur-3xl ${isDay ? "bg-gray-500/30" : "bg-gray-800/40"} animate-float-medium`} />
          <div className={`absolute top-40 left-1/3 w-72 h-36 rounded-full blur-3xl ${isDay ? "bg-slate-400/35" : "bg-slate-700/35"} animate-float-fast`} />
        </div>
      )}

      {/* Fog/Mist effect */}
      {(condition === "mist" || condition === "fog" || condition === "haze") && (
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${isDay ? "bg-white/30" : "bg-gray-400/20"} animate-fog-drift`} />
          <div className={`absolute inset-0 ${isDay ? "bg-gray-200/40" : "bg-gray-500/30"} animate-fog-drift-slow`} style={{ animationDelay: "2s" }} />
        </div>
      )}

      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-4 left-4 text-xs text-white/40 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
          Chargement météo...
        </div>
      )}
    </div>
  );
};

export default WeatherBackground;
