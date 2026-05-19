/** CoreNotificationsPage — Transferred from AdminNotificationsSettings.tsx */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

export default function CoreNotificationsPage() {
  const queryClient = useQueryClient();
  const { data: settings = [] } = useQuery({ queryKey: ["core-notification-settings"], queryFn: async () => { const { data } = await supabase.from("admin_notification_settings").select("*").order("category"); return data || []; } });
  const toggleSetting = useMutation({ mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => { await supabase.from("admin_notification_settings").update({ is_enabled: enabled }).eq("id", id); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-notification-settings"] }); toast.success("Paramètre mis à jour"); } });
  const grouped = settings.reduce((acc: Record<string, any[]>, s: any) => { (acc[s.category] = acc[s.category] || []).push(s); return acc; }, {});
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Notifications</h1><p className="text-sm text-[hsl(var(--core-text-secondary))]">Paramètres de notifications système</p></div>

      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))] flex items-center gap-2"><Bell className="w-4 h-4 text-emerald-400" />Notifications push (cet appareil)</h2>
        <p className="text-xs text-[hsl(var(--core-text-label))]">Recevez les alertes admin urgentes (incidents, escalades) sur ce navigateur, même quand l'onglet est fermé.</p>
        <PushNotificationToggle />
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))] mb-3 flex items-center gap-2"><Bell className="w-4 h-4 text-emerald-400" />{cat}</h2>
          <div className="space-y-3">{(items as any[]).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between"><div><p className="text-sm text-[hsl(var(--core-text-primary))]">{s.setting_label}</p><p className="text-xs text-[hsl(var(--core-text-label))]">{s.setting_key}</p></div><Switch checked={s.is_enabled} onCheckedChange={(v) => toggleSetting.mutate({ id: s.id, enabled: v })} /></div>
          ))}</div>
        </div>
      ))}
      {settings.length === 0 && <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucun paramètre de notification</div>}
    </div>
  );
}
