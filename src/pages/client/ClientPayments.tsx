import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Plus, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ClientPayments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCard, setNewCard] = useState({
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvv: "",
  });

  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ["client-payment-methods", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const addCardMutation = useMutation({
    mutationFn: async (card: typeof newCard) => {
      const cardNum = card.cardNumber.replace(/\s/g, "");
      const lastFour = cardNum.slice(-4);
      const cardType = cardNum.startsWith("4") ? "Visa" : cardNum.startsWith("5") ? "Mastercard" : "Card";
      const [month, year] = card.expiry.split("/");
      
      const { data, error } = await supabase
        .from("payment_methods")
        .insert({
          user_id: user?.id,
          card_type: cardType,
          last_four: lastFour,
          expiry_month: parseInt(month),
          expiry_year: 2000 + parseInt(year),
          is_default: paymentMethods?.length === 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payment-methods"] });
      toast({ title: "Carte ajoutée avec succès" });
      setDialogOpen(false);
      setNewCard({ cardNumber: "", cardName: "", expiry: "", cvv: "" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'ajout de la carte", variant: "destructive" });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payment-methods"] });
      toast({ title: "Carte supprimée" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (cardId: string) => {
      // First, unset all defaults
      await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("user_id", user?.id);
      
      // Then set the new default
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_default: true })
        .eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payment-methods"] });
      toast({ title: "Carte par défaut mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const handleAddCard = () => {
    if (!newCard.cardNumber || !newCard.cardName || !newCard.expiry || !newCard.cvv) {
      toast({ title: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    addCardMutation.mutate(newCard);
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Moyens de paiement</h1>
            <p className="text-muted-foreground mt-1">Gérez vos cartes de paiement</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une carte
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une carte de paiement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Numéro de carte</Label>
                  <Input
                    placeholder="1234 5678 9012 3456"
                    value={newCard.cardNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 16);
                      const formatted = value.replace(/(\d{4})(?=\d)/g, "$1 ");
                      setNewCard({ ...newCard, cardNumber: formatted });
                    }}
                    maxLength={19}
                  />
                </div>
                <div>
                  <Label>Nom sur la carte</Label>
                  <Input
                    placeholder="NOM COMPLET"
                    value={newCard.cardName}
                    onChange={(e) => setNewCard({ ...newCard, cardName: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Expiration</Label>
                    <Input
                      placeholder="MM/AA"
                      value={newCard.expiry}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, "").slice(0, 4);
                        if (value.length >= 2) {
                          value = value.slice(0, 2) + "/" + value.slice(2);
                        }
                        setNewCard({ ...newCard, expiry: value });
                      }}
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <Label>CVV</Label>
                    <Input
                      type="password"
                      placeholder="***"
                      value={newCard.cvv}
                      onChange={(e) => setNewCard({ ...newCard, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      maxLength={4}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  variant="hero"
                  onClick={handleAddCard}
                  disabled={addCardMutation.isPending}
                >
                  Ajouter la carte
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              Cartes enregistrées
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : paymentMethods && paymentMethods.length > 0 ? (
              <div className="space-y-4">
                {paymentMethods.map((card: any) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between p-4 bg-accent/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-8 bg-gradient-to-br from-cyan-500 to-cyan-400 rounded flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-navy-900" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {card.card_type} •••• {card.last_four}
                          </p>
                          {card.is_default && (
                            <span className="text-xs bg-cyan-500/20 text-cyan-500 px-2 py-0.5 rounded">
                              Par défaut
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expire {card.expiry_month.toString().padStart(2, "0")}/{card.expiry_year}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!card.is_default && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDefaultMutation.mutate(card.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => deleteCardMutation.mutate(card.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Aucune carte enregistrée</p>
                <Button variant="hero" onClick={() => setDialogOpen(true)}>
                  Ajouter une carte
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientPayments;