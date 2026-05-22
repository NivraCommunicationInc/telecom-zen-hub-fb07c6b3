/**
 * ReferralPopup — Smart dismissable referral promotion modal for client portal
 * Shows on first dashboard load, remembers dismissal for 7 days
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/hooks/useClientAuth";
import { Button } from "@/components/ui/button";
import { Gift, Copy, X, ArrowRight, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STORAGE_KEY = "nivra_referral_popup_dismissed";
const SNOOZE_DAYS = 7;

export const ReferralPopup = () => {
  const { user } = useClientAuth();
  const [visible, setVisible] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["referral-popup-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("referral_code, first_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!profile?.referral_code) return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed).getTime();
      const now = Date.now();
      if (now - dismissedAt < SNOOZE_DAYS * 24 * 60 * 60 * 1000) return;
    }
    // Small delay so it doesn't flash on page load
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [profile?.referral_code]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  };

  const copyCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      toast.success("Code copié !");
    }
  };

  if (!visible || !profile?.referral_code) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50 animate-in fade-in duration-300" onClick={dismiss} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full pointer-events-auto animate-in zoom-in-95 fade-in duration-300 overflow-hidden">
          {/* Header stripe */}
          <div className="bg-primary px-6 py-5 relative">
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 text-primary-foreground/60 hover:text-primary-foreground p-1 rounded-full hover:bg-primary-foreground/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-foreground/10 flex items-center justify-center shrink-0">
                <Gift className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-primary-foreground">
                  Gagnez 25$ par parrainage
                </h3>
                <p className="text-primary-foreground/70 text-sm">
                  Carte-cadeau Visa/Mastercard prépayée
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {profile.first_name ? `${profile.first_name}, invitez` : "Invitez"} vos proches chez Nivra et recevez une carte-cadeau de <span className="font-semibold text-foreground">25$</span> après leur 3e cycle mensuel payé.
            </p>

            {/* Code block */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-xl border border-border">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">Votre code de parrainage</p>
                <p className="text-xl font-bold font-mono tracking-wider text-primary">
                  {profile.referral_code}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyCode}
                className="gap-1.5 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                Copier
              </Button>
            </div>

            {/* Quick steps */}
            <div className="flex items-start gap-3 text-xs text-muted-foreground">
              <div className="flex gap-6">
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">1</span> Partagez</span>
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">2</span> Il s'abonne</span>
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">3</span> Vous gagnez</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex gap-2">
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 gap-2 rounded-xl h-10"
              asChild
            >
              <Link to="/portal/referrals" onClick={dismiss}>
                <Gift className="w-4 h-4" />
                Voir mon programme
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground rounded-xl h-10"
            >
              Plus tard
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReferralPopup;
