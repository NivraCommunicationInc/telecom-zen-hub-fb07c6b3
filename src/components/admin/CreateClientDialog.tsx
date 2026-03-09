import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  User, Phone, Mail, MapPin, Calendar, Shield, Building2, 
  KeyRound, Eye, EyeOff, Loader2
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { hashPin } from "@/lib/pinUtils";
import { generateAccountNumber } from "@/lib/secureIdGenerator";

const createClientSchema = z.object({
  // Identity
  first_name: z.string().min(2, "Prénom requis (min 2 caractères)"),
  last_name: z.string().min(2, "Nom requis (min 2 caractères)"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Téléphone requis").optional().or(z.literal("")),
  date_of_birth: z.string().optional(),
  // Address
  service_address: z.string().min(3, "Adresse de service requise"),
  service_apartment: z.string().optional(),
  service_city: z.string().min(2, "Ville requise"),
  service_province: z.string().default("QC"),
  service_postal_code: z.string().regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, "Code postal invalide"),
  // Security PIN (4 digits)
  client_pin: z.string().length(4, "NIP doit contenir 4 chiffres").regex(/^\d{4}$/, "NIP doit contenir 4 chiffres"),
  // Internal notes
  internal_notes: z.string().optional(),
});

type CreateClientFormData = z.infer<typeof createClientSchema>;

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (clientData: { user_id: string; email: string; full_name: string }) => void;
}

export function CreateClientDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateClientDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [showPin, setShowPin] = useState(false);

  const form = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      service_address: "",
      service_apartment: "",
      service_city: "",
      service_province: "QC",
      service_postal_code: "",
      client_pin: "",
      internal_notes: "",
    },
  });

  // Generate a random 16-character password
  const generateSecurePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const createClientMutation = useMutation({
    mutationFn: async (data: CreateClientFormData) => {
      const fullName = `${data.first_name} ${data.last_name}`.trim();
      const password = generateSecurePassword();
      
      // Build full address with apartment if present
      const fullAddress = data.service_apartment 
        ? `${data.service_address}, app. ${data.service_apartment}`
        : data.service_address;

      // Use server-side edge function for secure user creation
      const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          password: password,
          full_name: fullName,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || null,
          date_of_birth: data.date_of_birth || null,
          service_address: fullAddress,
          service_city: data.service_city,
          service_postal_code: data.service_postal_code.toUpperCase(),
          service_province: data.service_province,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const userId = result.user.id;

      // Update profile with PIN hash (hashPin is async)
      const pinHash = await hashPin(data.client_pin);
      const { error: pinError } = await supabase
        .from("profiles")
        .update({
          client_pin_hash: pinHash,
          pin_is_default: false,
          internal_notes: data.internal_notes || null,
        })
        .eq("user_id", userId);

      if (pinError) {
        console.error("Failed to set client PIN:", pinError);
      }

      // Create account with bill_cycle_day (store actual day 1-31, clamping happens at billing time)
      const today = new Date();
      const billCycleDay = today.getDate(); // Store the real day-of-month (1-31)
      
      // Calculate next_invoice_date using billingCycleUtils logic
      // For new accounts, the first invoice is due on the billing cycle day
      const { error: accountError } = await supabase
        .from("accounts")
        .insert({
          client_id: userId,
          account_number: generateAccountNumber(),
          billing_cycle_day: billCycleDay, // Store actual day (1-31), clamping applied at invoice generation
          billing_anchor_date: today.toISOString().split('T')[0],
          next_invoice_date: today.toISOString().split('T')[0],
          billing_address: fullAddress,
          billing_city: data.service_city,
          billing_postal_code: data.service_postal_code.toUpperCase(),
          billing_province: data.service_province,
          primary_service_address: fullAddress,
          primary_service_city: data.service_city,
          primary_service_postal_code: data.service_postal_code.toUpperCase(),
          primary_service_province: data.service_province,
          status: "active",
        });

      if (accountError) {
        console.error("Failed to create account:", accountError);
      }

      return {
        user_id: userId,
        email: data.email,
        full_name: fullName,
      };
    },
    onSuccess: (clientData) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      logActivity("create", "client", clientData.user_id, { 
        email: clientData.email, 
        full_name: clientData.full_name 
      }, {
        changedField: "profile",
        reason: "Nouveau client créé par admin avec NIP et compte"
      });
      toast({ 
        title: "Client créé avec succès", 
        description: `${clientData.full_name} a été ajouté au système avec un compte actif.` 
      });
      handleOpenChange(false);
      onSuccess?.(clientData);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur lors de la création", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (data: CreateClientFormData) => {
    createClientMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Créer un nouveau client
          </DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau client avec toutes ses informations de contact et de facturation
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Section 1: Identité */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline">1</Badge>
                Identité
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jean" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Tremblay" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email *
                      </FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="jean.tremblay@email.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Téléphone
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="514-555-1234" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem className="w-1/2">
                    <FormLabel className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Date de naissance
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="date" max={new Date().toISOString().split('T')[0]} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Section 2: Adresse de service */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline">2</Badge>
                <MapPin className="w-4 h-4" />
                Adresse de service
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="service_address"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Adresse *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="123 rue Principale" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="service_apartment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>App./Suite</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="101" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="service_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Montréal" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="service_province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province</FormLabel>
                      <FormControl>
                        <Input {...field} disabled value="QC" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="service_postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code postal *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="H2X 1Y4" 
                          className="uppercase"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Section 3: NIP de sécurité */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline">3</Badge>
                <Shield className="w-4 h-4" />
                NIP de sécurité
              </h3>
              <FormField
                control={form.control}
                name="client_pin"
                render={({ field }) => (
                  <FormItem className="w-1/2">
                    <FormLabel>NIP 4 chiffres *</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input 
                          {...field} 
                          type={showPin ? "text" : "password"}
                          placeholder="• • • •"
                          maxLength={4}
                          className="pr-10 tracking-widest text-center font-mono"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPin(!showPin)}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <FormDescription>
                      Ce NIP sera utilisé pour valider l'identité du client lors des appels
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Section 4: Notes internes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline">4</Badge>
                Notes internes
              </h3>
              <FormField
                control={form.control}
                name="internal_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (admin seulement)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Notes visibles uniquement par les administrateurs..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Info box */}
            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground space-y-1">
              <p className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <strong>Compte automatique:</strong> Un compte sera créé avec le Bill Cycle Day d'aujourd'hui.
              </p>
              <p className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                <strong>Mot de passe:</strong> Généré automatiquement. Le client pourra le réinitialiser par email.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createClientMutation.isPending}>
                {createClientMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Création...
                  </>
                ) : (
                  "Créer le client"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
