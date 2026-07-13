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
    'https://core2617.nivra-telecom.ca',
    'https://nivra-telecom-ca.lovable.app',
    'https://id-preview--15339968-8359-42a0-b60e-042f582b4ea7.lovable.app',
    'https://15339968-8359-42a0-b60e-042f582b4ea7.lovableproject.com',
    'https://telecom-zen-hub.lovable.app',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
};

const isDynamicAllowedOrigin = (origin: string): boolean => {
  if (!origin) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (hostname.endsWith('.lovable.app')) return true;
    if (hostname.endsWith('.lovableproject.com')) return true;
    if (hostname === 'nivra-telecom.ca' || hostname.endsWith('.nivra-telecom.ca')) return true;
  } catch {
    return false;
  }
  return false;
};

export const getCorsHeaders = (requestOrigin: string | Request | null | undefined): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  // Defensive: accept either a string origin or a Request object (some legacy
  // callers pass `req` directly). Coerce to a usable string origin.
  let origin = '';
  if (typeof requestOrigin === 'string') {
    origin = requestOrigin;
  } else if (requestOrigin && typeof (requestOrigin as Request).headers?.get === 'function') {
    origin = (requestOrigin as Request).headers.get('origin') || '';
  }

  console.log(`[CORS] Request origin: ${origin}, Allowed: ${JSON.stringify(allowedOrigins)}`);
  
  // Check if the request origin is in the allowed list
  const isAllowed = allowedOrigins.some(allowed => allowed === origin) || isDynamicAllowedOrigin(origin);

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
