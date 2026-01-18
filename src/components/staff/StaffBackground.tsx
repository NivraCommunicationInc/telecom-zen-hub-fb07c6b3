import { useEffect, useState } from "react";

/**
 * StaffBackground - Animated gradient background for staff portal
 * Premium dark theme with subtle animated gradients and floating particles
 */
export const StaffBackground = () => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);

  useEffect(() => {
    // Generate floating particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient - Deep navy to slate */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Animated gradient orbs */}
      <div className="absolute inset-0">
        {/* Primary orb - teal accent */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] animate-staff-orb-1"
          style={{
            background: "radial-gradient(circle, hsl(168 100% 37%) 0%, transparent 70%)",
            top: "-10%",
            right: "-10%",
          }}
        />
        
        {/* Secondary orb - cyan */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[100px] animate-staff-orb-2"
          style={{
            background: "radial-gradient(circle, hsl(195 100% 50%) 0%, transparent 70%)",
            bottom: "-15%",
            left: "-10%",
          }}
        />
        
        {/* Tertiary orb - purple accent */}
        <div 
          className="absolute w-[400px] h-[400px] rounded-full opacity-10 blur-[80px] animate-staff-orb-3"
          style={{
            background: "radial-gradient(circle, hsl(270 80% 60%) 0%, transparent 70%)",
            top: "40%",
            left: "30%",
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-teal-400/30 animate-staff-float"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette effect */}
      <div 
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </div>
  );
};

export default StaffBackground;
