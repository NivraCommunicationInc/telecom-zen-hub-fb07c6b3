import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Search, 
  Plus, 
  RefreshCw, 
  UserCog, 
  Key, 
  ToggleLeft, 
  ToggleRight,
  Pencil,
  Copy,
  Check
} from "lucide-react";
import { format } from "date-fns";

interface Employee {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  permissions_json: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

const defaultPermissions = {
  can_view_orders: true,
  can_edit_orders_status: false,
  can_view_appointments: true,
  can_manage_appointments: false,
  can_view_tickets: true,
  can_manage_tickets: true,
  can_view_clients: true,
  can_edit_clients: false,
  can_generate_invoices: false,
  can_edit_invoices: false,
  can_confirm_payments: false,
  can_ship_orders: false,
};

const permissionLabels: Record<string, string> = {
  can_view_orders: "Voir les commandes",
  can_edit_orders_status: "Modifier statut commandes",
  can_view_appointments: "Voir les rendez-vous",
  can_manage_appointments: "Gérer les rendez-vous",
  can_view_tickets: "Voir les tickets",
  can_manage_tickets: "Gérer les tickets",
  can_view_clients: "Voir les clients",
  can_edit_clients: "Modifier les clients",
  can_generate_invoices: "Générer les factures",
  can_edit_invoices: "Modifier les factures",
  can_confirm_payments: "Confirmer les paiements",
  can_ship_orders: "Expédier les commandes",
};

const AdminEmployees = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [tempPin, setTempPin] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    pin: "",
    permissions: { ...defaultPermissions },
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Cast permissions_json properly
      const typedData = (data || []).map(emp => ({
        ...emp,
        permissions_json: emp.permissions_json as Record<string, boolean> | null,
      }));
      setEmployees(typedData);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Erreur lors du chargement des employés");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const generatePin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + "nivra_employee_salt_2025");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleCreate = async () => {
    if (!formData.full_name || !formData.email) {
      toast.error("Nom et email requis");
      return;
    }

    const pin = formData.pin || generatePin();
    const pinHash = await hashPin(pin);
    const normalizedEmail = formData.email.trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from("employees")
        .insert({
          full_name: formData.full_name.trim(),
          email: normalizedEmail,
          phone: formData.phone.trim() || null,
          pin_hash: pinHash,
          permissions_json: formData.permissions,
          created_by_admin_id: user?.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Un employé avec cet email existe déjà");
        } else {
          throw error;
        }
        return;
      }

      // Log the action
      await supabase.from("employee_audit_logs").insert({
        actor_role: "admin",
        actor_id: user?.id,
        actor_email: user?.email,
        action: "CREATE_EMPLOYEE",
        target_employee_id: data.id,
        target_employee_email: normalizedEmail,
        details_json: { full_name: formData.full_name },
      });

