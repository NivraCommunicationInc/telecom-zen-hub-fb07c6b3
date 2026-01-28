import { useEffect, useState } from "react";

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const getTimeOfDay = (): TimeOfDay => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
};

const TimeBasedBackground = () => {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(getTimeOfDay());
  const [stars, setStars] = useState<{ id: number; left: number; top: number; delay: number; size: number }[]>([]);

  useEffect(() => {
    // Update time every minute
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Generate stars for night mode
    if (timeOfDay === "night") {
      const newStars = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 3,
        size: Math.random() * 2 + 1,
      }));
      setStars(newStars);
    }
  }, [timeOfDay]);

  const gradients: Record<TimeOfDay, string> = {
    morning: "from-amber-200 via-orange-300 to-rose-400",
    afternoon: "from-sky-300 via-cyan-400 to-blue-500",
    evening: "from-purple-400 via-pink-500 to-rose-500",
    night: "from-slate-900 via-indigo-950 to-slate-950",
  };

  const overlayColors: Record<TimeOfDay, string> = {
    morning: "bg-gradient-to-t from-orange-100/20 to-transparent",
    afternoon: "bg-gradient-to-t from-blue-100/20 to-transparent",
    evening: "bg-gradient-to-t from-purple-200/20 to-transparent",
    night: "bg-gradient-to-t from-indigo-900/30 to-transparent",
  };

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Main gradient background with smooth transition */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradients[timeOfDay]} transition-all ease-in-out`}
        style={{ transitionDuration: '3000ms' }}
      />

      {/* Animated gradient overlay */}
      <div className={`absolute inset-0 ${overlayColors[timeOfDay]} transition-all`} style={{ transitionDuration: '3000ms' }} />

      {/* Animated orbs for depth */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large floating orb 1 */}
        <div
          className={`absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-30 animate-float-slow ${
            timeOfDay === "night" ? "bg-indigo-600" : 
            timeOfDay === "evening" ? "bg-pink-400" :
            timeOfDay === "morning" ? "bg-orange-300" : "bg-cyan-300"
          }`}
          style={{ top: "-10%", left: "-10%" }}
        />
        
        {/* Large floating orb 2 */}
        <div
          className={`absolute w-[400px] h-[400px] rounded-full blur-3xl opacity-20 animate-float-medium ${
            timeOfDay === "night" ? "bg-purple-700" : 
            timeOfDay === "evening" ? "bg-violet-400" :
            timeOfDay === "morning" ? "bg-yellow-300" : "bg-sky-400"
          }`}
          style={{ bottom: "-5%", right: "-5%" }}
        />

        {/* Medium floating orb */}
        <div
          className={`absolute w-[300px] h-[300px] rounded-full blur-2xl opacity-25 animate-float-fast ${
            timeOfDay === "night" ? "bg-blue-800" : 
            timeOfDay === "evening" ? "bg-rose-400" :
            timeOfDay === "morning" ? "bg-rose-300" : "bg-teal-300"
          }`}
          style={{ top: "40%", right: "20%" }}
        />
      </div>

      {/* Stars for night mode */}
      {timeOfDay === "night" && (
        <div className="absolute inset-0">
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
          
          {/* Shooting star */}
          <div className="absolute top-20 left-1/4 w-1 h-1 bg-white rounded-full animate-shooting-star" />
        </div>
      )}

      {/* Sun/Moon element */}
      {timeOfDay !== "night" && (
        <div
          className={`absolute w-24 h-24 rounded-full blur-sm ${
            timeOfDay === "morning" ? "bg-gradient-to-br from-yellow-200 to-orange-300 top-16 right-20" :
            timeOfDay === "afternoon" ? "bg-gradient-to-br from-yellow-100 to-yellow-300 top-12 right-24" :
            "bg-gradient-to-br from-orange-400 to-red-500 top-20 right-16"
          } opacity-80 transition-all`}
          style={{ transitionDuration: '3000ms' }}
        />
      )}

      {timeOfDay === "night" && (
        <div className="absolute top-16 right-20 w-20 h-20 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 opacity-90 shadow-[0_0_60px_10px_rgba(255,255,255,0.3)]" />
      )}

      {/* Subtle grain texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />
    </div>
  );
};

export default TimeBasedBackground;
