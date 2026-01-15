import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  city: string;
  activityType: string;
  label: string;
  isRecent: boolean;
}

interface QuebecMapProps {
  points: MapPoint[];
  className?: string;
  onPointClick?: (point: MapPoint) => void;
}

// Quebec boundaries (approximate)
const QUEBEC_BOUNDS = {
  minLat: 45.0,
  maxLat: 52.0,
  minLng: -80.0,
  maxLng: -57.0,
};

// Convert lat/lng to SVG coordinates
function latLngToSvg(lat: number, lng: number, width: number, height: number) {
  const x = ((lng - QUEBEC_BOUNDS.minLng) / (QUEBEC_BOUNDS.maxLng - QUEBEC_BOUNDS.minLng)) * width;
  const y = ((QUEBEC_BOUNDS.maxLat - lat) / (QUEBEC_BOUNDS.maxLat - QUEBEC_BOUNDS.minLat)) * height;
  return { x, y };
}

// Activity type colors
const activityColors: Record<string, string> = {
  order_started: "#f59e0b",
  order_completed: "#22c55e",
  signup: "#3b82f6",
  login: "#8b5cf6",
  profile_update: "#6366f1",
  subscription: "#ec4899",
  payment: "#10b981",
  page_view: "#64748b",
};

export const QuebecMap: React.FC<QuebecMapProps> = ({ points, className, onPointClick }) => {
  const width = 400;
  const height = 500;

  // Group points by approximate location to prevent overlap
  const groupedPoints = useMemo(() => {
    const grouped: Map<string, MapPoint[]> = new Map();
    
    for (const point of points) {
      const key = `${Math.round(point.lat * 10)}_${Math.round(point.lng * 10)}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(point);
    }
    
    return Array.from(grouped.entries()).map(([key, pts]) => ({
      key,
      points: pts,
      lat: pts[0].lat,
      lng: pts[0].lng,
      count: pts.length,
      hasRecent: pts.some((p) => p.isRecent),
      primaryType: pts[0].activityType,
    }));
  }, [points]);

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        style={{ background: "linear-gradient(180deg, hsl(var(--muted)/0.3) 0%, hsl(var(--muted)/0.1) 100%)" }}
      >
        {/* Quebec outline (simplified) */}
        <path
          d="M 50 350 
             Q 80 380, 120 360 
             L 160 340 
             Q 200 320, 220 280 
             L 240 240 
             Q 260 200, 280 160 
             L 300 120 
             Q 320 80, 360 60 
             L 380 50 
             Q 350 100, 340 150 
             L 330 200 
             Q 320 250, 300 300 
             L 280 350 
             Q 260 380, 220 400 
             L 180 420 
             Q 140 440, 100 420 
             L 60 400 
             Q 40 380, 50 350 
             Z"
          fill="hsl(var(--muted)/0.2)"
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />

        {/* Major cities markers (reference) */}
        <g opacity="0.3">
          <circle cx="180" cy="380" r="2" fill="hsl(var(--muted-foreground))" />
          <text x="185" y="383" fontSize="6" fill="hsl(var(--muted-foreground))">MTL</text>
          
          <circle cx="250" cy="280" r="2" fill="hsl(var(--muted-foreground))" />
          <text x="255" y="283" fontSize="6" fill="hsl(var(--muted-foreground))">QC</text>
          
          <circle cx="120" cy="380" r="2" fill="hsl(var(--muted-foreground))" />
          <text x="125" y="383" fontSize="6" fill="hsl(var(--muted-foreground))">GAT</text>
        </g>

        {/* Activity points */}
        {groupedPoints.map((group) => {
          const { x, y } = latLngToSvg(group.lat, group.lng, width, height);
          const color = activityColors[group.primaryType] || activityColors.page_view;
          const radius = Math.min(6 + group.count * 2, 15);

          return (
            <g key={group.key} className="cursor-pointer" onClick={() => onPointClick?.(group.points[0])}>
              {/* Pulse animation for recent activity */}
              {group.hasRecent && (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={color}
                    opacity="0.3"
                    className="animate-ping"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={radius * 1.5}
                    fill="none"
                    stroke={color}
                    strokeWidth="1"
                    opacity="0.5"
                    className="animate-pulse"
                  />
                </>
              )}
              
              {/* Main point */}
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={color}
                stroke="white"
                strokeWidth="1.5"
                className={cn(
                  "transition-all duration-300",
                  group.hasRecent && "drop-shadow-lg"
                )}
              />
              
              {/* Count badge */}
              {group.count > 1 && (
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="white"
                >
                  {group.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm rounded-md p-2 text-xs">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span>Commande</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
            <span>Inscription</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
            <span>Connexion</span>
          </div>
        </div>
      </div>
    </div>
  );
};
