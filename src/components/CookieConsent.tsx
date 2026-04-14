import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const COOKIE_KEY = "nivra_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-4 sm:p-6 pointer-events-none">
      <div className="max-w-lg mx-auto sm:mx-0 sm:ml-auto bg-card border border-border rounded-2xl shadow-xl p-5 pointer-events-auto">
        <div className="flex items-start gap-3 mb-4">
          <Cookie className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nous utilisons des cookies pour améliorer votre expérience. Consultez notre{" "}
            <Link to="/politique-de-confidentialite" className="text-primary hover:underline font-medium">
              politique de confidentialité
            </Link>{" "}
            (Loi 25 Québec).
          </p>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <Button variant="ghost" size="sm" onClick={decline} className="text-muted-foreground">
            Refuser
          </Button>
          <Button size="sm" onClick={accept}>
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}
