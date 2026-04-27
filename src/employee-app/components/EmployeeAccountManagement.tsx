import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { toast } from "sonner";

const NOTE_CATEGORIES = ["General", "Facturation", "Technique", "Plainte", "Suivi", "Important"];

export function EmployeeAccountManagement({ account, profile, subscriptions, equipment }: { account: any; profile: any; subscriptions: any[]; equipment: any[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteCategory, setNoteCategory] = useState("General");
  const [noteText, setNoteText] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [changeSubscriptionId, setChangeSubscriptionId] = useState(subscriptions[0]?.id ?? "");
  const [requestedPlanId, setRequestedPlanId] = useState("");
  const [serialEdits, setSerialEdits] = useState<Record<string, { serial_number?: string; mac_address?: string }>>({});

  const { data: notes = [] } = useQuery({
    queryKey: ["employee-account-notes", account.id],
    queryFn: async () => {
      const { data } = await supabase.from("client_internal_notes").select("id, note_type, body, created_by_name, created_at").eq("client_id", account.client_id).order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["employee-account-inventory"],
    queryFn: async () => {
      const { data } = await supabase.from("equipment_inventory").select("id, catalog_name, serial_number, mac_address, status").in("status", ["available", "in_stock", "stock"]).limit(100);
      return data ?? [];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["employee-account-services-catalog"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, name, price, category, plan_code").eq("is_active", true).order("category").order("name");
      return data ?? [];
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const actorId = sessionData.session?.user.id;
      if (!actorId) throw new Error("Non authentifié");
      const { data: actor } = await supabase.from("profiles").select("full_name").eq("user_id", actorId).maybeSingle();
      const { error } = await supabase.from("client_internal_notes").insert({
        client_id: account.client_id,
        note_type: noteCategory,
        body: noteText,
        created_by_user_id: actorId,
        created_by_role: "employee",
        created_by_name: actor?.full_name ?? sessionData.session?.user.email ?? "Employé",
      });
      if (error) throw error;
    },
    onSuccess: () => { setNoteText(""); queryClient.invalidateQueries({ queryKey: ["employee-account-notes", account.id] }); toast.success("Note interne ajoutée"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addEquipment = useMutation({
    mutationFn: async () => {
      if (!inventoryItemId) throw new Error("Équipement requis");
      const { error } = await supabase.from("equipment_inventory").update({ account_id: account.id, assigned_at: new Date().toISOString(), status: "assigned" }).eq("id", inventoryItemId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Équipement ajouté"); queryClient.invalidateQueries({ queryKey: ["employee-account-detail", account.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateEquipment = useMutation({
    mutationFn: async (eqId: string) => {
      const patch = serialEdits[eqId] ?? {};
      const { error } = await supabase.from("equipment_inventory").update({ serial_number: patch.serial_number ?? null, mac_address: patch.mac_address ?? null }).eq("id", eqId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Équipement mis à jour"); queryClient.invalidateQueries({ queryKey: ["employee-account-detail", account.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const scheduleReturn = useMutation({
    mutationFn: async (eq: any) => {
      const { error } = await supabase.from("equipment_return_requests").insert({ account_id: account.id, equipment_inventory_id: eq.id, client_user_id: account.client_id, reason: "Retour équipement", status: "requested", agent_notes: "RMA planifié depuis portail employé" } as any);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Retour RMA planifié"),
    onError: (e: any) => toast.error(e.message),
  });

  const createServiceChange = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const actorId = sessionData.session?.user.id;
      if (!actorId) throw new Error("Non authentifié");
      const sub = subscriptions.find((s) => s.id === changeSubscriptionId);
      const plan = (services as any[]).find((s) => s.id === requestedPlanId);
      if (!sub || !plan) throw new Error("Forfait requis");
      const { error } = await supabase.from("service_change_requests" as any).insert({ account_id: account.id, client_id: account.client_id, subscription_id: sub.id, current_plan_name: sub.plan_name, requested_plan_id: plan.id, requested_plan_name: plan.name, change_type: "change_plan", status: "pending_core", notes: "Changer plan demandé par employé", requested_by: actorId });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Changement de forfait créé — En attente Core"),
    onError: (e: any) => toast.error(e.message),
  });

  const suspendService = useMutation({
    mutationFn: async (sub: any) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const actorId = sessionData.session?.user.id;
      if (!actorId) throw new Error("Non authentifié");
      const { error } = await supabase.from("suspension_requests" as any).insert({ account_id: account.id, client_id: account.client_id, subscription_id: sub.id, reason: "Suspension demandée depuis portail employé", status: "pending_core", requested_by: actorId });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Suspension demandée — En attente Core"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel title="Gérer l'équipement">
        <div className="flex gap-2"><select value={inventoryItemId} onChange={(e) => setInventoryItemId(e.target.value)} className="min-h-[44px] flex-1 rounded-lg border border-border bg-background px-3 text-xs"><option value="">Ajouter équipement (inventaire)</option>{(inventory as any[]).map((i) => <option key={i.id} value={i.id}>{i.catalog_name} {i.serial_number ? `— ${i.serial_number}` : ""}</option>)}</select><button onClick={() => addEquipment.mutate()} className="min-h-[44px] rounded-lg bg-primary px-3 text-xs text-primary-foreground">Ajouter</button></div>
        {equipment.map((eq) => <div key={eq.id} className="rounded-lg border border-border p-2 text-xs space-y-2"><p className="font-medium text-foreground">{eq.catalog_name ?? eq.category}</p><input placeholder="Numéro de série" defaultValue={eq.serial_number ?? ""} onChange={(e) => setSerialEdits((m) => ({ ...m, [eq.id]: { ...m[eq.id], serial_number: e.target.value } }))} className="w-full rounded border border-border bg-background px-2 py-1" /><input placeholder="Adresse MAC" defaultValue={eq.mac_address ?? ""} onChange={(e) => setSerialEdits((m) => ({ ...m, [eq.id]: { ...m[eq.id], mac_address: e.target.value } }))} className="w-full rounded border border-border bg-background px-2 py-1" /><div className="flex gap-2"><button onClick={() => updateEquipment.mutate(eq.id)} className="text-primary">Mettre à jour</button><button onClick={() => scheduleReturn.mutate(eq)} className="text-amber-400">Schedule return / RMA</button></div></div>)}
      </Panel>
      <Panel title="Gérer les forfaits">
        {subscriptions.map((s) => <div key={s.id} className="rounded-lg border border-border p-2 text-xs"><div className="flex justify-between"><span className="text-foreground font-medium">{s.plan_name}</span><span>{s.status}</span></div><button onClick={() => suspendService.mutate(s)} className="mt-2 text-amber-400">Suspendre service</button></div>)}
        <select value={changeSubscriptionId} onChange={(e) => setChangeSubscriptionId(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-xs"><option value="">Abonnement</option>{subscriptions.map((s) => <option key={s.id} value={s.id}>{s.plan_name}</option>)}</select>
        <select value={requestedPlanId} onChange={(e) => setRequestedPlanId(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-xs"><option value="">Changer plan vers…</option>{(services as any[]).map((s) => <option key={s.id} value={s.id}>{s.name} — {Number(s.price ?? 0).toFixed(2)} $</option>)}</select>
        <button onClick={() => createServiceChange.mutate()} className="min-h-[44px] w-full rounded-lg bg-primary px-3 text-xs text-primary-foreground">Créer service_change_request</button>
        <button onClick={() => navigate(employeePath(`/orders/new?clientId=${account.client_id}`))} className="min-h-[44px] w-full rounded-lg border border-border px-3 text-xs text-foreground">Ajouter service</button>
      </Panel>
      <Panel title="Notes internes">
        <select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-xs">{NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Nouvelle note interne…" className="min-h-[90px] w-full rounded-lg border border-border bg-background p-3 text-xs" />
        <button onClick={() => addNote.mutate()} disabled={!noteText.trim() || addNote.isPending} className="min-h-[44px] w-full rounded-lg bg-primary px-3 text-xs text-primary-foreground disabled:opacity-40">{addNote.isPending && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}Ajouter une note</button>
        <div className="max-h-64 overflow-y-auto space-y-2">{(notes as any[]).map((n) => <div key={n.id} className="rounded-lg bg-secondary/30 p-2 text-xs"><div className="flex justify-between"><span className="text-primary">{n.note_type}</span><span className="text-muted-foreground">{new Date(n.created_at).toLocaleDateString("fr-CA")}</span></div><p className="text-foreground">{n.body}</p><p className="text-[10px] text-muted-foreground">{n.created_by_name ?? "Employé"}</p></div>)}</div>
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-4 space-y-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>{children}</div>;
}
