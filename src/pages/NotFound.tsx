import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageSEO from "@/components/shared/PageSEO";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div style={{ background: '#020209', minHeight: '100vh' }}>
      <PageSEO
        title="Page introuvable"
        description="La page que vous recherchez n'existe pas ou a été déplacée."
        path={location.pathname}
        noindex
      />
      <Header />
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        {/* Aurora blobs */}
        <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.10) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />

        <div className="relative text-center space-y-6 max-w-lg">
          {/* 404 glyph */}
          <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <SearchX className="w-9 h-9" style={{ color: '#A78BFA' }} />
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(72px, 12vw, 120px)', letterSpacing: '-4px', lineHeight: 1, color: '#fff', marginBottom: 0 }}>
            <span className="n-shimmer-text">404</span>
          </h1>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: '#fff', letterSpacing: '-0.5px', marginTop: -8 }}>
            Page introuvable
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
            La page{' '}
            <code style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '1px 6px', fontSize: 12, color: '#A78BFA', fontFamily: "'JetBrains Mono', monospace" }}>{location.pathname}</code>{' '}
            n'existe pas ou a été déplacée.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: '#fff', borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
              Retour à l'accueil
            </Link>
            <Link to="/forfaits" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', borderRadius: 10, padding: '10px 22px', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              Voir nos forfaits
            </Link>
            <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.45)', fontSize: 13, textDecoration: 'none' }}>
              Contactez-nous
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
