/**
 * CashoutRequestDialog - Dialog for field sales reps to request commission withdrawal
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Wallet, Loader2, Mail, Banknote, DollarSign, AlertCircle } from "lucide-react";

const cashoutSchema = z.object({
  amount: z.number().min(25, "Montant minimum: 25$"),
  method: z.enum(["interac", "cheque", "cash"]),
  destination: z.string().min(1, "Destination requise"),
});

type CashoutFormData = z.infer<typeof cashoutSchema>;

interface CashoutRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
}

export function CashoutRequestDialog({ 
  open, 
  onOpenChange, 
  availableBalance 
}: CashoutRequestDialogProps) {
  const queryClient = useQueryClient();
  
  const form = useForm<CashoutFormData>({
    resolver: zodResolver(cashoutSchema),
    defaultValues: {
      amount: Math.floor(availableBalance),
      method: "interac",
      destination: "",
    },
  });

  const selectedMethod = form.watch("method");

  const createRequestMutation = useMutation({
    mutationFn: async (data: CashoutFormData) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Non authentifié");

      if (data.amount > availableBalance) {
        throw new Error("Solde insuffisant");
      }

      const { error } = await supabase
        .from("field_sales_cashout_requests")
        .insert({
          salesperson_id: session.user.id,
          amount: data.amount,
          method: data.method,
          destination: data.destination,
          status: "pending",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande de retrait soumise");
      queryClient.invalidateQueries({ queryKey: ["field-sales-cashout-requests"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: CashoutFormData) => {
    createRequestMutation.mutate(data);
  };

  const getDestinationPlaceholder = () => {
    switch (selectedMethod) {
      case "interac":
        return "Votre adresse courriel Interac";
      case "cheque":
        return "Votre adresse postale complète";
      case "cash":
        return "Point de ramassage préféré";
      default:
        return "";
    }
  };

  const getDestinationLabel = () => {
    switch (selectedMethod) {
      case "interac":
        return "Adresse courriel Interac";
      case "cheque":
        return "Adresse postale";
      case "cash":
        return "Point de ramassage";
      default:
        return "Destination";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Wallet className="h-5 w-5 text-orange-400" />
            Demande de retrait
          </DialogTitle>
          <DialogDescription>
            Solde disponible: <span className="text-emerald-400 font-bold">${availableBalance.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        {availableBalance < 25 ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">Solde insuffisant</p>
            </div>
            <p className="text-sm text-amber-400/80 mt-1">
              Vous devez avoir au moins 25$ de commissions validées pour effectuer un retrait.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Montant à retirer</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                          type="number"
                          min={25}
                          max={availableBalance}
                          step={0.01}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className="pl-9 bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Mode de paiement</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-3 gap-2"
                      >
                        {[
                          { value: "interac", label: "Interac", icon: Mail },
                          { value: "cheque", label: "Chèque", icon: Banknote },
                          { value: "cash", label: "Comptant", icon: DollarSign },
                        ].map((option) => (
                          <div key={option.value}>
                            <RadioGroupItem
                              value={option.value}
                              id={`method-${option.value}`}
                              className="peer sr-only"
                            />
                            <label
                              htmlFor={`method-${option.value}`}
                              className="flex flex-col items-center gap-1 p-3 rounded-lg border border-slate-700 bg-slate-800/50 cursor-pointer transition-all peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-500/10"
                            >
                              <option.icon className="h-5 w-5 text-slate-400 peer-data-[state=checked]:text-orange-400" />
                              <span className="text-xs text-slate-300">{option.label}</span>
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">{getDestinationLabel()}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={getDestinationPlaceholder()}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-slate-700"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createRequestMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-400 text-white"
                >
                  {createRequestMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Soumettre la demande
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
