import { Check, X } from "lucide-react";

const rows = [
  { label: "Sans contrat", nivra: true, others: false, othersText: "Engagement fréquent" },
  { label: "Processus simple", nivra: true, others: false, othersText: "Processus plus complexe" },
  { label: "Support direct", nivra: true, others: false, othersText: "Support centralisé" },
];

const ComparisonTable = () => (
  <section className="py-16 lg:py-20 bg-secondary/40">
    <div className="container mx-auto px-4 max-w-[800px]">
      <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-10">
        Une approche plus simple
      </h2>
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-3 border-b border-border">
          <div className="p-4" />
          <div className="p-4 text-center font-bold text-primary text-sm border-l border-border bg-primary/5">Nivra</div>
          <div className="p-4 text-center font-bold text-muted-foreground text-sm border-l border-border">Fournisseurs traditionnels</div>
        </div>
        {/* Rows */}
        {rows.map((row, i) => (
          <div key={i} className={`grid grid-cols-3 ${i < rows.length - 1 ? "border-b border-border" : ""}`}>
            <div className="p-4 text-sm font-medium text-foreground">{row.label}</div>
            <div className="p-4 flex items-center justify-center border-l border-border bg-primary/5">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="p-4 flex items-center justify-center gap-2 border-l border-border">
              <X className="w-4 h-4 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground">{row.othersText}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ComparisonTable;
