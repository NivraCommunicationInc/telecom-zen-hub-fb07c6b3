import { Check, X } from "lucide-react";

const rows = [
  { label: "Sans contrat", nivra: true, others: false, othersText: "Engagement fréquent" },
  { label: "Processus simple", nivra: true, others: false, othersText: "Processus plus complexe" },
  { label: "Support direct", nivra: true, others: false, othersText: "Support centralisé" },
];

const ComparisonTable = () => (
  <section className="py-20 lg:py-28 bg-[#111111]">
    <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
      <h2 className="text-3xl md:text-[2.5rem] font-bold text-white text-center mb-14 tracking-[-0.025em]">
        Une approche plus simple
      </h2>
      <div className="bg-[#1a1a1a] rounded-3xl border border-white/10 overflow-hidden max-w-[800px] mx-auto">
        <div className="grid grid-cols-3 border-b border-white/10">
          <div className="p-4" />
          <div className="p-4 text-center font-bold text-purple-400 text-sm border-l border-white/10 bg-purple-500/5">Nivra</div>
          <div className="p-4 text-center font-bold text-white/50 text-sm border-l border-white/10">Fournisseurs traditionnels</div>
        </div>
        {rows.map((row, i) => (
          <div key={i} className={`grid grid-cols-3 ${i < rows.length - 1 ? "border-b border-white/10" : ""}`}>
            <div className="p-4 text-sm font-medium text-white">{row.label}</div>
            <div className="p-4 flex items-center justify-center border-l border-white/10 bg-purple-500/5">
              <Check className="w-5 h-5 text-purple-400" />
            </div>
            <div className="p-4 flex items-center justify-center gap-2 border-l border-white/10">
              <X className="w-4 h-4 text-white/30" />
              <span className="text-xs text-white/40">{row.othersText}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ComparisonTable;
