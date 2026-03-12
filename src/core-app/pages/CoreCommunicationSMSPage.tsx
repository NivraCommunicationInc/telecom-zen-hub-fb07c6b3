/**
 * CoreCommunicationSMSPage — Transferred from AdminCommunicationSMS.tsx
 * SMS communication management
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Search, Plus, Send, Users } from "lucide-react";

export default function CoreCommunicationSMSPage() {
  const { data: messages = [] } = useQuery({
    queryKey: ["core-sms-messages"],
    queryFn: async () => {
      const { data } = await supabase.from("sms_messages" as any).select("*").order("created_at", { ascending: false }).limit(100);
      return (data as any[]) || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Communication SMS</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Envoi et suivi des SMS</p></div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4" /> Nouvel envoi</Button>
      </div>

      <Tabs defaultValue="sent" className="space-y-4">
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)]">
          <TabsTrigger value="sent" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Envoyés</TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="space-y-2">
          {messages.length === 0 ? <div className="text-center py-12 text-[hsl(var(--core-text-label))]"><MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />Aucun SMS envoyé</div> :
            messages.map((m: any) => (
              <div key={m.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
                <div><p className="text-sm text-[hsl(var(--core-text-primary))]">{m.to_phone || m.recipient}</p>
                  <p className="text-xs text-[hsl(var(--core-text-secondary))] line-clamp-1">{m.message || m.body}</p></div>
                <Badge className={m.status === "sent" ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-amber-500/15 text-amber-400 border-0"}>{m.status}</Badge>
              </div>
            ))}
        </TabsContent>
        <TabsContent value="templates"><div className="text-center py-12 text-[hsl(var(--core-text-label))]">Templates SMS à configurer</div></TabsContent>
      </Tabs>
    </div>
  );
}
