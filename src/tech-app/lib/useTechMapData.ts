/**
 * useTechMapData — Fetches active service addresses (geocoded) + Mapbox public token
 * via the tech-map-data edge function.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MapPointService {
  id: string;
  plan_name: string | null;
  service_type: string | null;
  status: string;
}

export type MapPointKind = "service_address" | "technician";

export interface MapPoint {
  id: string;
  kind?: MapPointKind;
  account_id: string;
  label: string | null;
  address_line: string;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  lat: number;
  lng: number;
  services: MapPointService[];
  technician_id?: string | null;
  technician_name?: string | null;
  technician_status?: string | null;
  assignment_status?: string | null;
  location_source?: "live_gps" | "assignment_address";
}

export interface MapDataPayload {
  token: string | null;
  points: MapPoint[];
}

export function useTechMapData() {
  return useQuery<MapDataPayload>({
    queryKey: ["tech-map-data"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("tech-map-data");
      if (error) throw error;
      return (data as MapDataPayload) ?? { token: null, points: [] };
    },
  });
}
