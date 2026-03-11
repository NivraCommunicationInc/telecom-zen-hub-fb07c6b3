/**
 * Account-level quick actions: Send email, create ticket, schedule visit.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Mail, MessageSquare, Calendar, Wrench } from "lucide-react";

const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const textareaCls = `${inputCls} resize-none`;
const btnPrimary = "rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors";
const btnSecondary = "rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors";

interface Props {
  clientId: string | undefined;
  clientEmail: string | undefined;
  clientName: string;
  accountId: string | undefined;
  onRefresh: () => void;
}

type ModalType = null | "sendEmail" | "createTicket" | "scheduleVisit";

export function AccountActionMenu({ clientId, clientEmail, clientName, accountId, onRefresh }: Props) {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2 py-1 text-[10px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            Actions <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white">
          <DropdownMenuLabel className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider">Communication</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setModal("sendEmail")} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <Mail className="h-3.5 w-3.5" /> Envoyer un courriel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModal("createTicket")} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <MessageSquare className="h-3.5 w-3.5" /> Créer un ticket
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModal("scheduleVisit")} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <Calendar className="h-3.5 w-3.5" /> Planifier une visite
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {modal === "sendEmail" && <SendEmailModal clientEmail={clientEmail} clientName={clientName} onClose={() => setModal(null)} />}
      {modal === "createTicket" && <CreateTicketModal clientId={clientId} clientEmail={clientEmail} clientName={clientName} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "scheduleVisit" && <ScheduleVisitModal clientId={clientId} clientEmail={clientEmail} accountId={accountId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
    </>
  );
}

/* ── Send Email ── */
function SendEmailModal({ clientEmail, clientName, onClose }: { clientEmail?: string; clientName: string; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || !clientEmail) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("email_queue").insert({
        template_key: "admin_manual_email",
        to_email: clientEmail,
        subject: subject.trim(),
        template_vars: {
          client_name: clientName,
          subject: subject.trim(),
          body: body.trim(),
          manual_send: true,
        },
        status: "pending",
      });
      if (error) throw error;
      toast.success("Courriel ajouté à la file d'envoi");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-400" /> Envoyer un courriel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Destinataire</label>
            <input value={clientEmail || "—"} disabled className={`${inputCls} opacity-60`} />
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Objet</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet du message" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Contenu du courriel…" className={textareaCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleSend} disabled={loading || !clientEmail} className={btnPrimary}>{loading ? "…" : "Envoyer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Create Ticket ── */
function CreateTicketModal({ clientId, clientEmail, clientName, onClose, onRefresh }: { clientId?: string; clientEmail?: string; clientName: string; onClose: () => void; onRefresh: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!subject.trim() || !clientId) {
      toast.error("Veuillez remplir le sujet");
      return;
    }
    setLoading(true);
    try {
      const ticketNumber = `NVR-${String(Date.now()).slice(-6)}`;
      const { error } = await supabase.from("support_tickets").insert({
        client_id: clientId,
        subject: subject.trim(),
        description: description.trim() || null,
        category,
        priority,
        status: "open",
        ticket_number: ticketNumber,
        created_by: "admin",
      });
      if (error) throw error;
      toast.success(`Ticket ${ticketNumber} créé`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-emerald-400" /> Créer un ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Sujet</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Sujet du ticket" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Catégorie</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                <option value="general">Général</option>
                <option value="billing">Facturation</option>
                <option value="technical">Technique</option>
                <option value="service">Service</option>
                <option value="equipment">Équipement</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Priorité</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Détails…" className={textareaCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleCreate} disabled={loading} className={btnPrimary}>{loading ? "…" : "Créer le ticket"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Schedule Visit ── */
function ScheduleVisitModal({ clientId, clientEmail, accountId, onClose, onRefresh }: { clientId?: string; clientEmail?: string; accountId?: string; onClose: () => void; onRefresh: () => void }) {
  const [title, setTitle] = useState("");
  const [serviceType, setServiceType] = useState("installation");
  const [scheduledAt, setScheduledAt] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSchedule = async () => {
    if (!title.trim() || !scheduledAt || !clientId) {
      toast.error("Veuillez remplir le titre et la date");
      return;
    }
    setLoading(true);
    try {
      const apptNumber = `RDV-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("appointments").insert({
        client_id: clientId,
        client_email: clientEmail || null,
        title: title.trim(),
        service_type: serviceType,
        scheduled_at: new Date(scheduledAt).toISOString(),
        service_address: address || null,
        internal_notes: notes || null,
        appointment_number: apptNumber,
        status: "scheduled",
      });
      if (error) throw error;
      toast.success(`Rendez-vous ${apptNumber} planifié`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Calendar className="h-4 w-4 text-emerald-400" /> Planifier une visite</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Titre</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Installation Internet" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Type de service</label>
              <select value={serviceType} onChange={e => setServiceType(e.target.value)} className={inputCls}>
                <option value="installation">Installation</option>
                <option value="maintenance">Maintenance</option>
                <option value="replacement">Remplacement</option>
                <option value="diagnostic">Diagnostic</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Date et heure</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Adresse</label>
            <AddressAutocomplete
              value={address}
              onValueChange={(v) => setAddress(v)}
              onSelect={(addr: AddressValue) => {
                setAddress(addr.formatted || addr.line1);
              }}
              placeholder="Adresse de service"
              restrictToQuebec={true}
              className="bg-[hsl(220,20%,9%)] border-[hsl(220,15%,16%)] text-white text-[11px]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Notes internes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes…" className={textareaCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleSchedule} disabled={loading} className={btnPrimary}>{loading ? "…" : "Planifier"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
