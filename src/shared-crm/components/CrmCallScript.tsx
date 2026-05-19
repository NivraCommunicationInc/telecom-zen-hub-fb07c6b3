/**
 * CrmCallScript — Dynamic call script shown during a call.
 * Provides scripted prompts (intro, value, objections, close) that adapt
 * to the contact's city and known interest tags.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmContact } from "../lib/crmTypes";
import { displayName } from "../lib/crmTypes";

interface Props {
  contact: CrmContact;
  agentName?: string | null;
}

interface ScriptBlock {
  id: string;
  title: string;
  body: string;
}

function buildScript(contact: CrmContact, agentName: string): ScriptBlock[] {
  const name = displayName(contact);
  const firstName = contact.first_name ?? name.split(" ")[0] ?? "";
  const city = contact.city ?? contact.service_city ?? "votre région";
  const tags = (contact.interest_tags ?? []).join(", ") || "Internet, TV et Mobile";

  return [
    {
      id: "intro",
      title: "1️⃣ Introduction (15 sec)",
      body: `Bonjour ${firstName}, ici ${agentName} de Nivra Télécom. Comment allez-vous aujourd'hui ?\n\nJe vous appelle parce que nous venons tout juste de déployer notre service à ${city} et je voulais vous présenter notre offre rapidement — ça vous prend 2 minutes ?`,
    },
    {
      id: "value",
      title: "2️⃣ Proposition de valeur",
      body: `Nivra c'est :\n• Prépayé — aucun engagement, aucune surprise sur la facture\n• Activation rapide à domicile\n• Support local au Québec\n• Forfaits ${tags} adaptés à vos besoins\n\nPrésentement, qu'est-ce que vous utilisez comme service ${tags.split(",")[0]?.trim() ?? "Internet"} ?`,
    },
    {
      id: "discovery",
      title: "3️⃣ Découverte des besoins",
      body: `• Combien payez-vous par mois ?\n• Êtes-vous satisfait de votre vitesse / service ?\n• Combien de personnes utilisent l'Internet à la maison ?\n• Avez-vous la télévision ? Combien de téléviseurs ?\n• Avez-vous un cellulaire prépayé ou avec contrat ?`,
    },
    {
      id: "objections",
      title: "4️⃣ Réponses aux objections",
      body: `« Je suis sous contrat » → Aucun problème, on peut planifier l'activation à la fin de votre contrat.\n« Trop cher » → Notre prépayé revient souvent moins cher — aucun frais caché.\n« Je vais y penser » → Pas de souci, est-ce que je peux vous rappeler dans 48h avec une offre personnalisée ?\n« Pas intéressé » → Aucun problème, merci de votre temps. Bonne journée !`,
    },
    {
      id: "close",
      title: "5️⃣ Conclusion / Vente",
      body: `Parfait ${firstName}, je vous propose de réserver votre activation maintenant — c'est sans engagement et le premier mois est gratuit avec le code BIENVENUE2026.\n\nQuelle date d'installation vous conviendrait le mieux ?`,
    },
    {
      id: "voicemail",
      title: "📞 Message vocal (boîte vocale)",
      body: `Bonjour ${firstName}, ici ${agentName} de Nivra Télécom. Nous offrons maintenant nos services Internet, TV et Mobile prépayés à ${city}. Premier mois gratuit avec le code BIENVENUE2026. Rappelez-nous au 1-800-NIVRA ou visitez nivra-telecom.ca. Merci, bonne journée !`,
    },
  ];
}

export function CrmCallScript({ contact, agentName }: Props) {
  const [open, setOpen] = useState<string | null>("intro");
  const blocks = buildScript(contact, agentName ?? "votre conseiller Nivra");

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5">
      <div className="px-3 py-2 border-b border-violet-500/20 flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
        <ScrollText className="h-3.5 w-3.5" />
        Script d'appel dynamique
      </div>
      <div className="divide-y divide-violet-500/10">
        {blocks.map((b) => {
          const isOpen = open === b.id;
          return (
            <div key={b.id}>
              <button
                onClick={() => setOpen(isOpen ? null : b.id)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-violet-500/10 transition-colors",
                  isOpen && "bg-violet-500/10"
                )}
              >
                <span>{b.title}</span>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 text-[13px] whitespace-pre-wrap text-foreground/90 leading-relaxed">
                  {b.body}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
