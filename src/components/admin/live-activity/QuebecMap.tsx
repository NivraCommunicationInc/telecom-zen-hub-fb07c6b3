import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { QuebecMapSVG, QuebecMapDefs } from "./QuebecMapSVG";

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
  showLabels?: boolean;
}

// Quebec boundaries (approximate for mapping)
const QUEBEC_BOUNDS = {
  minLat: 44.5,
  maxLat: 62.5,
  minLng: -79.5,
  maxLng: -56.5,
};

// Convert lat/lng to SVG coordinates
function latLngToSvg(lat: number, lng: number, width: number, height: number) {
  const x = ((lng - QUEBEC_BOUNDS.minLng) / (QUEBEC_BOUNDS.maxLng - QUEBEC_BOUNDS.minLng)) * width;
  const y = ((QUEBEC_BOUNDS.maxLat - lat) / (QUEBEC_BOUNDS.maxLat - QUEBEC_BOUNDS.minLat)) * height;
  return { x, y };
}

// Activity type colors with better visibility
const activityColors: Record<string, { fill: string; stroke: string; glow: string }> = {
  order_started: { fill: "#f59e0b", stroke: "#d97706", glow: "rgba(245, 158, 11, 0.5)" },
  order_completed: { fill: "#22c55e", stroke: "#16a34a", glow: "rgba(34, 197, 94, 0.5)" },
  signup: { fill: "#3b82f6", stroke: "#2563eb", glow: "rgba(59, 130, 246, 0.5)" },
  login: { fill: "#8b5cf6", stroke: "#7c3aed", glow: "rgba(139, 92, 246, 0.5)" },
  profile_update: { fill: "#6366f1", stroke: "#4f46e5", glow: "rgba(99, 102, 241, 0.5)" },
  subscription: { fill: "#ec4899", stroke: "#db2777", glow: "rgba(236, 72, 153, 0.5)" },
  payment: { fill: "#10b981", stroke: "#059669", glow: "rgba(16, 185, 129, 0.5)" },
  page_view: { fill: "#64748b", stroke: "#475569", glow: "rgba(100, 116, 139, 0.5)" },
};

// Major Quebec cities with coordinates
const majorCities = [
  { name: "Montréal", lat: 45.5017, lng: -73.5673, size: "large" },
  { name: "Québec", lat: 46.8139, lng: -71.2082, size: "large" },
  { name: "Gatineau", lat: 45.4765, lng: -75.7013, size: "medium" },
  { name: "Sherbrooke", lat: 45.4042, lng: -71.8929, size: "medium" },
  { name: "Trois-Rivières", lat: 46.3432, lng: -72.5421, size: "medium" },
  { name: "Saguenay", lat: 48.4279, lng: -71.0686, size: "medium" },
  { name: "Laval", lat: 45.6066, lng: -73.7124, size: "medium" },
  { name: "Longueuil", lat: 45.5312, lng: -73.5185, size: "small" },
  { name: "Terrebonne", lat: 45.6960, lng: -73.6366, size: "small" },
  { name: "Saint-Jean-sur-Richelieu", lat: 45.3073, lng: -73.2628, size: "small" },
];

