/**
 * WorkQueuePage — Operational actions requiring attention.
 */
const WorkQueuePage = () => {
  const sections = [
    { title: "Paiements à confirmer", description: "Preuves de paiement en attente de validation." },
    { title: "Commandes à préparer", description: "Commandes validées prêtes pour préparation." },
    { title: "Activations en attente", description: "Services en attente d'activation réseau." },
    { title: "Rendez-vous à planifier", description: "Installations nécessitant une planification." },
    { title: "Tickets de support", description: "Demandes clients en cours de traitement." },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">File de travail</h1>
        <p className="text-[13px] text-[hsl(220,10%,50%)] mt-0.5">Actions opérationnelles à traiter</p>
      </div>

      <div className="space-y-3">
        {sections.map((s) => (
          <div
            key={s.title}
            className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4 flex items-center justify-between"
          >
            <div>
              <h3 className="text-sm font-medium text-white">{s.title}</h3>
              <p className="text-[12px] text-[hsl(220,10%,45%)] mt-0.5">{s.description}</p>
            </div>
            <span className="text-lg font-semibold text-[hsl(220,10%,35%)]">—</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkQueuePage;
