/**
 * CreateRepresentativeDialog - Professional dialog for creating field sales representatives
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  Mail,
  User,
  Phone,
  MapPin,
  Loader2,
  BadgePercent,
  Building,
  FileText,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface CreateRepresentativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TERRITORIES = [
  "Montréal - Centre",
  "Montréal - Est",
  "Montréal - Ouest",
  "Laval",
  "Longueuil",
  "Rive-Nord",
  "Rive-Sud",
  "Laurentides",
  "Lanaudière",
  "Autre",
];

export function CreateRepresentativeDialog({
  open,
  onOpenChange,
}: CreateRepresentativeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    phone: "",
    territory: "",
    address: "",
    emergencyContact: "",
    notes: "",
    commissionRate: "10",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email invalide";
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Le nom complet est requis";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Le téléphone est requis";
    }

    if (!formData.territory) {
      newErrors.territory = "Le territoire est requis";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await adminSupabase.functions.invoke(
        "admin-manage-staff",
        {
          body: {
            action: "create_field_sales",
            email: formData.email.trim().toLowerCase(),
            full_name: formData.fullName.trim(),
            phone: formData.phone.trim(),
            territory: formData.territory,
            address: formData.address.trim() || null,
            emergency_contact: formData.emergencyContact.trim() || null,
            notes: formData.notes.trim() || null,
            commission_rate: parseFloat(formData.commissionRate) / 100,
          },
        }
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de la création");
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Représentant créé",
        description:
          "Un email d'invitation a été envoyé pour compléter la configuration du compte.",
      });
      onOpenChange(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-reps"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le représentant",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      email: "",
      fullName: "",
      phone: "",
      territory: "",
      address: "",
      emergencyContact: "",
      notes: "",
      commissionRate: "10",
    });
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      createMutation.mutate();
    }
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
    return value;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            Nouveau représentant terrain
          </DialogTitle>
          <DialogDescription>
            Créer un compte vendeur porte-à-porte. Un email d'invitation sera envoyé
            automatiquement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <User className="h-4 w-4 text-orange-400" />
              Informations personnelles
            </h3>
            <Separator className="bg-slate-700" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300">
                  Nom complet *
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="Jean Dupont"
                    className="pl-10 bg-slate-800/50 border-slate-700"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-xs text-red-400">{errors.fullName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Email *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="vendeur@nivratelecom.com"
                    className="pl-10 bg-slate-800/50 border-slate-700"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">
                  Téléphone *
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone: formatPhone(e.target.value),
                      })
                    }
                    placeholder="(514) 555-1234"
                    className="pl-10 bg-slate-800/50 border-slate-700"
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-red-400">{errors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyContact" className="text-slate-300">
                  Contact d'urgence
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: formatPhone(e.target.value),
                      })
                    }
                    placeholder="(514) 555-0000"
                    className="pl-10 bg-slate-800/50 border-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Territory and Commission */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-teal-400" />
              Affectation et commission
            </h3>
            <Separator className="bg-slate-700" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="territory" className="text-slate-300">
                  Territoire assigné *
                </Label>
                <Select
                  value={formData.territory}
                  onValueChange={(value) =>
                    setFormData({ ...formData, territory: value })
                  }
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="Sélectionner un territoire" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {TERRITORIES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.territory && (
                  <p className="text-xs text-red-400">{errors.territory}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="commissionRate" className="text-slate-300">
                  Taux de commission
                </Label>
                <div className="relative">
                  <BadgePercent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Select
                    value={formData.commissionRate}
                    onValueChange={(value) =>
                      setFormData({ ...formData, commissionRate: value })
                    }
                  >
                    <SelectTrigger className="pl-10 bg-slate-800/50 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="7.5">7.5%</SelectItem>
                      <SelectItem value="10">10% (par défaut)</SelectItem>
                      <SelectItem value="12.5">12.5%</SelectItem>
                      <SelectItem value="15">15%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address" className="text-slate-300">
                  Adresse personnelle
                </Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="123 Rue Exemple, Montréal, QC H1H 1H1"
                    className="pl-10 bg-slate-800/50 border-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-400" />
              Notes internes
            </h3>
            <Separator className="bg-slate-700" />

            <div className="space-y-2">
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Informations additionnelles sur le représentant..."
                className="bg-slate-800/50 border-slate-700 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              className="border-slate-700"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-gradient-to-r from-orange-500 to-amber-400 text-white"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Créer le représentant
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
