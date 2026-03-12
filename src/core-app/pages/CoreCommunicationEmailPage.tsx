/**
 * CoreCommunicationEmailPage — Transferred from AdminCommunicationEmail.tsx
 * Email communication templates and sending
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Search, Plus, Mail, FileText, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreCommunicationEmailPage() {
  const [search, setSearch] = useState("");
  const { data: templates = [] } = useQuery({
    queryKey: ["core-email-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("email_templates" as any).select("*").order("name");
      return (data as any[]) || [];
    },
  });

  const { data: queue = [] } = useQuery({
    queryKey: ["core-email-queue-recent"],
    queryFn: async () => {
      const { data } = await supabase.from("email_queue" as any).select("*").order("created_at", { ascending: false }).limit(50);
      return (data as any[]) || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Communication Email</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Templates et envois email</p></div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4" /> Nouvel envoi</Button>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)]">
          <TabsTrigger value="templates" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Templates</TabsTrigger>
          <TabsTrigger value="queue" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">File d'envoi</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-2">
          {templates.length === 0 ? <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucun template</div> :
            templates.map((t: any) => (
              <div key={t.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
                <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-sky-400" /><span className="text-sm text-[hsl(var(--core-text-primary))]">{t.name}</span></div>
                <Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0 text-[10px]">{t.type || "standard"}</Badge>
              </div>
            ))}
        </TabsContent>

        <TabsContent value="queue" className="space-y-2">
          {queue.length === 0 ? <div className="text-center py-12 text-[hsl(var(--core-text-label))]">File d'envoi vide</div> :
            queue.map((e: any) => (
              <div key={e.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
                <div><p className="text-sm text-[hsl(var(--core-text-primary))]">{e.to_email}</p>
                  <p className="text-xs text-[hsl(var(--core-text-label))]">{e.template_key} · {e.created_at && format(new Date(e.created_at), "d MMM HH:mm", { locale: fr })}</p></div>
                <Badge className={e.status === "sent" ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-amber-500/15 text-amber-400 border-0"}>{e.status}</Badge>
              </div>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
