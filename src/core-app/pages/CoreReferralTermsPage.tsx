/**
 * CoreReferralTermsPage — Transferred from AdminPartnerTerms.tsx
 * Partner terms and conditions management
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, Eye } from "lucide-react";
import { toast } from "sonner";

export default function CoreReferralTermsPage() {
  const [content, setContent] = useState("");
  const { data: terms } = useQuery({
    queryKey: ["core-partner-terms"],
    queryFn: async () => {
      const { data } = await supabase.from("partner_terms" as any).select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) setContent((data as any).content || "");
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Conditions partenaires</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Termes et conditions du programme de parrainage</p></div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => toast.info("Sauvegarde…")}><Save className="w-4 h-4" /> Sauvegarder</Button>
      </div>
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <Label className="text-[hsl(var(--core-text-secondary))]">Contenu des conditions</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={20}
          className="mt-2 bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))] font-mono text-sm" />
      </div>
    </div>
  );
}
