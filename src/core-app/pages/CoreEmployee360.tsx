/**
 * CoreEmployee360 — Full HR view & edit page for a single employee.
 * Tabs: Personal info, Position & comp, Documents, Time, Commissions, Internal notes.
 */
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, User, Mail, Edit, Save, X, Eye, EyeOff,
  Upload, Download, Trash2, Plus, FileText, Clock, DollarSign, StickyNote, UserX,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

// ─── Constants ──────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  probation: { label: "En probation", variant: "secondary" },
  suspended: { label: "Suspendu", variant: "destructive" },
  inactive: { label: "Inactif", variant: "outline" },
  terminated: { label: "Terminé", variant: "destructive" },
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Temps plein",
  part_time: "Temps partiel",
  contract: "Contractuel",
  field_agent: "Agent terrain",
  technician: "Technicien",
  intern: "Stage",
};

const DEPARTMENTS = ["Ventes", "Support", "Opérations", "Administration", "Terrain", "Technique"];
const LEVELS = ["Représentant", "Agent senior", "Superviseur", "Manager", "Directeur", "Technicien", "Support"];
const DOC_TYPES = [
  { value: "contract", label: "Contrat d'emploi signé" },
  { value: "id", label: "Pièce d'identité" },
  { value: "offer_letter", label: "Lettre d'offre" },
  { value: "performance", label: "Évaluation de performance" },
  { value: "warning", label: "Avertissement disciplinaire" },
  { value: "other", label: "Autre" },
];
const NOTE_CATEGORIES = [
  { value: "performance", label: "Performance" },
  { value: "disciplinary", label: "Disciplinaire" },
  { value: "hr", label: "RH" },
  { value: "general", label: "Général" },
];

const maskSin = (s?: string | null) => {
  if (!s) return "—";
  const digits = s.replace(/\D/g, "");
  return digits.length >= 3 ? `XXX-XX-${digits.slice(-3)}` : "•••";
};

const initials = (first?: string | null, last?: string | null) =>
  `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}` || "?";

// ─── Page ───────────────────────────────────────────────────────────────────
export default function CoreEmployee360() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-360-record", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_records")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const userId = employee?.user_id ?? null;

  const { data: roles } = useQuery({
    queryKey: ["employee-360-roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      return data?.map((r) => r.role) ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/core/staff")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="text-muted-foreground">Employé introuvable.</p>
      </div>
    );
  }

  return <Employee360Inner employee={employee} roles={roles ?? []} qc={qc} navigate={navigate} />;
}

