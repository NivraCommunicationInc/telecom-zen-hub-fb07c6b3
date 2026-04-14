# Changelog — Nivra Telecom

## [2.0.0] — 2025-04-13

### Security
- Added HTTP security headers (CSP, HSTS, X-Frame-Options, COEP, COOP, CORP)
- Implemented Cloudflare Turnstile CAPTCHA on all public forms
- Added honeypot anti-bot fields to all forms
- Rate limiting on all Edge Functions
- Fixed 6 critical RLS vulnerabilities in Supabase
- Secured all storage buckets (removed public access on private buckets)
- Hardened all Edge Functions with input validation and auth checks
- Replaced CORS wildcard with origin allowlist
- Added security audit log table
- Added global Error Boundary with error reporting
- Mandatory MFA (TOTP AAL2) for admin portal access
- Hub single-entry-point with dual-TTL session model

### Performance
- Implemented route-based code splitting (332 routes lazy-loaded)
- Added Vite manual chunk splitting (vendor-react, vendor-ui, vendor-supabase)
- Self-hosted fonts, removed render-blocking Google Fonts request
- Added WebP image support with ResponsiveImage component
- Added PWA manifest for mobile install
- Stripped console.log from production build via Vite terser

### SEO
- Added complete Open Graph and Twitter Card meta tags
- Added JSON-LD structured data (TelecommunicationsService schema)
- Created sitemap.xml and robots.txt
- Added per-page SEO with react-helmet-async
- Added Google Search Console readiness

### Legal & Compliance
- Added full Loi 25 (Quebec) privacy policy
- Added cookie consent banner
- Added CRTC compliance page
- Added Terms of Service, Refund Policy pages
- Added legal disclaimer on pricing pages

### Accessibility
- WCAG 2.1 AA compliance improvements
- Skip navigation link added
- Focus-visible styles for keyboard users
- ARIA labels on navigation and forms
- Fixed non-accessible clickable elements

### Monitoring
- Added health-check Edge Function
- Added /status page with real-time service health
- Added SystemMonitor admin widget
- Added client_errors table for frontend error tracking
- Added security_audit_log table

### Internationalization
- Full bilingual FR/EN support across 6 languages
- Language auto-detection with localStorage persistence
- Dynamic `<html lang>` attribute updates

### Marketing
- Xfinity-inspired homepage redesign
- Added TestimonialsSection with client reviews
- Added ComparisonTable (Nivra vs Bell vs Vidéotron)
- Added TrustBadges component
- Added StatsBanner with key metrics
