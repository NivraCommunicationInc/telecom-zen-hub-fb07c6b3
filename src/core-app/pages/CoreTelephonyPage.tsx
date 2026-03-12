/** CoreTelephonyPage — Transferred from AdminTelephony.tsx */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Search } from "lucide-react";

export default function CoreTelephonyPage() {
  const { data: calls = [] } = useQuery({
    queryKey: ["core-telephony"],
    queryFn: async () => { const { data } = await supabase.from("call_logs" as any).select("*").order("created_at", { ascending: false }).limit(100); return (data as any[]) || []; },
  });
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Téléphonie</h1><p className="text-sm text-[hsl(var(--core-text-secondary))]">Journaux d'appels et gestion téléphonique</p></div>
      <Tabs defaultValue="calls" className="space-y-4">
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)]"><TabsTrigger value="calls" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Appels</TabsTrigger><TabsTrigger value="config" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Configuration</TabsTrigger></TabsList>
        <TabsContent value="calls" className="space-y-2">{calls.length === 0 ? <div className="text-center py-12 text-[hsl(var(--core-text-label))]"><Phone className="w-8 h-8 mx-auto mb-3 opacity-30" />Aucun journal d'appels</div> : calls.map((c: any) => (
          <div key={c.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between"><div><p className="text-sm text-[hsl(var(--core-text-primary))]">{c.phone_number || c.caller}</p><p className="text-xs text-[hsl(var(--core-text-secondary))]">{c.direction} · {c.duration}s</p></div><Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0">{c.status}</Badge></div>
        ))}</TabsContent>
        <TabsContent value="config"><div className="text-center py-12 text-[hsl(var(--core-text-label))]">Configuration téléphonie</div></TabsContent>
      </Tabs>
    </div>
  );
}
