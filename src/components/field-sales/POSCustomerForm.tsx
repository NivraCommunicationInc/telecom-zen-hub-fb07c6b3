/**
 * POSCustomerForm - Streamlined customer info form for POS checkout
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Phone, MapPin, Building, Calendar, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const customerSchema = z.object({
  full_name: z.string().min(2, "Nom requis (min 2 caractères)"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Téléphone invalide"),
  date_of_birth: z.string().optional(),
  service_address: z.string().min(5, "Adresse requise"),
  service_city: z.string().min(2, "Ville requise"),
  service_postal_code: z.string().min(6, "Code postal requis"),
});

export type CustomerData = z.infer<typeof customerSchema>;

interface POSCustomerFormProps {
  onSubmit: (data: CustomerData) => void;
  defaultValues?: Partial<CustomerData>;
  isSubmitting?: boolean;
}

export function POSCustomerForm({ onSubmit, defaultValues, isSubmitting }: POSCustomerFormProps) {
  const form = useForm<CustomerData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      service_address: "",
      service_city: "",
      service_postal_code: "",
      ...defaultValues,
    },
  });

  return (
    <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-white flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <User className="h-5 w-5 text-cyan-400" />
          </div>
          Informations Client
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Nom complet légal
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Jean Tremblay"
                      className="bg-slate-800/50 border-slate-600 text-white h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email & Phone Row */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="client@email.com"
                        className="bg-slate-800/50 border-slate-600 text-white h-11"
                      />
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
                    <FormLabel className="text-slate-300 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      Téléphone
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="514-555-1234"
                        className="bg-slate-800/50 border-slate-600 text-white h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date of Birth */}
            <FormField
              control={form.control}
              name="date_of_birth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Date de naissance (optionnel)
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      className="bg-slate-800/50 border-slate-600 text-white h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address */}
            <FormField
              control={form.control}
              name="service_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Adresse de service
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="123 rue Principale, app. 4"
                      className="bg-slate-800/50 border-slate-600 text-white h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* City & Postal Code Row */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="service_city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300 flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5" />
                      Ville
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Montréal"
                        className="bg-slate-800/50 border-slate-600 text-white h-11"
                      />
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
                    <FormLabel className="text-slate-300 flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" />
                      Code postal
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="H1A 1A1"
                        className="bg-slate-800/50 border-slate-600 text-white h-11 uppercase"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold"
            >
              Continuer vers le paiement
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
