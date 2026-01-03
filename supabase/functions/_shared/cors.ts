// Shared CORS helper for all edge functions
// Uses ALLOWED_ORIGINS env var (comma-separated) or falls back to APP_BASE_URL

const getAllowedOrigins = (): string[] => {
  const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
  if (allowedOriginsEnv) {
    return allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean);
  }
  
  // Fallback to APP_BASE_URL if ALLOWED_ORIGINS not set
  const appBaseUrl = Deno.env.get('APP_BASE_URL');
  if (appBaseUrl) {
    return [appBaseUrl.trim()];
  }
  
  // Development fallback - only localhost
  return ['http://localhost:5173', 'http://localhost:3000'];
};

export const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const origin = requestOrigin || '';
  
  // Check if the request origin is in the allowed list
  const isAllowed = allowedOrigins.some(allowed => {
    // Exact match or wildcard subdomain match
    if (allowed === origin) return true;
    // Handle lovable.app preview domains
    if (allowed.includes('*.lovable.app') && origin.endsWith('.lovable.app')) return true;
    return false;
  });
  
  // Only set the specific origin if it's allowed
  const corsOrigin = isAllowed ? origin : allowedOrigins[0] || '';
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Vary': 'Origin',
  };
};

export const handleCorsPreflightRequest = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
};
