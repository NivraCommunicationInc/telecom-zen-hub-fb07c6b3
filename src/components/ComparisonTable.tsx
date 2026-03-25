import { Check, X } from "lucide-react";

const rows = [
  { label: "Sans contrat", nivra: true, others: false, othersText: "Engagement fréquent" },
  { label: "Processus simple", nivra: true, others: false, othersText: "Processus plus complexe" },
  { label: "Support direct", nivra: true, others: false, othersText: "Support centralisé" },
];

const ComparisonTable = () => (
  <section className="py-24 lg:py-36 bg-secondary/20">
    <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
      <h2 className="text-3xl md:text-[2.75rem] font-bold text-foreground text-center mb-6 tracking-[-0.03em]">
        Une approche plus simple
      </h2>
      <p className="text-muted-foreground text-lg text-center mb-16 lg:mb-20 max-w-lg mx-auto">
        Comparez par vous-même
      </p>
      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-lg max-w-[840px] mx-auto">
        <div className="grid grid-cols-3 border-b border-border">
          <div className="p-6" />
          <div className="p-6 text-center font-bold text-primary text-sm border-l border-border bg-primary/5">Nivra</div>
          <div className="p-6 text-center font-bold text-muted-foreground text-sm border-l border-border">Fournisseurs traditionnels</div>
        </div>
        {rows.map((row, i) => (
          <div key={i} className={`grid grid-cols-3 ${i < rows.length - 1 ? "border-b border-border" : ""}`}>
            <div className="p-6 text-sm font-semibold text-foreground">{row.label}</div>
            <div className="p-6 flex items-center justify-center border-l border-border bg-primary/5">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="p-6 flex items-center justify-center gap-3 border-l border-border">
              <X className="w-4 h-4 text-muted-foreground/40" />
              <span className="text-sm text-muted-foreground">{row.othersText}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ComparisonTable;
