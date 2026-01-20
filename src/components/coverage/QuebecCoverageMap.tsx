import React from "react";

interface QuebecCoverageMapProps {
  className?: string;
}

// Coverage zones data - cities where service is available
const coverageZones = [
  // Greater Montreal Area - Full coverage
  { name: "Montréal", lat: 45.5017, lng: -73.5673, coverage: "full", size: "large" },
  { name: "Laval", lat: 45.6066, lng: -73.7124, coverage: "full", size: "medium" },
  { name: "Longueuil", lat: 45.5312, lng: -73.5185, coverage: "full", size: "medium" },
  { name: "Brossard", lat: 45.4656, lng: -73.4595, coverage: "full", size: "small" },
  { name: "Terrebonne", lat: 45.7050, lng: -73.6356, coverage: "full", size: "small" },
  
  // Quebec City Area
  { name: "Québec", lat: 46.8139, lng: -71.2080, coverage: "full", size: "large" },
  { name: "Lévis", lat: 46.8032, lng: -71.1784, coverage: "full", size: "medium" },
  
  // Major cities
  { name: "Gatineau", lat: 45.4765, lng: -75.7013, coverage: "full", size: "medium" },
  { name: "Sherbrooke", lat: 45.4009, lng: -71.8929, coverage: "full", size: "medium" },
  { name: "Trois-Rivières", lat: 46.3432, lng: -72.5410, coverage: "full", size: "medium" },
  { name: "Saguenay", lat: 48.4169, lng: -71.0682, coverage: "full", size: "medium" },
  { name: "Drummondville", lat: 45.8844, lng: -72.4836, coverage: "full", size: "small" },
  { name: "Granby", lat: 45.4001, lng: -72.7328, coverage: "full", size: "small" },
  { name: "Saint-Hyacinthe", lat: 45.6307, lng: -72.9570, coverage: "full", size: "small" },
  { name: "Saint-Jean-sur-Richelieu", lat: 45.3073, lng: -73.2629, coverage: "full", size: "small" },
  { name: "Saint-Jérôme", lat: 45.7801, lng: -74.0036, coverage: "full", size: "small" },
  
  // Extended coverage areas
  { name: "Rimouski", lat: 48.4490, lng: -68.5220, coverage: "extended", size: "small" },
  { name: "Rouyn-Noranda", lat: 48.2369, lng: -79.0197, coverage: "extended", size: "small" },
  { name: "Val-d'Or", lat: 48.0974, lng: -77.7820, coverage: "extended", size: "small" },
  { name: "Sept-Îles", lat: 50.2111, lng: -66.3770, coverage: "extended", size: "small" },
  { name: "Baie-Comeau", lat: 49.2167, lng: -68.1500, coverage: "extended", size: "small" },
  { name: "Rivière-du-Loup", lat: 47.8333, lng: -69.5333, coverage: "extended", size: "small" },
  { name: "Gaspé", lat: 48.8333, lng: -64.4833, coverage: "extended", size: "small" },
];

// Convert lat/lng to SVG coordinates
const latLngToSvg = (lat: number, lng: number): { x: number; y: number } => {
  // Quebec bounds: lat 45-52, lng -80 to -57
  const minLat = 44.5;
  const maxLat = 52;
  const minLng = -80;
  const maxLng = -57;
  
  const x = ((lng - minLng) / (maxLng - minLng)) * 500 + 50;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 400 + 50;
  
  return { x, y };
};

export const QuebecCoverageMap: React.FC<QuebecCoverageMapProps> = ({ className }) => {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 600 500"
        className="w-full h-full"
        style={{ maxHeight: "500px" }}
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="quebecFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="quebecStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
          </linearGradient>
          
          {/* Coverage zone gradients */}
          <radialGradient id="fullCoverage" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="extendedCoverage" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
          
          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Quebec province outline - simplified realistic shape */}
        <path
          d="M 120 380 
             C 130 370, 145 365, 160 360
             L 180 350 L 195 338 L 210 325
             C 225 310, 235 295, 245 280
             L 260 260 L 275 242 L 290 228
             C 305 215, 322 205, 340 198
             L 365 190 L 392 185 L 420 182
             C 445 180, 468 182, 488 188
             L 508 195 L 525 205 L 538 218
             C 548 230, 555 245, 558 262
             L 560 280 L 558 298 L 552 315
             C 545 335, 535 352, 522 368
             L 508 382 L 492 395 L 475 408
             C 458 420, 440 430, 420 438
             L 398 445 L 375 450 L 352 455
             C 328 460, 305 462, 282 460
             L 260 455 L 240 448 L 222 438
             C 202 425, 185 410, 172 392
             L 165 378 L 160 365 L 155 350
             C 152 335, 150 320, 152 305
             L 155 290 L 160 275 L 168 262
             C 178 248, 192 238, 208 232
             L 225 228 L 242 225 L 260 225
             C 275 225, 288 228, 300 235
             L 312 242 L 322 252 L 330 265
             C 335 278, 338 292, 335 308
             L 330 325 L 322 340 L 310 355
             C 298 368, 282 378, 265 385
             L 245 390 L 225 392 L 205 390
             C 185 388, 168 382, 152 372
             L 140 362 L 130 350 L 122 338
             C 115 325, 112 310, 115 295
             Z"
          fill="url(#quebecFill)"
          stroke="url(#quebecStroke)"
          strokeWidth="2"
          className="transition-all duration-300"
        />
        
        {/* St. Lawrence River */}
        <path
          d="M 150 385 Q 200 375, 250 370 Q 300 365, 350 358 Q 400 350, 450 340 Q 480 335, 510 328"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeOpacity="0.3"
          strokeLinecap="round"
        />

        {/* Coverage zones */}
        {coverageZones.map((zone, index) => {
          const { x, y } = latLngToSvg(zone.lat, zone.lng);
          const radius = zone.size === "large" ? 35 : zone.size === "medium" ? 25 : 18;
          
          return (
            <g key={index}>
              {/* Coverage area glow */}
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={zone.coverage === "full" ? "url(#fullCoverage)" : "url(#extendedCoverage)"}
              />
              {/* City marker */}
              <circle
                cx={x}
                cy={y}
                r={zone.size === "large" ? 5 : zone.size === "medium" ? 4 : 3}
                fill={zone.coverage === "full" ? "#22c55e" : "#3b82f6"}
                filter="url(#glow)"
              />
              {/* City label for large/medium cities */}
              {(zone.size === "large" || zone.size === "medium") && (
                <text
                  x={x}
                  y={y - (zone.size === "large" ? 12 : 10)}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-medium"
                  style={{ fontSize: zone.size === "large" ? "11px" : "9px" }}
                >
                  {zone.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(20, 420)">
          <rect
            x="0"
            y="0"
            width="180"
            height="60"
            rx="8"
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth="1"
            fillOpacity="0.95"
          />
          
          {/* Full coverage */}
          <circle cx="20" cy="20" r="6" fill="#22c55e" />
          <text x="35" y="24" className="fill-foreground text-[11px]">
            Couverture complète 4G/LTE
          </text>
          
          {/* Extended coverage */}
          <circle cx="20" cy="44" r="6" fill="#3b82f6" />
          <text x="35" y="48" className="fill-foreground text-[11px]">
            Couverture étendue
          </text>
        </g>
      </svg>
    </div>
  );
};

export default QuebecCoverageMap;