export const QuebecMap: React.FC<QuebecMapProps> = ({ 
  points, 
  className, 
  onPointClick,
  showLabels = true 
}) => {
  const width = 920;
  const height = 1350;
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  // Group points by approximate location to prevent overlap
  const groupedPoints = useMemo(() => {
    const grouped: Map<string, MapPoint[]> = new Map();

    for (const point of points) {
      const key = `${Math.round(point.lat * 5)}_${Math.round(point.lng * 5)}`;
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
      city: pts[0].city,
    }));
  }, [points]);

  // Calculate city positions
  const cityPositions = useMemo(() => {
    return majorCities.map(city => ({
      ...city,
      ...latLngToSvg(city.lat, city.lng, width, height)
    }));
  }, []);

  return (
    <div className={cn("relative w-full h-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ 
          background: "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted)/0.3) 100%)" 
        }}
      >
        <QuebecMapDefs />
        
        {/* Background grid pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path 
              d="M 40 0 L 0 0 0 40" 
              fill="none" 
              stroke="hsl(var(--border))" 
              strokeWidth="0.5"
              opacity="0.3"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5" />
        
        {/* Quebec Province Shape */}
        <QuebecMapSVG />

        {/* City markers (background reference) */}
        {showLabels && cityPositions.map((city) => (
          <g key={city.name} opacity="0.6">
            <circle
              cx={city.x}
              cy={city.y}
              r={city.size === "large" ? 6 : city.size === "medium" ? 4 : 3}
              fill="hsl(var(--muted-foreground))"
              stroke="hsl(var(--background))"
              strokeWidth="1"
            />
            <text
              x={city.x + 10}
              y={city.y + 4}
              fontSize={city.size === "large" ? "14" : "11"}
              fontWeight={city.size === "large" ? "600" : "400"}
              fill="hsl(var(--muted-foreground))"
              className="select-none"
            >
              {city.name}
            </text>
          </g>
        ))}

        {/* Activity points */}
        {groupedPoints.map((group) => {
          const { x, y } = latLngToSvg(group.lat, group.lng, width, height);
          const colors = activityColors[group.primaryType] || activityColors.page_view;
          const baseRadius = Math.min(12 + group.count * 3, 28);
          const isHovered = hoveredPoint === group.key;

          return (
            <g 
              key={group.key} 
              className="cursor-pointer"
              onClick={() => onPointClick?.(group.points[0])}
              onMouseEnter={() => setHoveredPoint(group.key)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Pulse animation for recent activity */}
              {group.hasRecent && (
                <>
                  {/* Outer pulse ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r={baseRadius * 2}
                    fill="none"
                    stroke={colors.fill}
                    strokeWidth="2"
                    opacity="0.3"
                  >
                    <animate
                      attributeName="r"
                      from={baseRadius}
                      to={baseRadius * 2.5}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.6"
                      to="0"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  
                  {/* Inner pulse ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r={baseRadius * 1.5}
                    fill="none"
                    stroke={colors.fill}
                    strokeWidth="2"
                    opacity="0.5"
                  >
                    <animate
                      attributeName="r"
                      from={baseRadius}
                      to={baseRadius * 2}
                      dur="2s"
                      begin="0.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.7"
                      to="0"
                      dur="2s"
                      begin="0.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  
                  {/* Glow effect */}
                  <circle
                    cx={x}
                    cy={y}
                    r={baseRadius + 4}
                    fill={colors.glow}
                    filter="url(#glow)"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.6;0.3;0.6"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}

              {/* Main point */}
              <circle
                cx={x}
                cy={y}
                r={isHovered ? baseRadius * 1.2 : baseRadius}
                fill={colors.fill}
                stroke="white"
                strokeWidth="3"
                filter={group.hasRecent ? "url(#pulse-glow)" : "url(#dropShadow)"}
                className="transition-all duration-300"
              />

              {/* Count badge */}
              {group.count > 1 && (
                <text
                  x={x}
                  y={y + 5}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="bold"
                  fill="white"
                  className="select-none"
                >
                  {group.count}
                </text>
              )}

              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={x + baseRadius + 5}
                    y={y - 20}
                    width={group.city.length * 8 + 20}
                    height="40"
                    rx="6"
                    fill="hsl(var(--card))"
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                    filter="url(#dropShadow)"
                  />
                  <text
                    x={x + baseRadius + 15}
                    y={y - 2}
                    fontSize="13"
                    fontWeight="600"
                    fill="hsl(var(--foreground))"
                  >
                    {group.city}
                  </text>
                  <text
                    x={x + baseRadius + 15}
                    y={y + 14}
                    fontSize="11"
                    fill="hsl(var(--muted-foreground))"
                  >
                    {group.count} activité{group.count > 1 ? "s" : ""}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Map label */}
        <text
          x={width / 2}
          y={50}
          textAnchor="middle"
          fontSize="18"
          fontWeight="600"
          fill="hsl(var(--muted-foreground))"
          opacity="0.7"
          className="select-none"
        >
          Province de Québec
        </text>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-card/95 backdrop-blur-sm rounded-lg p-3 border shadow-lg">
        <div className="text-xs font-semibold text-muted-foreground mb-2">Légende</div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#22c55e] shadow-sm" />
            <span className="text-xs">Commande</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#3b82f6] shadow-sm" />
            <span className="text-xs">Inscription</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#8b5cf6] shadow-sm" />
            <span className="text-xs">Connexion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#f59e0b] shadow-sm" />
            <span className="text-xs">Paiement</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-xs text-muted-foreground">Activité récente (&lt;5 min)</span>
        </div>
      </div>

      {/* Stats overlay */}
      {points.length > 0 && (
        <div className="absolute top-3 right-3 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border shadow-lg">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-sm font-semibold">{points.length}</span>
            <span className="text-xs text-muted-foreground">points actifs</span>
          </div>
        </div>
      )}
    </div>
  );
};
