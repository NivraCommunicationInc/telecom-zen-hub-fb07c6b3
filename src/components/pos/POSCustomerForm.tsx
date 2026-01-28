import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Loader2 } from "lucide-react";

export interface CustomerData {
  full_name: string;
  email: string;
  phone: string;
  service_address: string;
  service_city: string;
  service_postal_code: string;
  date_of_birth?: string;
}

interface POSCustomerFormProps {
  onSubmit: (data: CustomerData) => void;
  initialData?: CustomerData | null;
  isSubmitting?: boolean;
}

export function POSCustomerForm({ onSubmit, initialData, isSubmitting }: POSCustomerFormProps) {
  const [form, setForm] = useState<CustomerData>(initialData || {
    full_name: "", email: "", phone: "", service_address: "", service_city: "", service_postal_code: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.phone) return;
    onSubmit(form);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader><CardTitle className="text-white flex items-center gap-2"><User className="h-5 w-5" />Informations client</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label className="text-slate-300">Nom complet *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="bg-slate-700/50 border-slate-600" required /></div>
            <div><Label className="text-slate-300">Courriel *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-slate-700/50 border-slate-600" required /></div>
            <div><Label className="text-slate-300">Téléphone *</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-slate-700/50 border-slate-600" required /></div>
            <div><Label className="text-slate-300">Date de naissance</Label><Input type="date" value={form.date_of_birth || ""} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} className="bg-slate-700/50 border-slate-600" /></div>
            <div className="md:col-span-2"><Label className="text-slate-300">Adresse</Label><Input value={form.service_address} onChange={e => setForm(f => ({ ...f, service_address: e.target.value }))} className="bg-slate-700/50 border-slate-600" /></div>
            <div><Label className="text-slate-300">Ville</Label><Input value={form.service_city} onChange={e => setForm(f => ({ ...f, service_city: e.target.value }))} className="bg-slate-700/50 border-slate-600" /></div>
            <div><Label className="text-slate-300">Code postal</Label><Input value={form.service_postal_code} onChange={e => setForm(f => ({ ...f, service_postal_code: e.target.value }))} className="bg-slate-700/50 border-slate-600" /></div>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-orange-500 hover:bg-orange-400 text-white">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Continuer au paiement
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