// ─── Inner (with all hooks once employee is loaded) ─────────────────────────
function Employee360Inner({
  employee, roles, qc, navigate,
}: {
  employee: any; roles: string[]; qc: ReturnType<typeof useQueryClient>; navigate: (p: string) => void;
}) {
  const empId = employee.id as string;
  const userId = employee.user_id as string | null;
  const fullName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || "Sans nom";
  const invitationAccepted = !!employee.invitation_accepted_at;

  // ─── Header actions ──────────────────────────────────────────────────────
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [resending, setResending] = useState(false);

  const deactivateMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("employee_records")
        .update({ status: "inactive", termination_date: new Date().toISOString().slice(0, 10) })
        .eq("id", empId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compte désactivé");
      qc.invalidateQueries({ queryKey: ["employee-360-record", empId] });
      setConfirmDeactivate(false);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const handleResendInvite = async () => {
    setResending(true);
    try {
      const { error } = await supabase.functions.invoke("resend-employee-invite", {
        body: { employee_id: empId },
      });
      if (error) throw error;
      toast.success(`Invitation renvoyée à ${employee.work_email ?? "l'employé"}`);
      qc.invalidateQueries({ queryKey: ["employee-360-record", empId] });
    } catch (e: any) {
      toast.error("Erreur lors de l'envoi", { description: e.message });
    } finally {
      setResending(false);
    }
  };

  const status = STATUS_BADGE[employee.status] ?? { label: employee.status, variant: "secondary" as const };

  return (
    <div className="space-y-4">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/core/hr/employees")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials(employee.first_name, employee.last_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">{fullName}</h1>
            {employee.employee_number && (
              <Badge variant="outline" className="text-xs">#{employee.employee_number}</Badge>
            )}
            <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
            {employee.employment_type && (
              <Badge variant="secondary" className="text-xs">
                {EMPLOYMENT_LABELS[employee.employment_type] ?? employee.employment_type}
              </Badge>
            )}
            {roles.map((r) => (
              <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {employee.job_title && <span>{employee.job_title}</span>}
            {employee.department && <><span>•</span><span>{employee.department}</span></>}
            {employee.hire_date && (
              <><span>•</span><span>Embauché le {format(new Date(employee.hire_date), "dd MMM yyyy", { locale: fr })}</span></>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!invitationAccepted && (
            <Button variant="outline" size="sm" onClick={handleResendInvite} disabled={resending}>
              {resending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Mail className="mr-1 h-3 w-3" />}
              Renvoyer invitation
            </Button>
          )}
          {employee.status !== "inactive" && employee.status !== "terminated" && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDeactivate(true)}>
              <UserX className="mr-1 h-3 w-3" /> Désactiver le compte
            </Button>
          )}
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="personal"><User className="mr-1 h-3 w-3" />Informations</TabsTrigger>
          <TabsTrigger value="position"><DollarSign className="mr-1 h-3 w-3" />Poste & rémunération</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="mr-1 h-3 w-3" />Documents</TabsTrigger>
          <TabsTrigger value="time"><Clock className="mr-1 h-3 w-3" />Temps & présence</TabsTrigger>
          <TabsTrigger value="commissions"><DollarSign className="mr-1 h-3 w-3" />Commissions</TabsTrigger>
          <TabsTrigger value="notes"><StickyNote className="mr-1 h-3 w-3" />Notes internes</TabsTrigger>
        </TabsList>

        <TabsContent value="personal"><PersonalInfoTab employee={employee} qc={qc} /></TabsContent>
        <TabsContent value="position"><PositionTab employee={employee} qc={qc} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab empId={empId} /></TabsContent>
        <TabsContent value="time"><TimeTab userId={userId} empId={empId} /></TabsContent>
        <TabsContent value="commissions"><CommissionsTab userId={userId} /></TabsContent>
        <TabsContent value="notes"><NotesTab empId={empId} /></TabsContent>
      </Tabs>

      {/* ─── Deactivate confirmation ─────────────────────────────────────── */}
      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver le compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le statut sera mis à <strong>inactif</strong> et la date de fin sera fixée à aujourd'hui.
              L'employé ne pourra plus se connecter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deactivateMut.mutate()} disabled={deactivateMut.isPending}>
              {deactivateMut.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── TAB 1: Personal info ───────────────────────────────────────────────────
function PersonalInfoTab({ employee, qc }: { employee: any; qc: ReturnType<typeof useQueryClient> }) {
  const [editing, setEditing] = useState(false);
  const [showSin, setShowSin] = useState(false);
  const [form, setForm] = useState({
    first_name: employee.first_name ?? "",
    last_name: employee.last_name ?? "",
    work_email: employee.work_email ?? "",
    personal_email: employee.personal_email ?? "",
    phone: employee.phone ?? "",
    home_address: employee.home_address ?? "",
    date_of_birth: employee.date_of_birth ?? "",
    sin_encrypted: employee.sin_encrypted ?? "",
    hire_date: employee.hire_date ?? "",
    termination_date: employee.termination_date ?? "",
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = { ...form };
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      const { error } = await supabase.from("employee_records").update(payload).eq("id", employee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Informations mises à jour");
      qc.invalidateQueries({ queryKey: ["employee-360-record", employee.id] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const Field = ({ label, k, type = "text" }: { label: string; k: keyof typeof form; type?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {editing ? (
        <Input type={type} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      ) : (
        <p className="text-sm text-foreground">{employee[k] || "—"}</p>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Informations personnelles</CardTitle>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Edit className="mr-1 h-3 w-3" /> Modifier
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="mr-1 h-3 w-3" /> Annuler
            </Button>
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
              Enregistrer
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Field label="Prénom" k="first_name" />
        <Field label="Nom" k="last_name" />
        <Field label="Email professionnel" k="work_email" type="email" />
        <Field label="Email personnel" k="personal_email" type="email" />
        <Field label="Téléphone" k="phone" type="tel" />
        <Field label="Date de naissance" k="date_of_birth" type="date" />
        <div className="md:col-span-2"><Field label="Adresse" k="home_address" /></div>

        <div className="space-y-1">
          <Label className="text-xs">NAS</Label>
          {editing ? (
            <Input value={form.sin_encrypted} onChange={(e) => setForm({ ...form, sin_encrypted: e.target.value })} placeholder="123-45-6789" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-foreground">{showSin ? (employee.sin_encrypted || "—") : maskSin(employee.sin_encrypted)}</p>
              {employee.sin_encrypted && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowSin((s) => !s)}>
                  {showSin ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              )}
            </div>
          )}
        </div>

        <Field label="Date d'embauche" k="hire_date" type="date" />
        <Field label="Date de fin" k="termination_date" type="date" />
      </CardContent>
    </Card>
  );
}

// ─── TAB 2: Position & remuneration ─────────────────────────────────────────
function PositionTab({ employee, qc }: { employee: any; qc: ReturnType<typeof useQueryClient> }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    job_title: employee.job_title ?? "",
    department: employee.department ?? "",
    employment_type: employee.employment_type ?? "full_time",
    status: employee.status ?? "active",
    level: employee.level ?? "",
    base_salary: employee.base_salary?.toString() ?? "",
    hourly_rate: employee.hourly_rate?.toString() ?? "",
    commission_rate: employee.commission_rate?.toString() ?? "",
    last_salary_review_date: employee.last_salary_review_date ?? "",
    compensation_notes: employee.compensation_notes ?? "",
    salary_type: employee.salary_type ?? "fixed",
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("employee_records")
        .update({
          job_title: form.job_title || null,
          department: form.department || null,
          employment_type: form.employment_type,
          status: form.status,
          salary_type: form.salary_type,
          base_salary: form.base_salary ? parseFloat(form.base_salary) : null,
          hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
          commission_rate: form.commission_rate ? parseFloat(form.commission_rate) : null,
          last_salary_review_date: form.last_salary_review_date || null,
          compensation_notes: form.compensation_notes || null,
        })
        .eq("id", employee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Poste & rémunération mis à jour");
      qc.invalidateQueries({ queryKey: ["employee-360-record", employee.id] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const fmt$ = (n: any) => (n != null && n !== "" ? `${parseFloat(n).toFixed(2)} $` : "—");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Poste & rémunération</CardTitle>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Edit className="mr-1 h-3 w-3" /> Modifier
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="mr-1 h-3 w-3" /> Annuler</Button>
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
              Enregistrer
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Poste / Titre</Label>
          {editing
            ? <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
            : <p className="text-sm">{employee.job_title || "—"}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Département</Label>
          {editing ? (
            <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          ) : <p className="text-sm">{employee.department || "—"}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Type d'emploi</Label>
          {editing ? (
            <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <p className="text-sm">{EMPLOYMENT_LABELS[employee.employment_type] || employee.employment_type || "—"}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Statut</Label>
          {editing ? (
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_BADGE).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <p className="text-sm">{STATUS_BADGE[employee.status]?.label || employee.status}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Niveau</Label>
          {editing ? (
            <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          ) : <p className="text-sm">{employee.level || "—"}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Type de rémunération</Label>
          {editing ? (
            <Select value={form.salary_type} onValueChange={(v) => setForm({ ...form, salary_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Horaire</SelectItem>
                <SelectItem value="fixed">Fixe</SelectItem>
                <SelectItem value="commission">Commission uniquement</SelectItem>
              </SelectContent>
            </Select>
          ) : <p className="text-sm">{employee.salary_type || "—"}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Salaire de base ($)</Label>
          {editing
            ? <Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
            : <p className="text-sm">{fmt$(employee.base_salary)}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Taux horaire ($)</Label>
          {editing
            ? <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
            : <p className="text-sm">{fmt$(employee.hourly_rate)}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Taux de commission (%)</Label>
          {editing
            ? <Input type="number" step="0.01" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} />
            : <p className="text-sm">{employee.commission_rate != null ? `${employee.commission_rate}%` : "—"}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Dernière révision salariale</Label>
          {editing
            ? <Input type="date" value={form.last_salary_review_date} onChange={(e) => setForm({ ...form, last_salary_review_date: e.target.value })} />
            : <p className="text-sm">{employee.last_salary_review_date ? format(new Date(employee.last_salary_review_date), "dd MMM yyyy", { locale: fr }) : "—"}</p>}
        </div>

        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">Notes de rémunération</Label>
          {editing
            ? <Textarea rows={3} value={form.compensation_notes} onChange={(e) => setForm({ ...form, compensation_notes: e.target.value })} />
            : <p className="text-sm whitespace-pre-wrap text-muted-foreground">{employee.compensation_notes || "—"}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── TAB 3: Documents (uses hr_documents + hr-documents bucket) ─────────────
function DocumentsTab({ empId }: { empId: string }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("other");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["e360-docs", empId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_documents")
        .select("*")
        .eq("employee_id", empId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleUpload = async () => {
    if (!file) return toast.error("Sélectionnez un fichier");
    if (file.size > 10 * 1024 * 1024) return toast.error("Fichier trop volumineux (max 10MB)");
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${empId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("hr-documents").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("hr_documents").insert({
        employee_id: empId,
        document_type: docType,
        title: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
        notes: notes || null,
        status: "active",
      });
      if (insErr) throw insErr;
      toast.success("Document ajouté");
      setUploadOpen(false); setFile(null); setNotes(""); setDocType("other");
      qc.invalidateQueries({ queryKey: ["e360-docs", empId] });
    } catch (e: any) {
      toast.error("Erreur upload", { description: e.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("hr-documents").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error("Lien introuvable");
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.click();
  };

  const deleteMut = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("hr-documents").remove([doc.file_path]);
      const { error } = await supabase.from("hr_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document supprimé");
      qc.invalidateQueries({ queryKey: ["e360-docs", empId] });
      setConfirmDeleteId(null);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const docToDelete = docs.find((d: any) => d.id === confirmDeleteId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Documents ({docs.length})</CardTitle>
        <Button size="sm" onClick={() => setUploadOpen(true)}><Plus className="mr-1 h-3 w-3" /> Ajouter</Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : docs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucun document.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs">{d.title}</TableCell>
                  <TableCell className="text-xs">{DOC_TYPES.find((t) => t.value === d.document_type)?.label ?? d.document_type}</TableCell>
                  <TableCell className="text-xs">{format(new Date(d.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                  <TableCell><Badge variant={d.status === "active" ? "default" : "outline"} className="text-[10px]">{d.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(d.file_path, d.title)}>
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDeleteId(d.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un document</DialogTitle>
            <DialogDescription>PDF, JPG ou PNG. Maximum 10 MB.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Fichier</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label className="text-xs">Type de document</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes (optionnel)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Annuler</Button>
            <Button onClick={handleUpload} disabled={uploading || !file}>
              {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
              Téléverser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>« {docToDelete?.title} » sera supprimé définitivement.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => docToDelete && deleteMut.mutate(docToDelete)} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── TAB 4: Time entries ────────────────────────────────────────────────────
function TimeTab({ userId, empId }: { userId: string | null; empId: string }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: "", punch_in: "", punch_out: "", notes: "" });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["e360-time", userId, from, to],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId!)
        .gte("punch_in", `${from}T00:00:00`)
        .lte("punch_in", `${to}T23:59:59`)
        .order("punch_in", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalHours = useMemo(() => entries.reduce((s: number, e: any) => s + (e.total_hours ?? 0), 0), [entries]);

  const logAudit = async (action: string, before: any, after: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata as any;
      await supabase.from("hr_audit_log").insert({
        action,
        entity_type: "time_entry",
        entity_id: (after?.id ?? before?.id) ?? "",
        actor_user_id: user?.id,
        actor_name: meta?.full_name ?? meta?.name ?? user?.email ?? null,
        details: { target_user_id: userId, before, after } as any,
      });
    } catch { /* non-fatal */ }
  };

  const upsertMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Cet employé n'a pas de compte utilisateur lié");
      const punchIn = new Date(`${form.date}T${form.punch_in}`).toISOString();
      const punchOut = form.punch_out ? new Date(`${form.date}T${form.punch_out}`).toISOString() : null;
      if (editing) {
        const { data, error } = await supabase.from("time_entries")
          .update({ punch_in: punchIn, punch_out: punchOut, notes: form.notes || null })
          .eq("id", editing.id).select().single();
        if (error) throw error;
        await logAudit("time_entry.update", editing, data);
      } else {
        const { data, error } = await supabase.from("time_entries").insert({
          user_id: userId, punch_in: punchIn, punch_out: punchOut,
          notes: form.notes || null, entry_type: "manual", status: "approved",
        }).select().single();
        if (error) throw error;
        await logAudit("time_entry.create", null, data);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Entrée modifiée" : "Entrée ajoutée");
      qc.invalidateQueries({ queryKey: ["e360-time", userId] });
      setAdding(false); setEditing(null); setForm({ date: "", punch_in: "", punch_out: "", notes: "" });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (entry: any) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", entry.id);
      if (error) throw error;
      await logAudit("time_entry.delete", entry, null);
    },
    onSuccess: () => {
      toast.success("Entrée supprimée");
      qc.invalidateQueries({ queryKey: ["e360-time", userId] });
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const openEdit = (e: any) => {
    const dt = new Date(e.punch_in);
    const dout = e.punch_out ? new Date(e.punch_out) : null;
    setEditing(e);
    setForm({
      date: dt.toISOString().slice(0, 10),
      punch_in: dt.toTimeString().slice(0, 5),
      punch_out: dout ? dout.toTimeString().slice(0, 5) : "",
      notes: e.notes ?? "",
    });
  };

  if (!userId) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Cet employé n'a pas encore de compte utilisateur lié.</CardContent></Card>;
  }

  const entryToDelete = entries.find((e: any) => e.id === confirmDel);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-medium">Temps & présence</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Total période : <strong>{totalHours.toFixed(1)}h</strong></p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-[10px]">Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" /></div>
          <div><Label className="text-[10px]">Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" /></div>
          <Button size="sm" onClick={() => { setAdding(true); setForm({ date: new Date().toISOString().slice(0,10), punch_in: "09:00", punch_out: "17:00", notes: "" }); }}>
            <Plus className="mr-1 h-3 w-3" /> Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : entries.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucune entrée pour cette période.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Entrée</TableHead>
                <TableHead>Sortie</TableHead>
                <TableHead>Heures</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{format(new Date(e.punch_in), "dd MMM", { locale: fr })}</TableCell>
                  <TableCell className="text-xs">{format(new Date(e.punch_in), "HH:mm")}</TableCell>
                  <TableCell className="text-xs">{e.punch_out ? format(new Date(e.punch_out), "HH:mm") : <Badge variant="outline" className="text-[10px]">En cours</Badge>}</TableCell>
                  <TableCell className="text-xs font-medium">{e.total_hours ? `${e.total_hours.toFixed(1)}h` : "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{e.notes || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(e)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDel(e.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add/Edit dialog */}
      <Dialog open={adding || !!editing} onOpenChange={(o) => { if (!o) { setAdding(false); setEditing(null); }}}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier l'entrée" : "Ajouter une entrée"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Punch in</Label><Input type="time" value={form.punch_in} onChange={(e) => setForm({ ...form, punch_in: e.target.value })} /></div>
              <div><Label className="text-xs">Punch out</Label><Input type="time" value={form.punch_out} onChange={(e) => setForm({ ...form, punch_out: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdding(false); setEditing(null); }}>Annuler</Button>
            <Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending || !form.date || !form.punch_in}>
              {upsertMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette entrée ?</AlertDialogTitle>
            <AlertDialogDescription>L'action sera enregistrée dans le journal d'audit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => entryToDelete && deleteMut.mutate(entryToDelete)} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── TAB 5: Commissions ─────────────────────────────────────────────────────
function CommissionsTab({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const { data: comms = [], isLoading } = useQuery({
    queryKey: ["e360-commissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_commissions")
        .select("*")
        .eq("employee_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const validateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unified_commissions")
        .update({ status: "validated", validated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Commission validée"); qc.invalidateQueries({ queryKey: ["e360-commissions", userId] }); },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const payMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unified_commissions")
        .update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Commission marquée comme payée"); qc.invalidateQueries({ queryKey: ["e360-commissions", userId] }); },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  if (!userId) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Cet employé n'a pas encore de compte utilisateur lié.</CardContent></Card>;
  }

  const total = comms.reduce((s: number, c: any) => s + (c.amount ?? 0), 0);
  const pending = comms.filter((c: any) => c.status === "pending").reduce((s: number, c: any) => s + (c.amount ?? 0), 0);
  const paid = comms.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + (c.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-semibold">{total.toFixed(2)} $</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">En attente</p><p className="text-lg font-semibold text-primary">{pending.toFixed(2)} $</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Payé</p><p className="text-lg font-semibold">{paid.toFixed(2)} $</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Historique des commissions ({comms.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : comms.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune commission.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Vente</TableHead>
                  <TableHead>Taux</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comms.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{format(new Date(c.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{c.source}</Badge></TableCell>
                    <TableCell className="text-xs">{c.sale_amount ? `${c.sale_amount.toFixed(2)} $` : "—"}</TableCell>
                    <TableCell className="text-xs">{c.commission_rate ? `${c.commission_rate}%` : "—"}</TableCell>
                    <TableCell className="text-xs font-medium">{(c.amount ?? 0).toFixed(2)} $</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "paid" ? "default" : c.status === "validated" ? "secondary" : "outline"} className="text-[10px]">
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === "pending" && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => validateMut.mutate(c.id)} disabled={validateMut.isPending}>Valider</Button>
                      )}
                      {c.status === "validated" && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => payMut.mutate(c.id)} disabled={payMut.isPending}>Marquer payée</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── TAB 6: Internal notes (immutable) ──────────────────────────────────────
function NotesTab({ empId }: { empId: string }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("general");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["e360-notes", empId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_notes")
        .select("*")
        .eq("employee_id", empId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata as any;
      const authorName = meta?.full_name ?? meta?.name ?? user?.email ?? "Inconnu";
      const { error } = await supabase.from("employee_notes").insert({
        employee_id: empId, note: note.trim(), category,
        created_by: user?.id, created_by_name: authorName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note ajoutée");
      setNote(""); setCategory("general");
      qc.invalidateQueries({ queryKey: ["e360-notes", empId] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const catLabel = (c: string) => NOTE_CATEGORIES.find((n) => n.value === c)?.label ?? c;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Ajouter une note interne</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{NOTE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Note (immuable une fois enregistrée)</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Décrire la situation, l'observation, le suivi…" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => addMut.mutate()} disabled={addMut.isPending || !note.trim()}>
              {addMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Historique ({notes.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune note pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((n: any) => (
                <div key={n.id} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{n.created_by_name ?? "Inconnu"}</strong>
                      {" • "}{format(new Date(n.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{catLabel(n.category)}</Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-foreground">{n.note}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
