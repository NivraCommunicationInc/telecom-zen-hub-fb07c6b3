/**
 * HrCreateEmployeePage — Full employee creation form.
 * Creates employee_records + auth user + profile + user_roles via edge function.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  UserPlus, ArrowLeft, Building, DollarSign, Shield, Phone, Save, Loader2,
} from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";
import { toast } from "sonner";

const DEPARTMENTS = [
  "Ventes", "Support", "Technique", "Administration", "Finance",
  "Marketing", "Opérations", "RH", "Logistique",
];

interface FormData {
  first_name: string;
  last_name: string;
  work_email: string;
  phone: string;
  department: string;
  job_title: string;
  employment_type: string;
  hire_date: string;
  salary_type: string;
  hourly_rate: string;
  base_salary: string;
  commission_enabled: boolean;
  payment_method: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  roles: string[];
  notes: string;
}

const initialForm: FormData = {
  first_name: "",
  last_name: "",
  work_email: "",
  phone: "",
  department: "",
  job_title: "",
  employment_type: "full_time",
  hire_date: new Date().toISOString().split("T")[0],
  salary_type: "hourly",
  hourly_rate: "",
  base_salary: "",
  commission_enabled: false,
  payment_method: "direct_deposit",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relation: "",
  roles: ["employee"],
  notes: "",
};

export default function HrCreateEmployeePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(initialForm);

  const set = (field: keyof FormData, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleRole = (role: string) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        work_email: form.work_email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        department: form.department || undefined,
        job_title: form.job_title.trim() || undefined,
        employment_type: form.employment_type,
        hire_date: form.hire_date || undefined,
        salary_type: form.salary_type,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : undefined,
        base_salary: form.base_salary ? parseFloat(form.base_salary) : undefined,
        commission_enabled: form.commission_enabled,
        payment_method: form.payment_method,
        emergency_contact_name: form.emergency_contact_name.trim() || undefined,
        emergency_contact_phone: form.emergency_contact_phone.trim() || undefined,
        emergency_contact_relation: form.emergency_contact_relation.trim() || undefined,
        roles: form.roles,
        notes: form.notes.trim() || undefined,
      };

      const { data, error } = await supabase.functions.invoke("hr-create-employee", {
        body: payload,
      });

      // supabase.functions.invoke returns error for non-2xx, but we now always return 200
      if (error) {
        // Try to parse the error body for our custom message
        const msg = typeof error === "object" && "message" in error ? error.message : String(error);
        throw new Error(msg || "Erreur de création");
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error("Réponse inattendue du serveur");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Employé ${data.employee.employee_number} créé avec succès`, {
        description: `Invitation envoyée à ${form.work_email}`,
      });
      navigate(corePath("/hr/employees"));
    },
    onError: (err: Error) => {
      toast.error("Erreur de création", { description: err.message });
    },
  });

  const canSubmit =
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.work_email.trim() &&
    form.roles.length > 0;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(corePath("/hr/employees"))}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Nouvel employé
          </h1>
          <p className="text-xs text-muted-foreground">
            Créer un dossier employé complet et envoyer l'invitation
          </p>
        </div>
      </div>

      {/* ── Identity ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            Identité & Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Prénom *</Label>
              <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)}
                placeholder="Jean" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)}
                placeholder="Tremblay" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email professionnel *</Label>
              <Input type="email" value={form.work_email}
                onChange={(e) => set("work_email", e.target.value)}
                placeholder="jean.tremblay@nivra.ca" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Téléphone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)}
                placeholder="514-555-0123" className="h-8 text-xs" />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Département</Label>
              <Select value={form.department} onValueChange={(v) => set("department", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Poste / Titre</Label>
              <Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)}
                placeholder="Agent de ventes" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type d'emploi</Label>
              <Select value={form.employment_type} onValueChange={(v) => set("employment_type", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Temps plein</SelectItem>
                  <SelectItem value="part_time">Temps partiel</SelectItem>
                  <SelectItem value="contract">Contractuel</SelectItem>
                  <SelectItem value="seasonal">Saisonnier</SelectItem>
                  <SelectItem value="intern">Stagiaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5 max-w-[200px]">
            <Label className="text-xs">Date d'embauche</Label>
            <Input type="date" value={form.hire_date}
              onChange={(e) => set("hire_date", e.target.value)}
              className="h-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* ── Remuneration ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Rémunération
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Type de salaire</Label>
              <Select value={form.salary_type} onValueChange={(v) => set("salary_type", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Horaire</SelectItem>
                  <SelectItem value="fixed">Fixe</SelectItem>
                  <SelectItem value="commission_only">Commission seulement</SelectItem>
                  <SelectItem value="hybrid">Hybride (fixe + commission)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.salary_type === "hourly" || form.salary_type === "hybrid") && (
              <div className="space-y-1.5">
                <Label className="text-xs">Taux horaire ($)</Label>
                <Input type="number" step="0.01" value={form.hourly_rate}
                  onChange={(e) => set("hourly_rate", e.target.value)}
                  placeholder="18.50" className="h-8 text-xs" />
              </div>
            )}
            {(form.salary_type === "fixed" || form.salary_type === "hybrid") && (
              <div className="space-y-1.5">
                <Label className="text-xs">Salaire de base ($)</Label>
                <Input type="number" step="0.01" value={form.base_salary}
                  onChange={(e) => set("base_salary", e.target.value)}
                  placeholder="45000" className="h-8 text-xs" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Méthode de paiement</Label>
              <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct_deposit">Dépôt direct</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="etransfer">Virement Interac</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="commission_enabled"
              checked={form.commission_enabled}
              onCheckedChange={(v) => set("commission_enabled", !!v)}
            />
            <Label htmlFor="commission_enabled" className="text-xs cursor-pointer">
              Commissions activées
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* ── Emergency Contact ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Contact d'urgence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom</Label>
              <Input value={form.emergency_contact_name}
                onChange={(e) => set("emergency_contact_name", e.target.value)}
                placeholder="Marie Tremblay" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Téléphone</Label>
              <Input value={form.emergency_contact_phone}
                onChange={(e) => set("emergency_contact_phone", e.target.value)}
                placeholder="514-555-0199" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Relation</Label>
              <Input value={form.emergency_contact_relation}
                onChange={(e) => set("emergency_contact_relation", e.target.value)}
                placeholder="Conjointe" className="h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Roles & Access ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Rôles & Accès portails
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Sélectionnez les rôles et portails auxquels l'employé aura accès.
          </p>
          <div className="flex flex-wrap gap-4">
            {[
              { value: "employee", label: "Employé (Portail RH)", desc: "Accès au portail employé" },
              { value: "field_sales", label: "Ventes terrain", desc: "Accès au portail terrain" },
              { value: "admin", label: "Administrateur", desc: "Accès complet à Core" },
            ].map((role) => (
              <div key={role.value} className="flex items-start space-x-2 p-3 border rounded-md min-w-[200px]">
                <Checkbox
                  id={`role-${role.value}`}
                  checked={form.roles.includes(role.value)}
                  onCheckedChange={() => toggleRole(role.value)}
                />
                <div>
                  <Label htmlFor={`role-${role.value}`} className="text-xs font-medium cursor-pointer">
                    {role.label}
                  </Label>
                  <p className="text-[10px] text-muted-foreground">{role.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {form.roles.length === 0 && (
            <p className="text-xs text-destructive">Au moins un rôle est requis</p>
          )}
        </CardContent>
      </Card>

      {/* ── Notes ── */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Notes internes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Notes optionnelles…" className="text-xs min-h-[60px]" />
          </div>
        </CardContent>
      </Card>

      {/* ── Submit ── */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" size="sm" onClick={() => navigate(corePath("/hr/employees"))}>
          Annuler
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={!canSubmit || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Créer l'employé et envoyer l'invitation
        </Button>
      </div>
    </div>
  );
}
