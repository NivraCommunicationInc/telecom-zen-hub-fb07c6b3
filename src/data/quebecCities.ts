// Quebec cities with approximate coordinates for the live activity map
export interface CityCoordinates {
  name: string;
  lat: number;
  lng: number;
  region?: string;
}

export const quebecCities: Record<string, CityCoordinates> = {
  // Greater Montreal Area
  "montreal": { name: "Montréal", lat: 45.5017, lng: -73.5673, region: "Montréal" },
  "laval": { name: "Laval", lat: 45.6066, lng: -73.7124, region: "Laval" },
  "longueuil": { name: "Longueuil", lat: 45.5312, lng: -73.5185, region: "Montérégie" },
  "brossard": { name: "Brossard", lat: 45.4656, lng: -73.4595, region: "Montérégie" },
  "terrebonne": { name: "Terrebonne", lat: 45.7050, lng: -73.6356, region: "Lanaudière" },
  "repentigny": { name: "Repentigny", lat: 45.7422, lng: -73.4501, region: "Lanaudière" },
  "saint-jerome": { name: "Saint-Jérôme", lat: 45.7801, lng: -74.0036, region: "Laurentides" },
  "blainville": { name: "Blainville", lat: 45.6696, lng: -73.8751, region: "Laurentides" },
  "boucherville": { name: "Boucherville", lat: 45.5911, lng: -73.4364, region: "Montérégie" },
  "saint-jean-sur-richelieu": { name: "Saint-Jean-sur-Richelieu", lat: 45.3073, lng: -73.2629, region: "Montérégie" },
  "chateauguay": { name: "Châteauguay", lat: 45.3807, lng: -73.7478, region: "Montérégie" },
  "drummondville": { name: "Drummondville", lat: 45.8844, lng: -72.4836, region: "Centre-du-Québec" },
  "granby": { name: "Granby", lat: 45.4001, lng: -72.7328, region: "Estrie" },
  "saint-hyacinthe": { name: "Saint-Hyacinthe", lat: 45.6307, lng: -72.9570, region: "Montérégie" },
  "sorel-tracy": { name: "Sorel-Tracy", lat: 46.0411, lng: -73.1121, region: "Montérégie" },
  
  // Quebec City Area
  "quebec": { name: "Québec", lat: 46.8139, lng: -71.2080, region: "Capitale-Nationale" },
  "levis": { name: "Lévis", lat: 46.8032, lng: -71.1784, region: "Chaudière-Appalaches" },
  "saint-georges": { name: "Saint-Georges", lat: 46.1178, lng: -70.6712, region: "Chaudière-Appalaches" },
  "thetford-mines": { name: "Thetford Mines", lat: 46.0966, lng: -71.3014, region: "Chaudière-Appalaches" },
  "beauport": { name: "Beauport", lat: 46.8640, lng: -71.1825, region: "Capitale-Nationale" },
  "charlesbourg": { name: "Charlesbourg", lat: 46.8881, lng: -71.2547, region: "Capitale-Nationale" },
  
  // Saguenay-Lac-Saint-Jean
  "saguenay": { name: "Saguenay", lat: 48.4169, lng: -71.0682, region: "Saguenay-Lac-Saint-Jean" },
  "chicoutimi": { name: "Chicoutimi", lat: 48.4280, lng: -71.0582, region: "Saguenay-Lac-Saint-Jean" },
  "jonquiere": { name: "Jonquière", lat: 48.4130, lng: -71.2530, region: "Saguenay-Lac-Saint-Jean" },
  "alma": { name: "Alma", lat: 48.5492, lng: -71.6498, region: "Saguenay-Lac-Saint-Jean" },
  "roberval": { name: "Roberval", lat: 48.5167, lng: -72.2167, region: "Saguenay-Lac-Saint-Jean" },
  
  // Mauricie
  "trois-rivieres": { name: "Trois-Rivières", lat: 46.3432, lng: -72.5410, region: "Mauricie" },
  "shawinigan": { name: "Shawinigan", lat: 46.5500, lng: -72.7333, region: "Mauricie" },
  
  // Estrie
  "sherbrooke": { name: "Sherbrooke", lat: 45.4009, lng: -71.8929, region: "Estrie" },
  "magog": { name: "Magog", lat: 45.2667, lng: -72.1500, region: "Estrie" },
  
  // Outaouais
  "gatineau": { name: "Gatineau", lat: 45.4765, lng: -75.7013, region: "Outaouais" },
  "hull": { name: "Hull", lat: 45.4287, lng: -75.7145, region: "Outaouais" },
  
  // Abitibi-Témiscamingue
  "rouyn-noranda": { name: "Rouyn-Noranda", lat: 48.2369, lng: -79.0197, region: "Abitibi-Témiscamingue" },
  "val-d'or": { name: "Val-d'Or", lat: 48.0974, lng: -77.7820, region: "Abitibi-Témiscamingue" },
  "amos": { name: "Amos", lat: 48.5667, lng: -78.1167, region: "Abitibi-Témiscamingue" },
  
  // Côte-Nord
  "sept-iles": { name: "Sept-Îles", lat: 50.2111, lng: -66.3770, region: "Côte-Nord" },
  "baie-comeau": { name: "Baie-Comeau", lat: 49.2167, lng: -68.1500, region: "Côte-Nord" },
  
  // Bas-Saint-Laurent
  "rimouski": { name: "Rimouski", lat: 48.4490, lng: -68.5220, region: "Bas-Saint-Laurent" },
  "riviere-du-loup": { name: "Rivière-du-Loup", lat: 47.8333, lng: -69.5333, region: "Bas-Saint-Laurent" },
  
  // Gaspésie
  "gaspe": { name: "Gaspé", lat: 48.8333, lng: -64.4833, region: "Gaspésie" },
  "matane": { name: "Matane", lat: 48.8333, lng: -67.5333, region: "Bas-Saint-Laurent" },
  
  // Laurentides
  "mont-tremblant": { name: "Mont-Tremblant", lat: 46.2103, lng: -74.5960, region: "Laurentides" },
  "saint-sauveur": { name: "Saint-Sauveur", lat: 45.9000, lng: -74.1667, region: "Laurentides" },
  
  // Lanaudière
  "joliette": { name: "Joliette", lat: 46.0167, lng: -73.4333, region: "Lanaudière" },
  "mascouche": { name: "Mascouche", lat: 45.7500, lng: -73.6000, region: "Lanaudière" },
};

// Normalize city name for matching
export function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/g, "-") // Replace special chars with dash
    .replace(/-+/g, "-") // Remove multiple dashes
    .replace(/^-|-$/g, ""); // Remove leading/trailing dashes
}

// Find city coordinates by name (fuzzy match)
export function findCityCoordinates(cityName: string): CityCoordinates | null {
  if (!cityName) return null;
  
  const normalized = normalizeCityName(cityName);
  
  // Direct match
  if (quebecCities[normalized]) {
    return quebecCities[normalized];
  }
  
  // Partial match
  for (const [key, city] of Object.entries(quebecCities)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return city;
    }
    if (normalizeCityName(city.name).includes(normalized)) {
      return city;
    }
  }
  
  // Default to Montreal if no match
  return null;
}

// Get random coordinates within Quebec for unknown locations
export function getRandomQuebecCoordinates(): { lat: number; lng: number } {
  const cities = Object.values(quebecCities);
  const randomCity = cities[Math.floor(Math.random() * cities.length)];
  return { lat: randomCity.lat, lng: randomCity.lng };
}
