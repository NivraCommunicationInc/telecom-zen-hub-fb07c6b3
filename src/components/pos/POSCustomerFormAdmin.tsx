/**
 * POSCustomerFormAdmin - Enhanced customer form for Admin POS
 * Features: Client search, full profile creation with PIN, marketing consent
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { 
  User, 
  Search, 
  UserPlus, 
  Mail, 
  Phone, 
  Hash, 
  Check, 
  Loader2, 
  MapPin, 
  Calendar, 
  Lock, 
  Megaphone,
  AlertCircle,
  Building
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminClient as supabase } from "@/integrations/backend/adminClient";

// Extended customer data with PIN and marketing
export interface AdminCustomerData {
  // Existing or new client
  client_id?: string;
  is_new_client: boolean;
  
  // Identity
  full_name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  
  // Address
  service_address: string;
  service_city: string;
  service_postal_code: string;
  service_province?: string;
  
  // ID verification
  id_type?: string;
  id_number?: string;
  
  // Security (for new clients)
  pin?: string;
  
  // Marketing consent
  accept_marketing: boolean;
  accept_sms_notifications: boolean;
}

interface ClientSearchResult {
  user_id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  client_number: string | null;
  service_address: string | null;
  service_city: string | null;
  service_postal_code: string | null;
  date_of_birth: string | null;
}

interface POSCustomerFormAdminProps {
  onSubmit: (data: AdminCustomerData) => void;
  initialData?: Partial<AdminCustomerData>;
  isSubmitting?: boolean;
}

export function POSCustomerFormAdmin({ onSubmit, initialData, isSubmitting }: POSCustomerFormAdminProps) {
  const [mode, setMode] = useState<"search" | "new">(initialData?.is_new_client === false ? "search" : "new");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  
  // Form state
  const [form, setForm] = useState<AdminCustomerData>({
    is_new_client: true,
    full_name: initialData?.full_name || "",
    first_name: initialData?.first_name || "",
    last_name: initialData?.last_name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    date_of_birth: initialData?.date_of_birth || "",
    service_address: initialData?.service_address || "",
    service_city: initialData?.service_city || "",
    service_postal_code: initialData?.service_postal_code || "",
    service_province: initialData?.service_province || "QC",
    id_type: initialData?.id_type || "",
    id_number: initialData?.id_number || "",
    pin: "",
    accept_marketing: initialData?.accept_marketing ?? true,
    accept_sms_notifications: initialData?.accept_sms_notifications ?? true,
  });

  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");

  // Fetch clients for search
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["admin-pos-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, first_name, last_name, phone, client_number, service_address, service_city, service_postal_code, date_of_birth")
        .order("full_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as ClientSearchResult[];
    },
    staleTime: 60000,
  });

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients.slice(0, 50);
    const query = search.toLowerCase().trim();
    return clients.filter((c) => 
      c.full_name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.phone?.toLowerCase().includes(query) ||
      c.client_number?.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [clients, search]);

  // Handle client selection
  const handleSelectClient = (client: ClientSearchResult) => {
    setSelectedClient(client);
    setForm({
      ...form,
      is_new_client: false,
      client_id: client.user_id,
      full_name: client.full_name || "",
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      email: client.email || "",
      phone: client.phone || "",
      service_address: client.service_address || "",
      service_city: client.service_city || "",
      service_postal_code: client.service_postal_code || "",
      date_of_birth: client.date_of_birth || "",
    });
    setSearch("");
  };

  const [formError, setFormError] = useState("");

  // Validate and submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    
    // Validate required fields
    if (!form.full_name || !form.email || !form.phone) {
      setFormError("Nom, courriel et téléphone sont requis");
      return;
    }
    
    // Date of birth is MANDATORY for orders
    if (!form.date_of_birth) {
      setFormError("La date de naissance est obligatoire pour créer une commande");
      return;
    }
    
    // Validate PIN for new clients
    if (mode === "new" && form.pin) {
      if (form.pin.length !== 4) {
        setPinError("Le NIP doit contenir 4 chiffres");
        return;
      }
      if (form.pin !== pinConfirm) {
        setPinError("Les NIP ne correspondent pas");
        return;
      }
    }
    
    setPinError("");
    onSubmit({
      ...form,
      is_new_client: mode === "new",
    });
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <User className="h-5 w-5" />
          Informations client
        </CardTitle>
        <CardDescription className="text-slate-400">
          Recherchez un client existant ou créez un nouveau profil complet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "search" | "new")}>
          <TabsList className="w-full mb-6 bg-slate-700/50">
            <TabsTrigger value="search" className="flex-1 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
              <Search className="h-4 w-4 mr-2" />
              Client existant
            </TabsTrigger>
            <TabsTrigger value="new" className="flex-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <UserPlus className="h-4 w-4 mr-2" />
              Nouveau client
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            {/* Client Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Rechercher par nom, email, téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-700/50 border-slate-600"
              />
            </div>

            {/* Selected Client Display */}
            {selectedClient && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">{selectedClient.full_name || "Sans nom"}</span>
                  {selectedClient.client_number && (
                    <Badge variant="outline" className="ml-auto font-mono text-xs border-emerald-500/50 text-emerald-400">
                      {selectedClient.client_number}
                    </Badge>
                  )}
                </div>
                <div className="grid gap-1 text-sm text-slate-300">
                  {selectedClient.email && (
                    <span className="flex items-center gap-2"><Mail className="w-3 h-3" />{selectedClient.email}</span>
                  )}
                  {selectedClient.phone && (
                    <span className="flex items-center gap-2"><Phone className="w-3 h-3" />{selectedClient.phone}</span>
                  )}
                  {selectedClient.service_address && (
                    <span className="flex items-center gap-2"><MapPin className="w-3 h-3" />{selectedClient.service_address}, {selectedClient.service_city}</span>
                  )}
                </div>
                
                {/* If DOB is missing for existing client, show a field to add it */}
                {!form.date_of_birth && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center gap-2 text-amber-400 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Date de naissance manquante</span>
                    </div>
                    <div>
                      <Label className="text-slate-300 text-xs">Date de naissance *</Label>
                      <Input
                        type="date"
                        value={form.date_of_birth || ""}
                        onChange={(e) => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                        className="bg-slate-700/50 border-slate-600 mt-1"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search Results */}
            {search && !selectedClient && (
              <ScrollArea className="h-64 rounded-lg border border-slate-700/50 bg-slate-900/50">
                {clientsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    Aucun client trouvé
                    <Button
                      variant="link"
                      className="block mx-auto mt-2 text-orange-400"
                      onClick={() => setMode("new")}
                    >
                      Créer un nouveau client
                    </Button>
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredClients.map((client) => (
                      <button
                        key={client.user_id}
                        type="button"
                        className="w-full px-4 py-3 text-left rounded-lg hover:bg-slate-700/50 transition-colors"
                        onClick={() => handleSelectClient(client)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-white">{client.full_name || "Sans nom"}</div>
                            <div className="text-xs text-slate-400 flex gap-3">
                              {client.email && <span>{client.email}</span>}
                              {client.phone && <span>{client.phone}</span>}
                            </div>
                          </div>
                          {client.client_number && (
                            <Badge variant="outline" className="font-mono text-xs border-slate-600">
                              {client.client_number}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}

            {/* Form Error */}
            {formError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{formError}</span>
              </div>
            )}

            {selectedClient && (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !form.date_of_birth}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-white disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continuer avec ce client
              </Button>
            )}
          </TabsContent>

          <TabsContent value="new">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Identity Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Identité
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-slate-300">Prénom *</Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(f => ({ 
                          ...f, 
                          first_name: val,
                          full_name: `${val} ${f.last_name || ""}`.trim()
                        }));
                      }}
                      className="bg-slate-700/50 border-slate-600"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Nom de famille *</Label>
                    <Input
                      value={form.last_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(f => ({ 
                          ...f, 
                          last_name: val,
                          full_name: `${f.first_name || ""} ${val}`.trim()
                        }));
                      }}
                      className="bg-slate-700/50 border-slate-600"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Courriel *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                      className="bg-slate-700/50 border-slate-600"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Téléphone *</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                      placeholder="(514) 555-1234"
                      className="bg-slate-700/50 border-slate-600"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Date de naissance *</Label>
                    <Input
                      type="date"
                      value={form.date_of_birth || ""}
                      onChange={(e) => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                      className="bg-slate-700/50 border-slate-600"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Adresse de service
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label className="text-slate-300">Adresse *</Label>
                    <Input
                      value={form.service_address}
                      onChange={(e) => setForm(f => ({ ...f, service_address: e.target.value }))}
                      className="bg-slate-700/50 border-slate-600"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Ville *</Label>
                    <Input
                      value={form.service_city}
                      onChange={(e) => setForm(f => ({ ...f, service_city: e.target.value }))}
                      className="bg-slate-700/50 border-slate-600"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Code postal *</Label>
                    <Input
                      value={form.service_postal_code}
                      onChange={(e) => setForm(f => ({ ...f, service_postal_code: e.target.value.toUpperCase() }))}
                      placeholder="H0H 0H0"
                      className="bg-slate-700/50 border-slate-600"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* ID Verification Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Pièce d'identité
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-slate-300">Type de pièce</Label>
                    <select
                      value={form.id_type || ""}
                      onChange={(e) => setForm(f => ({ ...f, id_type: e.target.value }))}
                      className="w-full h-10 px-3 rounded-md bg-slate-700/50 border border-slate-600 text-white"
                    >
                      <option value="">Sélectionner...</option>
                      <option value="drivers_license">Permis de conduire</option>
                      <option value="passport">Passeport</option>
                      <option value="health_card">Carte d'assurance maladie</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Numéro de pièce</Label>
                    <Input
                      value={form.id_number || ""}
                      onChange={(e) => setForm(f => ({ ...f, id_number: e.target.value }))}
                      className="bg-slate-700/50 border-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* PIN Section */}
              <div className="space-y-4 p-4 rounded-xl bg-slate-700/30 border border-slate-600/50">
                <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  NIP de sécurité (4 chiffres)
                </h4>
                <p className="text-xs text-slate-400">
                  Le NIP sera utilisé par le client pour accéder à son compte et confirmer les opérations sensibles.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-slate-300">NIP</Label>
                    <InputOTP
                      maxLength={4}
                      value={form.pin || ""}
                      onChange={(val) => setForm(f => ({ ...f, pin: val }))}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="bg-slate-700/50 border-slate-600" />
                        <InputOTPSlot index={1} className="bg-slate-700/50 border-slate-600" />
                        <InputOTPSlot index={2} className="bg-slate-700/50 border-slate-600" />
                        <InputOTPSlot index={3} className="bg-slate-700/50 border-slate-600" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <div>
                    <Label className="text-slate-300">Confirmer le NIP</Label>
                    <InputOTP
                      maxLength={4}
                      value={pinConfirm}
                      onChange={setPinConfirm}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="bg-slate-700/50 border-slate-600" />
                        <InputOTPSlot index={1} className="bg-slate-700/50 border-slate-600" />
                        <InputOTPSlot index={2} className="bg-slate-700/50 border-slate-600" />
                        <InputOTPSlot index={3} className="bg-slate-700/50 border-slate-600" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
                {pinError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {pinError}
                  </div>
                )}
              </div>

              {/* Marketing Consent */}
              <div className="space-y-4 p-4 rounded-xl bg-slate-700/30 border border-slate-600/50">
                <h4 className="text-sm font-medium text-purple-400 flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  Préférences de communication
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="marketing"
                      checked={form.accept_marketing}
                      onCheckedChange={(checked) => setForm(f => ({ ...f, accept_marketing: !!checked }))}
                      className="border-slate-600 data-[state=checked]:bg-purple-500"
                    />
                    <Label htmlFor="marketing" className="text-slate-300 cursor-pointer">
                      Accepte de recevoir des offres promotionnelles par courriel
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="sms"
                      checked={form.accept_sms_notifications}
                      onCheckedChange={(checked) => setForm(f => ({ ...f, accept_sms_notifications: !!checked }))}
                      className="border-slate-600 data-[state=checked]:bg-purple-500"
                    />
                    <Label htmlFor="sms" className="text-slate-300 cursor-pointer">
                      Accepte de recevoir des notifications par SMS
                    </Label>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !form.full_name || !form.email || !form.phone}
                className="w-full bg-orange-500 hover:bg-orange-400 text-white"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continuer au paiement
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default POSCustomerFormAdmin;
