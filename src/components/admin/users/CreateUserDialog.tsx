import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Eye, EyeOff } from "lucide-react";
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

// Only admin role is supported now
type StaffRole = "admin";

const createUserSchema = z.object({
  // Identity
  full_name: z.string().min(2, "Nom requis (min 2 caractères)"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  // Organization
  badge_number: z.string().min(1, "Numéro de badge requis"),
  job_title: z.string().optional(),
  // Access - admin only
  role: z.literal("admin"),
  is_active: z.boolean(),
  // Onboarding
  send_invitation: z.boolean(),
  internal_note: z.string().optional(),
});

export type CreateUserFormData = z.infer<typeof createUserSchema> & {
  pin?: string;
  pin_confirm?: string;
  require_pin_change?: boolean;
};

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateUserFormData & { permissions: Partial<PermissionSet> }) => void;
  isPending: boolean;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: CreateUserDialogProps) {
  const [permissions, setPermissions] = useState<Partial<PermissionSet>>({});

  const form = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      badge_number: "",
      job_title: "",
      role: "admin",
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

  const handleSubmit = (data: z.infer<typeof createUserSchema>) => {
    onSubmit({ ...data, permissions });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setPermissions({});
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un administrateur</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau compte administrateur avec ses permissions
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
                        <Input {...field} type="email" placeholder="nom@nivratelecom.com" />
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
                      <FormLabel>Numéro de badge *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ADM-0001" />
                      </FormControl>
                      <FormDescription>Identifiant unique de l'administrateur</FormDescription>
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
                        <Input {...field} placeholder="Administrateur système" />
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
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-medium">Rôle: Administrateur</span>
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
                  {ALL_PERMISSIONS.map((perm) => (
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
                      <FormLabel>Envoyer invitation / lien de réinitialisation</FormLabel>
                      <FormDescription>
                        Un email sera envoyé pour configurer le mot de passe
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
              <Button type="submit" disabled={isPending}>
                {isPending ? "Création..." : "Créer l'administrateur"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}