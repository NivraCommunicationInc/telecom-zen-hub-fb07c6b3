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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { CreditCard, Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ClientPayments = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<{ id: string; lastFour: string; cardType: string } | null>(null);
  const [newCard, setNewCard] = useState({
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvv: "",
  });

  // Fetch only active cards (deleted_at IS NULL)
  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ["client-payment-methods", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user?.id)
        .is("deleted_at", null)
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
      const expiryMonth = parseInt(month);
      const expiryYear = 2000 + parseInt(year);
      
      // Generate deterministic fingerprint for deduplication
      // Format: network-last4-MM-YYYY (no cardholder name to avoid variations)
      const paymentFingerprint = `${cardType}-${lastFour}-${expiryMonth}-${expiryYear}`;
      
      // Use UPSERT to prevent duplicate cards
      const { data, error } = await portalSupabase
        .from("payment_methods")
        .upsert({
          user_id: user?.id,
          card_type: cardType,
          last_four: lastFour,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          payment_fingerprint: paymentFingerprint,
          is_default: paymentMethods?.length === 0,
          cardholder_name: card.cardName || null,
          deleted_at: null, // Ensure we're reactivating if it was soft-deleted
        }, {
          onConflict: 'user_id,payment_fingerprint',
          ignoreDuplicates: false,
        })
        .select()
        .single();
      
      if (error) {
        // If it's a duplicate key error, find and return existing card
        if (error.code === '23505') {
          const { data: existingCard } = await portalSupabase
            .from("payment_methods")
            .select("*")
            .eq("user_id", user?.id)
            .eq("payment_fingerprint", paymentFingerprint)
            .single();
          
          if (existingCard) {
            return { ...existingCard, _isDuplicate: true };
          }
        }
        throw error;
      }
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["client-payment-methods", user?.id] });
      if (data?._isDuplicate) {
        toast({ title: "Cette carte est déjà enregistrée", description: "Nous l'avons sélectionnée pour vous." });
      } else {
        toast({ title: "Carte ajoutée avec succès" });
      }
      setDialogOpen(false);
      setNewCard({ cardNumber: "", cardName: "", expiry: "", cvv: "" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'ajout de la carte", variant: "destructive" });
    },
  });

  // Soft delete mutation
  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      if (!user?.id) throw new Error("Missing user");

      // (Optionnel) Was default? basé sur le state (OK mais peut être stale)
      const cardBeingDeleted = paymentMethods?.find((c) => c.id === cardId);
      const wasDefault = cardBeingDeleted?.is_default === true;

      // Soft delete: set deleted_at and remove default status
      const { error } = await portalSupabase
        .from("payment_methods")
        .update({
          deleted_at: new Date().toISOString(),
          is_default: false,
        })
        .eq("id", cardId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Vérifier s'il existe une carte default active après suppression
      const { data: activeDefault, error: defErr } = await portalSupabase
        .from("payment_methods")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .eq("is_default", true)
        .limit(1);

      if (defErr) throw defErr;

      const hasDefault = (activeDefault?.length ?? 0) > 0;

      // Réassigner si nécessaire (carte supprimée était default OU aucune default active)
      if (wasDefault || !hasDefault) {
        const { data: remainingCards, error: remErr } = await portalSupabase
          .from("payment_methods")
          .select("id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1);

        if (remErr) throw remErr;

        if (remainingCards && remainingCards.length > 0) {
          const { error: setErr } = await portalSupabase
            .from("payment_methods")
            .update({ is_default: true })
            .eq("id", remainingCards[0].id)
            .eq("user_id", user.id);

          if (setErr) throw setErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payment-methods", user?.id] });
      toast({ title: "Carte supprimée", description: "La carte a été retirée de votre compte." });
      setDeleteDialogOpen(false);
      setCardToDelete(null);
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", description: "Impossible de supprimer cette carte.", variant: "destructive" });
      setDeleteDialogOpen(false);
      setCardToDelete(null);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (cardId: string) => {
      // First, unset all defaults
      await portalSupabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("user_id", user?.id)
        .is("deleted_at", null);
      
      // Then set the new default
      const { error } = await portalSupabase
        .from("payment_methods")
        .update({ is_default: true })
        .eq("id", cardId)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payment-methods", user?.id] });
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

  const handleDeleteClick = (card: any) => {
    setCardToDelete({ id: card.id, lastFour: card.last_four, cardType: card.card_type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (cardToDelete) {
      deleteCardMutation.mutate(cardToDelete.id);
    }
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
                <DialogDescription>
                  Entrez les informations de votre carte. Les données sensibles ne sont jamais stockées en clair.
                </DialogDescription>
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
                          disabled={setDefaultMutation.isPending}
                          title="Définir comme carte par défaut"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => handleDeleteClick(card)}
                        disabled={deleteCardMutation.isPending}
                        title="Supprimer cette carte"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Supprimer cette carte?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la carte <strong>{cardToDelete?.cardType} •••• {cardToDelete?.lastFour}</strong>?
              <br /><br />
              Cette action retirera la carte de votre compte. Si vous avez des paiements préautorisés actifs, assurez-vous d'avoir une autre carte enregistrée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCardMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteCardMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCardMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClientLayout>
  );
};

export default ClientPayments;