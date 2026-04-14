# Security Policy — Nivra Telecom

## Supported Versions
We actively maintain and patch the latest production version of nivra-telecom.ca.

## Reporting a Vulnerability
If you discover a security vulnerability, please report it responsibly:

**Email:** security@nivra-telecom.ca  
**Response time:** We will acknowledge your report within 48 hours.  
**Disclosure:** We follow a 90-day coordinated disclosure policy.

Please do NOT open a public GitHub issue for security vulnerabilities.

## Security Measures in Place
- HTTPS enforced with HSTS preload
- Content Security Policy (CSP) headers
- X-Frame-Options: DENY (clickjacking protection)
- Cross-Origin-Embedder-Policy / Cross-Origin-Opener-Policy headers
- Rate limiting on all public endpoints
- Cloudflare Turnstile CAPTCHA on all forms
- Honeypot anti-bot fields on all public forms
- Supabase Row Level Security (RLS) on all tables
- JWT authentication with session timeout (8h absolute / 30min inactivity)
- MFA (TOTP) required for admin access
- Security audit logging for sensitive actions
- No secrets in frontend bundle
- Regular dependency audits via npm audit
- Input sanitization on all Edge Functions (50KB body limit)
- CORS restricted to production origin

## Bug Bounty
We do not currently offer a formal bug bounty program, but we deeply appreciate
responsible disclosure and will publicly acknowledge researchers who report valid issues.
