import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export default function HubStore() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [size, setSize] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["hub-store-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hub_store_items").select("*").eq("is_available", true).order("category");
      if (error) throw error;
      return data || [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selected) throw new Error("Non connecté");
      const { error } = await supabase.from("hub_store_orders").insert({
        user_id: user.id,
        item_id: selected.id,
        quantity: qty,
        size: size || null,
        notes: notes || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande envoyée — en attente d'approbation");
      setSelected(null); setSize(""); setQty(1); setNotes("");
      qc.invalidateQueries({ queryKey: ["hub-store-orders"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {(items || []).map((it: any) => (
          <button
            key={it.id}
            onClick={() => { setSelected(it); setSize(it.sizes?.[0] || ""); }}
            className="text-left rounded-xl border border-border bg-card hover:border-violet-400 transition-colors p-3 min-h-[44px]"
          >
            <div className="aspect-square rounded-lg bg-violet-50 flex items-center justify-center mb-2">
              <ShoppingBag className="h-8 w-8 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-foreground truncate">{it.name}</h3>
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{it.description}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-card rounded-2xl w-full max-w-md p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold mb-3">{selected.name}</h2>
            {selected.sizes && selected.sizes.length > 0 && (
              <div className="mb-3">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Taille</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selected.sizes.map((s: string) => (
                    <button key={s} onClick={() => setSize(s)} className={`min-w-[44px] min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-semibold border ${size === s ? "bg-violet-600 text-white border-violet-600" : "bg-background border-border"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-3">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quantité</label>
              <input type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Notes (optionnel)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} className="flex-1 min-h-[44px] rounded-lg border border-border text-sm font-semibold">Annuler</button>
              <button onClick={() => submit.mutate()} disabled={submit.isPending} className="flex-1 min-h-[44px] rounded-lg bg-violet-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Demander
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
