import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const NotAuthorized = () => {
  return (
    <div style={{ background: '#020209' }} className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-10%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(239,68,68,0.12) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <div className="relative text-center max-w-md">
        <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <ShieldX className="w-10 h-10" style={{ color: '#fca5a5' }} />
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(72px, 12vw, 100px)', letterSpacing: '-4px', lineHeight: 1, color: '#fff', marginBottom: 16 }}>
          401
        </h1>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: '#fff', letterSpacing: '-0.5px', marginBottom: 12 }}>
          Accès non autorisé
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          Seuls les administrateurs peuvent accéder au tableau de bord.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="hero">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à l'accueil
            </Link>
          </Button>
          <Button asChild variant="heroOutline">
            <Link to="/admin/login">
              Se connecter
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotAuthorized;
