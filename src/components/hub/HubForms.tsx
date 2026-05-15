import { ClipboardList, AlertTriangle, DollarSign, Package, Wrench } from "lucide-react";

const FORMS = [
  { icon: ClipboardList, color: "text-blue-600 bg-blue-100", title: "Plainte client", description: "Signaler un problème ou plainte d'un client.", action: "mailto:support@nivra-telecom.ca?subject=Plainte client" },
  { icon: AlertTriangle, color: "text-red-600 bg-red-100", title: "Incident terrain", description: "Rapporter un incident lors d'une visite.", action: "mailto:support@nivra-telecom.ca?subject=Incident terrain" },
  { icon: DollarSign, color: "text-emerald-600 bg-emerald-100", title: "Remboursement de dépenses", description: "Demande de remboursement des frais professionnels.", action: "mailto:rh@nivra-telecom.ca?subject=Remboursement dépenses" },
  { icon: Package, color: "text-violet-600 bg-violet-100", title: "Matériel promotionnel", description: "Commander brochures, cartes, dépliants.", action: "mailto:support@nivra-telecom.ca?subject=Matériel promotionnel" },
  { icon: Wrench, color: "text-amber-600 bg-amber-100", title: "Problème technique", description: "Rapporter un bug ou problème dans les outils.", action: "mailto:support@nivra-telecom.ca?subject=Problème technique" },
];

export default function HubForms() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
      {FORMS.map((f) => {
        const Icon = f.icon;
        return (
          <a
            key={f.title}
            href={f.action}
            className="rounded-xl border border-border bg-card p-4 hover:border-violet-400 transition-colors min-h-[44px] block"
          >
            <div className={`h-10 w-10 rounded-lg ${f.color} flex items-center justify-center mb-3`}>
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.description}</p>
          </a>
        );
      })}
    </div>
  );
}
