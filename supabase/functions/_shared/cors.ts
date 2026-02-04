// Shared CORS helper for all edge functions
// Uses ALLOWED_ORIGINS env var (comma-separated) or falls back to APP_BASE_URL

const getAllowedOrigins = (): string[] => {
  const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
  console.log(`[CORS] Raw ALLOWED_ORIGINS: ${allowedOriginsEnv}`);
  
  if (allowedOriginsEnv && allowedOriginsEnv.trim() !== '' && allowedOriginsEnv !== 'ALLOWED_ORIGINS') {
    const origins = allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean);
    console.log(`[CORS] Parsed origins:`, origins);
    return origins;
  }
  
  // Fallback to APP_BASE_URL if ALLOWED_ORIGINS not set
  const appBaseUrl = Deno.env.get('APP_BASE_URL');
  if (appBaseUrl && appBaseUrl.trim() !== '') {
    console.log(`[CORS] Using APP_BASE_URL fallback: ${appBaseUrl}`);
    return [appBaseUrl.trim()];
  }
  
  // Production fallback - include all known domains
  console.log(`[CORS] Using hardcoded fallback origins`);
  return [
    'https://nivra-telecom.ca',
    'https://www.nivra-telecom.ca',
    'https://telecom-zen-hub.lovable.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
};

export const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const origin = requestOrigin || '';
  
  console.log(`[CORS] Request origin: ${origin}, Allowed: ${JSON.stringify(allowedOrigins)}`);
  
  // Check if the request origin is in the allowed list
  const isAllowed = allowedOrigins.some(allowed => {
    // Exact match
    if (allowed === origin) return true;

    // Always allow Lovable preview domains (variable subdomains)
    if (origin.endsWith('.lovableproject.com')) return true;
    if (origin.endsWith('.lovable.app')) return true;

    // Backwards compatibility: if allowed contains a pattern, allow matching subdomains
    if (allowed.includes('lovable.app') && origin.endsWith('.lovable.app')) return true;
    if (allowed.includes('lovableproject.com') && origin.endsWith('.lovableproject.com')) return true;

    return false;
  });

  // Only set the specific origin if it's allowed
  const corsOrigin = isAllowed ? origin : allowedOrigins[0] || '';
  console.log(`[CORS] isAllowed: ${isAllowed}, corsOrigin: ${corsOrigin}`);
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
};

export const handleCorsPreflightRequest = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
};
