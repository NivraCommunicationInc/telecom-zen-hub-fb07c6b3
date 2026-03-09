import { RefreshCcw, Search, Filter } from "lucide-react";

const SubscriptionsPage = () => (
  <div className="space-y-5">
    <div>
      <h1 className="text-xl font-semibold text-white">Abonnements</h1>
      <p className="text-[13px] text-[hsl(220,10%,50%)] mt-0.5">Services actifs et abonnements</p>
    </div>

    {/* Stats row */}
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: "Actifs", value: "—" },
        { label: "En pause", value: "—" },
        { label: "Expirés", value: "—" },
        { label: "Annulés", value: "—" },
      ].map((s) => (
        <div key={s.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[hsl(220,10%,40%)]">{s.label}</p>
          <p className="text-lg font-semibold text-white mt-1">{s.value}</p>
        </div>
      ))}
    </div>

    {/* Toolbar */}
    <div className="flex items-center gap-3">
      <div className="flex-1 flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
        <Search className="h-4 w-4 text-[hsl(220,10%,40%)]" />
        <span className="text-[13px] text-[hsl(220,10%,35%)]">Rechercher un abonnement…</span>
      </div>
      <button className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 text-[13px] text-[hsl(220,10%,50%)] hover:text-white transition-colors">
        <Filter className="h-3.5 w-3.5" />
        Filtres
      </button>
    </div>

    {/* Table shell */}
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[hsl(220,15%,16%)]">
            {["N° abonnement", "Client", "Plan", "Catégorie", "Statut", "Prochain cycle"].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,10%,40%)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="border-b border-[hsl(220,15%,14%)] last:border-0">
              {Array.from({ length: 6 }).map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-3.5 w-20 rounded bg-[hsl(220,15%,14%)]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <p className="text-[11px] text-[hsl(220,10%,30%)] text-center">Les données seront connectées prochainement.</p>
  </div>
);

export default SubscriptionsPage;
