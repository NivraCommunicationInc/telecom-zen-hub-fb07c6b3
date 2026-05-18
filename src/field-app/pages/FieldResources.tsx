/**
 * FieldResources — Training materials, sales scripts, FAQ, and reference docs for field agents.
 */
import { useState } from "react";
import { BookOpen, FileText, MessageSquare, HelpCircle, ChevronDown, ChevronRight, Wifi, Tv, Phone, Shield, DollarSign, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const SALES_SCRIPTS = [
  {
    title: "Ouverture de porte",
    content: `Bonjour! Je suis [Nom] de Nivra Télécom. On est un nouveau fournisseur dans votre quartier qui offre Internet haute vitesse et la télé — sans contrat, sans surprises sur la facture. Est-ce que vous avez 2 minutes? Je peux vous montrer combien vous pourriez économiser par rapport à votre fournisseur actuel.`,
  },
  {
    title: "Gestion d'objection — Déjà un fournisseur",
    content: `Je comprends tout à fait! La plupart de nos clients avaient aussi un fournisseur avant de découvrir Nivra. Ce qui les a convaincus, c'est qu'on n'a pas de contrat — vous pouvez essayer sans engagement. Et nos prix sont transparents: pas de frais cachés qui augmentent après 6 mois.`,
  },
  {
    title: "Gestion d'objection — Pas intéressé",
    content: `Aucun problème! Juste pour que vous le sachiez — on est disponible dans votre secteur et les installations sont gratuites ce mois-ci. Voici ma carte, si jamais vous changez d'avis ou si votre fournisseur actuel augmente ses prix, vous pouvez me contacter directement.`,
  },
  {
    title: "Fermeture — Prise de rendez-vous",
    content: `Parfait! Alors pour l'installation, on peut vous offrir un créneau cette semaine. Un technicien vient chez vous, installe tout — ça prend environ 45 minutes. Qu'est-ce qui serait mieux pour vous, le matin ou l'après-midi?`,
  },
];

const FAQ = [
  { q: "Quels sont les délais d'installation?", a: "En général, l'installation est planifiée dans les 3 à 5 jours ouvrables suivant la confirmation de la commande et du paiement." },
  { q: "Y a-t-il un contrat?", a: "Non! Nivra fonctionne 100% en prépayé, sans contrat ni engagement. Le client peut annuler à tout moment." },
  { q: "Quels modes de paiement sont acceptés?", a: "Interac (virement ou comptant), PayPal, et cartes de crédit via PayPal. Pas de paiement direct par carte sur le terrain." },
  { q: "Le client peut-il garder son numéro de téléphone?", a: "Oui, la portabilité de numéro est disponible pour les services mobiles." },
  { q: "Que faire si l'adresse n'est pas couverte?", a: "Utilisez l'outil 'Recherche adresse' pour vérifier la couverture. Si l'adresse n'est pas éligible, capturez le lead et Nivra fera un suivi." },
  { q: "Comment fonctionne ma commission?", a: "Les commissions sont calculées automatiquement après la synchronisation de la vente avec Core. Elles passent par les statuts: En attente → Approuvée → Payée." },
  { q: "Que faire si la synchronisation échoue?", a: "Allez dans le détail de la commande et appuyez sur 'Relancer la synchronisation'. Si le problème persiste, contactez votre superviseur." },
];

const SERVICE_INFO = [
  { icon: Wifi, title: "Internet", items: ["Vitesses de 60 à 400 Mbps", "WiFi inclus", "Installation professionnelle", "Aucun contrat"] },
  { icon: Tv, title: "Télévision", items: ["200+ chaînes", "Inclut Internet", "Terminaux Nivra fournis", "Max 4 terminaux par adresse"] },
  { icon: Phone, title: "Mobile", items: ["Forfaits prépayés", "Données Canada/US", "Portabilité de numéro", "SIM Nivra"] },
];

export default function FieldResources() {
  const [activeSection, setActiveSection] = useState<string>("scripts");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openScript, setOpenScript] = useState<number | null>(null);

  const sections = [
    { key: "scripts", label: "Scripts de vente", icon: MessageSquare },
    { key: "services", label: "Services", icon: Zap },
    { key: "faq", label: "FAQ", icon: HelpCircle },
    { key: "tips", label: "Conseils", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Ressources</h1>
        <p className="text-sm text-gray-400">Outils, scripts et FAQ pour maximiser vos ventes</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-700 rounded-xl p-1">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              activeSection === s.key ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
            )}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Sales Scripts */}
      {activeSection === "scripts" && (
        <div className="space-y-2">
          {SALES_SCRIPTS.map((script, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenScript(openScript === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">{script.title}</span>
                </div>
                {openScript === i ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </button>
              {openScript === i && (
                <div className="px-4 pb-4 border-t border-[#F3F4F6]">
                  <p className="text-sm text-gray-300 leading-relaxed mt-3 italic bg-gray-800 p-3 rounded-lg">
                    "{script.content}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Services Info */}
      {activeSection === "services" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SERVICE_INFO.map((svc) => (
            <div key={svc.title} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <svc.icon className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white">{svc.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {svc.items.map((item, i) => (
                  <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* FAQ */}
      {activeSection === "faq" && (
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm font-semibold text-white pr-4">{item.q}</span>
                {openFaq === i ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 border-t border-[#F3F4F6]">
                  <p className="text-sm text-gray-300 mt-3 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      {activeSection === "tips" && (
        <div className="space-y-3">
          {[
            { icon: "🎯", title: "Ciblez les bonnes heures", text: "Les meilleurs créneaux sont entre 16h et 19h en semaine, et 10h-14h le samedi." },
            { icon: "🏘️", title: "Travaillez par secteur", text: "Concentrez-vous sur un quartier à la fois. Les voisins parlent entre eux — une vente en génère souvent d'autres." },
            { icon: "📋", title: "Préparez votre catalogue", text: "Ayez toujours accès à l'onglet 'Offres approuvées' pour montrer les prix exacts au client." },
            { icon: "💬", title: "Écoutez avant de vendre", text: "Posez des questions sur leur service actuel, leurs frustrations. La vente se fait quand le client se sent compris." },
            { icon: "📱", title: "Capturez chaque contact", text: "Même si la personne n'achète pas aujourd'hui, créez un lead. Un bon suivi transforme 30% des 'non' en 'oui'." },
            { icon: "⚡", title: "Utilisez la recherche d'adresse", text: "Avant de sonner, vérifiez si l'adresse a déjà un service Nivra pour éviter de perdre du temps." },
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-gray-800 border border-gray-700 rounded-xl">
              <span className="text-2xl">{tip.icon}</span>
              <div>
                <p className="text-sm font-bold text-white">{tip.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{tip.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
