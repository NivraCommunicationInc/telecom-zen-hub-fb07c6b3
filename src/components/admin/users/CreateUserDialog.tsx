import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, UserCog, Wrench, Eye, EyeOff } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  DEFAULT_PERMISSIONS,
  type Permission,
  type PermissionSet,
} from "@/hooks/useUserPermissions";

type StaffRole = "admin" | "employee" | "technician";

const createUserSchema = z.object({
  // Identity
  full_name: z.string().min(2, "Nom requis (min 2 caractères)"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  // Organization
  badge_number: z.string().min(1, "Numéro de badge requis"),
  job_title: z.string().optional(),
  // Access
  role: z.enum(["admin", "employee", "technician"]),
  is_active: z.boolean(),
  // Security
  pin: z.string().regex(/^\d{4}$/, "Le PIN doit être exactement 4 chiffres").optional().or(z.literal("")),
  pin_confirm: z.string().optional().or(z.literal("")),
  require_pin_change: z.boolean(),
  // Onboarding
  send_invitation: z.boolean(),
  internal_note: z.string().optional(),
}).refine((data) => {
  if (data.role !== "admin" && data.pin) {
    return data.pin === data.pin_confirm;
  }
  return true;
}, {
  message: "Les PINs ne correspondent pas",
  path: ["pin_confirm"],
}).refine((data) => {
  if (data.role !== "admin") {
    return data.pin && data.pin.length === 4;
  }
  return true;
}, {
  message: "Le PIN est requis pour les employés et techniciens",
  path: ["pin"],
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;

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
  const [showPin, setShowPin] = useState(false);
  const [permissions, setPermissions] = useState<Partial<PermissionSet>>({});

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      badge_number: "",
      job_title: "",
      role: "employee",
      is_active: true,
      pin: "",
      pin_confirm: "",
      require_pin_change: false,
      send_invitation: true,
      internal_note: "",
    },
  });

  const selectedRole = form.watch("role");

  const applyRolePack = () => {
    const pack = DEFAULT_PERMISSIONS[selectedRole] || {};
    const newPerms: Partial<PermissionSet> = {};
    ALL_PERMISSIONS.forEach((perm) => {
      newPerms[perm] = pack[perm] ?? false;
    });
    setPermissions(newPerms);
  };

  const togglePermission = (perm: Permission) => {
    setPermissions((prev) => ({
      ...prev,
      [perm]: !prev[perm],
    }));
  };

  const handleSubmit = (data: CreateUserFormData) => {
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
          <DialogTitle>Créer un utilisateur</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau membre du personnel avec ses accès et permissions
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
                        <Input {...field} type="email" placeholder="nom@nivratelecom.ca" />
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
                        <Input {...field} placeholder="EMP-0001" />
                      </FormControl>
                      <FormDescription>Identifiant unique de l'employé</FormDescription>
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
                        <Input {...field} placeholder="Agent support" />
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rôle *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un rôle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Administrateur
                            </div>
                          </SelectItem>
                          <SelectItem value="employee">
                            <div className="flex items-center gap-2">
                              <UserCog className="h-4 w-4" />
                              Employé
                            </div>
                          </SelectItem>
                          <SelectItem value="technician">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4" />
                              Technicien
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-8">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Compte actif dès la création</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Permissions</span>
                  <Button type="button" variant="outline" size="sm" onClick={applyRolePack}>
                    <Shield className="h-3 w-3 mr-1" />
                    Appliquer pack du rôle
                  </Button>
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

            {/* Section: Sécurité (PIN) */}
            {selectedRole !== "admin" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Badge variant="outline">4</Badge>
                  Sécurité (PIN)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PIN (4 chiffres) *</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              {...field}
                              type={showPin ? "text" : "password"}
                              maxLength={4}
                              placeholder="****"
                              inputMode="numeric"
                              pattern="\d{4}"
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowPin(!showPin)}
                          >
                            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pin_confirm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmer PIN *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type={showPin ? "text" : "password"}
                            maxLength={4}
                            placeholder="****"
                            inputMode="numeric"
                            pattern="\d{4}"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="require_pin_change"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Exiger changement de PIN au premier login</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Separator />

            {/* Section: Onboarding */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline">{selectedRole !== "admin" ? "5" : "4"}</Badge>
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
                {isPending ? "Création..." : "Créer l'utilisateur"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
