import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserCog, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
  type PermissionSet,
} from "@/hooks/useUserPermissions";

const createEmployeeSchema = z.object({
  // Identity
  full_name: z.string().min(2, "Nom requis (min 2 caractères)"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  // Organization
  badge_number: z.string().optional(),
  job_title: z.string().optional(),
  // Access - employee role
  role: z.literal("employee"),
  is_active: z.boolean(),
  // Onboarding
  send_invitation: z.boolean(),
  internal_note: z.string().optional(),
});

export type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;

interface CreateEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateEmployeeFormData & { permissions: Partial<PermissionSet> }) => void;
  isPending: boolean;
}

export function CreateEmployeeDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: CreateEmployeeDialogProps) {
  const [permissions, setPermissions] = useState<Partial<PermissionSet>>({
    // Default employee permissions
    view_clients: true,
    view_orders: true,
    view_billing: true,
    view_tickets: true,
  });

  const form = useForm<z.infer<typeof createEmployeeSchema>>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      badge_number: "",
      job_title: "",
      role: "employee",
      is_active: true,
      send_invitation: true,
      internal_note: "",
    },
  });

  const togglePermission = (perm: Permission) => {
    setPermissions((prev) => ({
      ...prev,
      [perm]: !prev[perm],
    }));
  };

  const handleSubmit = (data: z.infer<typeof createEmployeeSchema>) => {
    onSubmit({ ...data, permissions });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setPermissions({
        view_clients: true,
        view_orders: true,
        view_billing: true,
        view_tickets: true,
      });
    }
    onOpenChange(newOpen);
  };

  // Filter permissions relevant for employees (exclude manage_staff, etc.)
  const employeePermissions: Permission[] = [
    "view_clients",
    "manage_clients",
    "view_orders",
    "manage_orders",
    "view_billing",
    "manage_billing",
    "view_tickets",
    "manage_tickets",
    "view_appointments",
    "view_logs",
    "view_internal_notes",
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-emerald-500" />
            Créer un employé
          </DialogTitle>
          <DialogDescription>
            Créez un compte employé. L'employé recevra un email pour configurer son mot de passe.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Section: Identité */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline">1</Badge>
                Identité
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom complet *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jean Dupont" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="employe@nivratelecom.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="514-555-1234" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Section: Organisation */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline">2</Badge>
                Organisation
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="badge_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de badge</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="EMP-0001" />
                      </FormControl>
                      <FormDescription>Identifiant optionnel de l'employé</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="job_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre du poste</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Agent de service" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Section: Accès */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline">3</Badge>
                Accès & Permissions
              </h3>
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <UserCog className="h-5 w-5 text-emerald-500" />
                <span className="font-medium">Rôle: Employé</span>
              </div>
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel>Compte actif dès la création</FormLabel>
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Permissions</span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg max-h-40 overflow-y-auto">
                  {employeePermissions.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={permissions[perm] ?? false}
                        onCheckedChange={() => togglePermission(perm)}
                      />
                      {PERMISSION_LABELS[perm]}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Section: Onboarding */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline">4</Badge>
                Onboarding
              </h3>
              <FormField
                control={form.control}
                name="send_invitation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Envoyer invitation par email
                      </FormLabel>
                      <FormDescription>
                        L'employé recevra un email pour configurer son mot de passe
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="internal_note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note interne (admin seulement)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Notes visibles uniquement par les administrateurs..."
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700">
                {isPending ? "Création..." : "Créer l'employé"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
