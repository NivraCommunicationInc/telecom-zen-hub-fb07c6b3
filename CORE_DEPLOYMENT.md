# Nivra Core — Deployment Guide for app.nivra-telecom.ca

## Architecture

Nivra Core has its own:
- **Entry point**: `src/core-app/main.tsx`
- **Root component**: `src/core-app/CoreApp.tsx`
- **Path resolver**: `src/core-app/lib/corePaths.ts`
- **HTML**: `core.html`
- **Build config**: `vite.config.core.ts`
- **Output dir**: `dist-core/`

## Dual-Mode Routing

All Core links use `corePath()` from `src/core-app/lib/corePaths.ts`.
The `VITE_CORE_BASE_PATH` env var controls the route prefix:

| Mode | `VITE_CORE_BASE_PATH` | URLs |
|------|----------------------|------|
| **Standalone** (app.nivra-telecom.ca) | `""` (empty string) | `/login`, `/dashboard`, `/orders` |
| **Embedded** (nivra-telecom.ca/core) | `/core` (default) | `/core/login`, `/core/dashboard`, `/core/orders` |

## Build

```bash
# Standalone build for app.nivra-telecom.ca
VITE_CORE_BASE_PATH="" npx vite build --config vite.config.core.ts
```

Output goes to `dist-core/`. Deploy this folder to `app.nivra-telecom.ca`.

## Environment Variables

Required in production (set in Cloudflare Pages dashboard):
```
VITE_SUPABASE_URL=https://xtgngmtxggascbxnswvb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_CORE_BASE_PATH=          # empty string for standalone root-level routing
```

## SPA Routing

All requests must rewrite to `core.html` for client-side routing.

### Cloudflare Pages (`_redirects` in dist-core/)
```
/*    /core.html   200
```

### Vercel (`vercel.json`)
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/core.html" }]
}
```

### Nginx
```nginx
server {
    listen 443 ssl;
    server_name app.nivra-telecom.ca;
    root /var/www/nivra-core;
    location / {
        try_files $uri $uri/ /core.html;
    }
}
```

## DNS

At your registrar for `nivra-telecom.ca`, add:

| Type | Name | Value |
|------|------|-------|
| CNAME | `app` | `<your-cloudflare-pages-project>.pages.dev` |

## Security

- `core.html` includes `<meta name="robots" content="noindex, nofollow" />`
- Authentication enforced by `CoreProtectedRoute` (session + internal role check)
- Consider IP allowlisting at CDN level

## Verification Checklist

After deployment, test:
1. `https://app.nivra-telecom.ca/dashboard` → redirects to `/login` (no session)
2. Login with internal role user → lands on `/dashboard`
3. All navigation links work without `/core` prefix
4. Hard refresh on any deep route (`/orders/123`) → page loads (SPA rewrite works)
5. Logout → redirects to `/login`