      setTempPin(pin);
      setShowCreateDialog(false);
      setShowPinDialog(true);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        pin: "",
        permissions: { ...defaultPermissions },
      });
      fetchEmployees();
      toast.success("Employé créé avec succès");
    } catch (error) {
      console.error("Error creating employee:", error);
      toast.error("Erreur lors de la création de l'employé");
    }
  };

  const handleUpdate = async () => {
    if (!selectedEmployee) return;

    try {
      const { error } = await supabase
        .from("employees")
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          permissions_json: formData.permissions,
        })
        .eq("id", selectedEmployee.id);

      if (error) throw error;

      await supabase.from("employee_audit_logs").insert({
        actor_role: "admin",
        actor_id: user?.id,
        actor_email: user?.email,
        action: "UPDATE_EMPLOYEE",
        target_employee_id: selectedEmployee.id,
        target_employee_email: selectedEmployee.email,
        details_json: { updated_fields: ["full_name", "phone", "permissions"] },
      });

      setShowEditDialog(false);
      setSelectedEmployee(null);
      fetchEmployees();
      toast.success("Employé mis à jour");
    } catch (error) {
      console.error("Error updating employee:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleResetPin = async (employee: Employee) => {
    const newPin = generatePin();
    const pinHash = await hashPin(newPin);

    try {
      const { error } = await supabase
        .from("employees")
        .update({ 
          pin_hash: pinHash,
          failed_login_attempts: 0,
          lockout_until: null,
        })
        .eq("id", employee.id);

      if (error) throw error;

      await supabase.from("employee_audit_logs").insert({
        actor_role: "admin",
        actor_id: user?.id,
        actor_email: user?.email,
        action: "RESET_PIN",
        target_employee_id: employee.id,
        target_employee_email: employee.email,
      });

      setSelectedEmployee(employee);
      setTempPin(newPin);
      setShowPinDialog(true);
      toast.success("PIN réinitialisé");
    } catch (error) {
      console.error("Error resetting PIN:", error);
      toast.error("Erreur lors de la réinitialisation du PIN");
    }
  };

  const handleToggleActive = async (employee: Employee) => {
    const newStatus = !employee.is_active;

    try {
      const { error } = await supabase
        .from("employees")
        .update({ is_active: newStatus })
        .eq("id", employee.id);

      if (error) throw error;

      await supabase.from("employee_audit_logs").insert({
        actor_role: "admin",
        actor_id: user?.id,
        actor_email: user?.email,
        action: newStatus ? "ENABLE_EMPLOYEE" : "DISABLE_EMPLOYEE",
        target_employee_id: employee.id,
        target_employee_email: employee.email,
      });

      fetchEmployees();
      toast.success(newStatus ? "Employé activé" : "Employé désactivé");
    } catch (error) {
      console.error("Error toggling employee status:", error);
      toast.error("Erreur lors du changement de statut");
    }
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    const perms = (employee.permissions_json || {}) as Record<string, boolean>;
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || "",
      pin: "",
      permissions: { ...defaultPermissions, ...perms },
    });
    setShowEditDialog(true);
  };

  const copyPin = () => {
    if (tempPin) {
      navigator.clipboard.writeText(tempPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestion des Employés</h1>
            <p className="text-muted-foreground">Créer et gérer les comptes employés</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchEmployees} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel Employé
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="secondary">{filteredEmployees.length} employé(s)</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière mise à jour</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun employé trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.full_name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>
                        <Badge variant={employee.is_active ? "default" : "secondary"}>
                          {employee.is_active ? "Actif" : "Désactivé"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(employee.updated_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(employee)}
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResetPin(employee)}
                            title="Réinitialiser PIN"
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(employee)}
                            title={employee.is_active ? "Désactiver" : "Activer"}
                          >
                            {employee.is_active ? (
                              <ToggleRight className="w-4 h-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create Employee Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Créer un Employé
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="jean@nivra.ca"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="514-555-0123"
                />
              </div>
              <div className="space-y-2">
                <Label>PIN (4 chiffres, optionnel)</Label>
                <Input
                  type="text"
                  maxLength={4}
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "") })}
                  placeholder="Auto-généré si vide"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30">
                {Object.entries(permissionLabels).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={formData.permissions[key] || false}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, [key]: !!checked },
                        })
                      }
                    />
                    <Label htmlFor={key} className="text-sm font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate}>Créer l'employé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Modifier l'Employé
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={formData.email} disabled className="bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30">
                {Object.entries(permissionLabels).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`edit-${key}`}
                      checked={formData.permissions[key] || false}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, [key]: !!checked },
                        })
                      }
                    />
                    <Label htmlFor={`edit-${key}`} className="text-sm font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Display Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              PIN Temporaire
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 mb-2">
                ⚠️ Ce PIN ne sera affiché qu'une seule fois. Notez-le maintenant.
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 p-6 bg-muted rounded-lg">
              <span className="text-4xl font-mono font-bold tracking-widest">{tempPin}</span>
              <Button variant="outline" size="icon" onClick={copyPin}>
                {copiedPin ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>URL de connexion:</strong> /employee/login</p>
              {selectedEmployee && <p><strong>Email:</strong> {selectedEmployee.email}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowPinDialog(false); setTempPin(null); }}>
              J'ai noté le PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminEmployees;
