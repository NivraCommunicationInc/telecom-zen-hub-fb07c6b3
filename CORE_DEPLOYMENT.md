# Nivra Core — Deployment Guide for app.nivra-telecom.ca

## Architecture

Nivra Core has its own:
- **Entry point**: `src/core-app/main.tsx`
- **Root component**: `src/core-app/CoreApp.tsx`
- **HTML**: `core.html`
- **Build config**: `vite.config.core.ts`
- **Output dir**: `dist-core/`

## Build

```bash
# Build Core standalone
npx vite build --config vite.config.core.ts
```

Output goes to `dist-core/`. Deploy this folder to `app.nivra-telecom.ca`.

## Environment Variables

Required in production:
```
VITE_SUPABASE_URL=https://xtgngmtxggascbxnswvb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_CORE_BASE_PATH=/core   # or "" if Core is the root app
```

## SPA Routing

All requests must rewrite to `core.html` for client-side routing.

### Netlify (`_redirects` in dist-core/)
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

### Cloudflare Pages
Set build output to `dist-core/` and add a `_redirects` file:
```
/*  /core.html  200
```

## DNS

Point `app.nivra-telecom.ca` (CNAME or A record) to your hosting provider.

## Security Notes

- `core.html` includes `<meta name="robots" content="noindex, nofollow" />` — Core is never indexed
- Authentication is enforced by `CoreProtectedRoute` (session + internal role check)
- Consider adding IP allowlisting at the CDN/hosting level for extra protection

## Dual-mode Support

The same codebase supports both deployment modes:

| Mode | Base Path | HTML Entry | Build Command |
|------|-----------|------------|---------------|
| Embedded (nivra-telecom.ca/core) | `/core` | `index.html` | `npx vite build` |
| Standalone (app.nivra-telecom.ca) | `/core` | `core.html` | `npx vite build --config vite.config.core.ts` |

The `VITE_CORE_BASE_PATH` env var controls the route prefix (default: `/core`).
