/**
 * DashboardPage — Nivra Core operations overview.
 */
const DashboardPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-[13px] text-[hsl(220,10%,50%)] mt-0.5">Vue générale des opérations Nivra</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Commandes aujourd'hui", placeholder: "—" },
          { label: "Paiements en attente", placeholder: "—" },
          { label: "Activations à traiter", placeholder: "—" },
          { label: "Tickets ouverts", placeholder: "—" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-[hsl(220,10%,45%)]">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{kpi.placeholder}</p>
          </div>
        ))}
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-5 min-h-[240px]">
          <h2 className="text-sm font-semibold text-white mb-1">Commandes récentes</h2>
          <p className="text-[12px] text-[hsl(220,10%,45%)]">Les dernières commandes seront affichées ici.</p>
        </div>
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-5 min-h-[240px]">
          <h2 className="text-sm font-semibold text-white mb-1">Factures impayées</h2>
          <p className="text-[12px] text-[hsl(220,10%,45%)]">Les factures en attente de paiement apparaîtront ici.</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
