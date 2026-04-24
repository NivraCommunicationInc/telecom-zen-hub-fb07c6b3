/**
 * TermsOfUseModal — Blocking Terms of Use modal for internal portals.
 *
 * Behavior:
 * - Cannot be dismissed (no close button, no backdrop dismiss, no ESC)
 * - "J'ai lu et j'accepte" only enabled after user scrolls to bottom
 * - Records terms_accepted_at, terms_accepted_version, terms_accepted_ip on profile
 *
 * Mount once per portal at the top of the layout. The hook
 * useInternalPortalGate() decides whether to render it.
 */
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const TERMS_VERSION = "1.0-2026";

const TERMS_TEXT = `CONDITIONS D'UTILISATION — PORTAIL NIVRA FIELD & RH
Nivra Communications Inc.
Version 1.0 — En vigueur à compter du 1er janvier 2026

1. ACCEPTATION DES CONDITIONS
En accédant aux portails Nivra Field et Nivra RH, vous reconnaissez avoir lu, compris et accepté l'intégralité des présentes conditions. Cette acceptation est enregistrée dans votre profil avec la date et l'heure exactes et est accessible par Nivra Communications Inc. en tout temps.

2. NATURE DE VOTRE ACCÈS
Votre accès aux portails Nivra Field et Nivra RH vous est accordé à titre personnel et professionnel uniquement. Cet accès est conditionnel au maintien de votre relation d'emploi ou de représentation avec Nivra Communications Inc. Tout accès non autorisé ou toute tentative de contournement des mesures de sécurité constitue une violation grave des présentes conditions.

3. CONFIDENTIALITÉ DES INFORMATIONS CLIENTS
Dans le cadre de vos fonctions, vous aurez accès à des renseignements personnels de clients de Nivra Telecom, incluant mais sans s'y limiter : noms, adresses, numéros de téléphone, adresses courriel, informations de paiement partielles et historique de services. Vous vous engagez formellement à ne jamais divulguer, partager, copier, transmettre ou utiliser ces informations à des fins autres que l'exécution de vos fonctions professionnelles chez Nivra Communications Inc. Cette obligation de confidentialité s'applique pendant et après la fin de votre relation avec Nivra, sans limite de durée.

4. MANIPULATION DES DONNÉES DE PAIEMENT
Vous pouvez être amené à traiter des informations de paiement dans le cadre de ventes terrain. Vous vous engagez à traiter ces informations avec le plus haut niveau de discrétion, à ne jamais noter, photographier, mémoriser ou transmettre des informations de carte de crédit ou de paiement à quiconque, et à signaler immédiatement toute anomalie ou tentative de fraude à votre superviseur et à support@nivra-telecom.ca.

5. UTILISATION DES OUTILS NIVRA
Les outils, portails, applications et systèmes mis à votre disposition par Nivra Communications Inc. sont destinés exclusivement à un usage professionnel dans le cadre de vos fonctions. Il vous est strictement interdit d'utiliser ces outils à des fins personnelles, de tenter d'accéder à des sections non autorisées, d'installer des logiciels non approuvés, de partager vos identifiants de connexion avec quiconque, ou d'utiliser les systèmes Nivra pour des activités illégales ou contraires à l'éthique.

6. AUTHENTIFICATION ET SÉCURITÉ
Vous êtes responsable de la sécurité de votre compte. L'authentification multi-facteurs (MFA) est obligatoire. Vous devez activer le MFA par courriel ou par application d'authentification lors de votre première connexion. Vous devez signaler immédiatement toute connexion suspecte ou compromission de votre compte à support@nivra-telecom.ca.

7. COMMISSIONS ET RÉMUNÉRATION
Les commissions sont calculées selon la grille en vigueur définie par Nivra Communications Inc. et peuvent être modifiées avec un préavis raisonnable. Les commissions sont versées uniquement sur les ventes activées et confirmées. Toute tentative de manipulation des ventes, de fausses entrées ou de fraude aux commissions entraînera la récupération immédiate des commissions versées et peut mener à des poursuites légales.

8. REPRÉSENTATION ET CONDUITE
En tant que représentant de Nivra Telecom, vous vous engagez à représenter la marque de façon professionnelle et honnête, à ne jamais faire de fausses représentations sur les produits ou services Nivra, à respecter le code de conduite Nivra en tout temps, et à traiter chaque client avec respect et professionnalisme.

9. SURVEILLANCE ET AUDIT
Nivra Communications Inc. se réserve le droit de surveiller l'utilisation des portails et systèmes dans le respect des lois applicables. Toutes les actions effectuées dans les portails sont enregistrées dans un journal d'audit incluant : l'identité de l'utilisateur, l'action effectuée, la date et l'heure, et les données modifiées.

10. VIOLATION ET CONSÉQUENCES
Toute violation des présentes conditions peut entraîner la suspension immédiate de votre accès, la récupération des commissions versées, des mesures disciplinaires pouvant aller jusqu'au congédiement, et des poursuites civiles ou criminelles selon la gravité de la violation.

11. MODIFICATIONS
Nivra Communications Inc. se réserve le droit de modifier les présentes conditions en tout temps. Vous serez notifié par courriel et devrez accepter les nouvelles conditions lors de votre prochaine connexion.

12. JURIDICTION
Les présentes conditions sont régies par les lois du Québec et du Canada. Tout litige sera soumis aux tribunaux du Québec.

13. FOURNITURE DES SERVICES INTERNET
Nivra Telecom est un fournisseur de services indépendant qui assure la gestion de la facturation, du service client et des ententes contractuelles. Les services Internet sont fournis à l'aide d'infrastructures de télécommunication existantes au Canada. La disponibilité, la performance et la qualité du service peuvent dépendre des réseaux utilisés.`;

interface Props {
  userId: string;
  onAccepted: () => void;
}

export default function TermsOfUseModal({ userId, onAccepted }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // 12px tolerance for small rounding
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 12;
    if (atBottom) setScrolledToBottom(true);
  };

  // Re-evaluate after mount in case the content fits without scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 12) setScrolledToBottom(true);
  }, []);

  const accept = async () => {
    setSubmitting(true);
    try {
      // Best-effort fetch of public IP (not authoritative; server triggers/audit
      // log capture the canonical IP via request headers).
      let ip: string | null = null;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        if (r.ok) ip = (await r.json())?.ip ?? null;
      } catch {
        /* ignore */
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_accepted_version: TERMS_VERSION,
          terms_accepted_ip: ip,
        })
        .eq("user_id", userId);

      if (error) throw error;
      toast.success("Conditions acceptées");
      onAccepted();
    } catch (err) {
      console.error("[TermsOfUseModal] accept error:", err);
      toast.error("Impossible d'enregistrer l'acceptation. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent
        className="max-w-3xl gap-0 p-0 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Conditions d'utilisation — Action requise
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Veuillez lire les conditions jusqu'au bas de la page pour pouvoir continuer.
          </p>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[55vh] overflow-y-auto px-6 py-4 text-sm leading-relaxed whitespace-pre-line bg-muted/30"
        >
          {TERMS_TEXT}
        </div>

        <div className="px-6 py-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {scrolledToBottom
              ? "✓ Vous avez consulté l'intégralité des conditions."
              : "Faites défiler jusqu'à la fin pour activer le bouton."}
          </span>
          <Button
            onClick={accept}
            disabled={!scrolledToBottom || submitting}
            className="min-w-[200px]"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            J'ai lu et j'accepte
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
