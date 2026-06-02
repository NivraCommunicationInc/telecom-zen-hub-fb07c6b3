import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageSEO from "@/components/shared/PageSEO";

export default function AccesRefuse() {
  return (
    <>
      <PageSEO
        title="Accès refusé"
        description="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
        path="/acces-refuse"
        noindex
      />
      <div style={{ background: '#020209' }} className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-10%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(239,68,68,0.12) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div className="relative text-center space-y-5 max-w-md">
          <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <ShieldAlert className="w-9 h-9" style={{ color: '#fca5a5' }} />
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(72px, 12vw, 100px)', letterSpacing: '-4px', lineHeight: 1, color: '#fff', marginBottom: 0 }}>403</h1>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: '#fff', letterSpacing: '-0.5px', marginTop: -8 }}>Accès refusé</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
