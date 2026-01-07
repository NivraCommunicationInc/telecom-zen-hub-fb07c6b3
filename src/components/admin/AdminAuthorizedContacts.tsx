import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Star,
  Shield,
  Bell,
  Clock,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AuthorizedContact {
  id: string;
  client_id: string;
  full_name: string;
  relationship_label: string | null;
  phone: string | null;
  email: string | null;
  permission_level: string;
  is_primary: boolean;
  notification_opt_in: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  created_by_role: string | null;
}

interface Props {
  clientId: string;
  clientName?: string;
  isEmployee?: boolean;
}

const permissionLevels = {
  level_1: {
    label: "Level 1 — Information Only",
    description: "Can receive updates and discuss account status",
    color: "bg-gray-500/20 text-gray-400",
  },
  level_2: {
    label: "Level 2 — Service Requests",
    description: "Can request plan changes, appointments, troubleshooting",
    color: "bg-blue-500/20 text-blue-400",
  },
  level_3: {
    label: "Level 3 — Billing Assistance",
    description: "Can discuss invoices, payments, balances",
    color: "bg-amber-500/20 text-amber-400",
  },
  level_4: {
    label: "Level 4 — Full Representative",
    description: "Full access as authorized representative",
    color: "bg-emerald-500/20 text-emerald-400",
  },
};

const AdminAuthorizedContacts: React.FC<Props> = ({ clientId, clientName, isEmployee = false }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<AuthorizedContact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<AuthorizedContact | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    relationship_label: "",
    phone: "",
    email: "",
    permission_level: "level_1",
    is_primary: false,
    notification_opt_in: false,
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["admin-authorized-contacts", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("authorized_users")
        .select("*")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AuthorizedContact[];
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Check for duplicates
      const existingByPhone = contacts.find(
        (c) => c.phone === data.phone && c.id !== editingContact?.id
      );
      const existingByEmail = contacts.find(
        (c) => c.email && c.email === data.email && c.id !== editingContact?.id
      );

      if (existingByPhone) {
        throw new Error("A contact with this phone number already exists");
      }
      if (existingByEmail) {
        throw new Error("A contact with this email already exists");
      }

      if (editingContact) {
        const { error } = await supabase
          .from("authorized_users")
          .update({
            full_name: data.full_name,
            relationship_label: data.relationship_label || null,
            phone: data.phone || null,
            email: data.email || null,
            permission_level: data.permission_level,
            is_primary: data.is_primary,
            notification_opt_in: data.notification_opt_in,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingContact.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("authorized_users").insert({
          client_id: clientId,
          full_name: data.full_name,
          relationship_label: data.relationship_label || null,
          phone: data.phone || null,
          email: data.email || null,
          permission_level: data.permission_level,
          is_primary: data.is_primary,
          notification_opt_in: data.notification_opt_in,
          created_by: user?.id,
          created_by_role: isEmployee ? "employee" : "admin",
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editingContact ? "Contact updated" : "Contact added",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-authorized-contacts", clientId] });
      closeDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from("authorized_users")
        .delete()
        .eq("id", contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Contact removed" });
      queryClient.invalidateQueries({ queryKey: ["admin-authorized-contacts", clientId] });
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openAddDialog = () => {
    setEditingContact(null);
    setFormData({
      full_name: "",
      relationship_label: "",
      phone: "",
      email: "",
      permission_level: "level_1",
      is_primary: false,
      notification_opt_in: false,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (contact: AuthorizedContact) => {
    setEditingContact(contact);
    setFormData({
      full_name: contact.full_name,
      relationship_label: contact.relationship_label || "",
      phone: contact.phone || "",
      email: contact.email || "",
      permission_level: contact.permission_level || "level_1",
      is_primary: contact.is_primary || false,
      notification_opt_in: contact.notification_opt_in || false,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingContact(null);
    setFormData({
      full_name: "",
      relationship_label: "",
      phone: "",
      email: "",
      permission_level: "level_1",
      is_primary: false,
      notification_opt_in: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ title: "Phone required", variant: "destructive" });
      return;
    }
    addContactMutation.mutate(formData);
  };

  const getPermissionBadge = (level: string) => {
    const config = permissionLevels[level as keyof typeof permissionLevels] || permissionLevels.level_1;
    return <Badge className={config.color}>{config.label.split(" — ")[1]}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4 text-cyan-500" />
              Authorized Contacts
            </CardTitle>
            {clientName && (
              <CardDescription className="text-xs mt-1">
                for {clientName}
              </CardDescription>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No authorized contacts</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.full_name}</span>
                      {contact.is_primary && (
                        <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
                          <Star className="w-3 h-3 mr-1" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    {contact.relationship_label && (
                      <p className="text-xs text-muted-foreground">{contact.relationship_label}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {getPermissionBadge(contact.permission_level)}
                      {contact.notification_opt_in && (
                        <Badge variant="outline" className="text-xs">
                          <Bell className="w-3 h-3 mr-1" />
                          Notify
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Added {format(new Date(contact.created_at), "d MMM yyyy", { locale: fr })}
                      {contact.created_by_role && ` by ${contact.created_by_role}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(contact)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setContactToDelete(contact);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-500" />
              {editingContact ? "Edit Authorized Contact" : "Add Authorized Contact"}
            </DialogTitle>
            <DialogDescription>
              This person will be able to manage the account based on permission level
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label>Relationship</Label>
              <Input
                value={formData.relationship_label}
                onChange={(e) => setFormData({ ...formData, relationship_label: e.target.value })}
                placeholder="e.g., Spouse, Parent, Guardian"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="514-555-1234"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Permission Level</Label>
              <Select
                value={formData.permission_level}
                onValueChange={(value) => setFormData({ ...formData, permission_level: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(permissionLevels).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="space-y-0.5">
                        <p className="font-medium">{config.label}</p>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Primary Contact</Label>
                  <p className="text-xs text-muted-foreground">First point of contact</p>
                </div>
                <Switch
                  checked={formData.is_primary}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Receive Notifications</Label>
                  <p className="text-xs text-muted-foreground">SMS/email updates</p>
                </div>
                <Switch
                  checked={formData.notification_opt_in}
                  onCheckedChange={(checked) => setFormData({ ...formData, notification_opt_in: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={addContactMutation.isPending}>
                {addContactMutation.isPending ? "Saving..." : editingContact ? "Update" : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Authorized Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              "{contactToDelete?.full_name}" will no longer be able to access this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => contactToDelete && deleteContactMutation.mutate(contactToDelete.id)}
              disabled={deleteContactMutation.isPending}
            >
              {deleteContactMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default AdminAuthorizedContacts;