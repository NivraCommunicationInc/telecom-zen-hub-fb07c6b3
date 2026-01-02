import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Shield, Lock, AlertCircle, Info } from "lucide-react";

interface SavedCard {
  id: string;
  card_type: string;
  last_four: string;
  expiry_month: number;
  expiry_year: number;
  is_default: boolean;
  is_preauthorized?: boolean;
}

interface CheckoutPaymentSectionProps {
  isFrench: boolean;
  savedCards: SavedCard[];
  selectedPaymentMethod: "saved" | "new";
  onPaymentMethodChange: (method: "saved" | "new") => void;
  selectedCardId: string;
  onSelectedCardChange: (cardId: string) => void;
  cvv: string;
  onCvvChange: (cvv: string) => void;
  newCardData: {
    cardNumber: string;
    cardName: string;
    expiry: string;
    cvv: string;
  };
  onNewCardChange: (data: { cardNumber: string; cardName: string; expiry: string; cvv: string }) => void;
  saveNewCard: boolean;
  onSaveNewCardChange: (save: boolean) => void;
  totalAmount: number;
  cvvError?: string;
}

export const CheckoutPaymentSection = ({
  isFrench,
  savedCards,
  selectedPaymentMethod,
  onPaymentMethodChange,
  selectedCardId,
  onSelectedCardChange,
  cvv,
  onCvvChange,
  newCardData,
  onNewCardChange,
  saveNewCard,
  onSaveNewCardChange,
  totalAmount,
  cvvError,
}: CheckoutPaymentSectionProps) => {
  const hasSavedCards = savedCards && savedCards.length > 0;
  const selectedCard = savedCards?.find(c => c.id === selectedCardId);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (value: string) => {
    let digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 2) {
      digits = digits.slice(0, 2) + "/" + digits.slice(2);
    }
    return digits;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-cyan-500" />
          {isFrench ? "Mode de paiement" : "Payment Method"}
        </CardTitle>
        <CardDescription>
          {isFrench 
            ? "Sélectionnez votre méthode de paiement pour le dépôt préautorisé."
            : "Select your payment method for the pre-authorized deposit."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pre-authorization notice */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {isFrench 
                ? "Montant préautorisé (dépôt) — remboursable si la commande est annulée."
                : "Pre-authorized amount (deposit) — refundable if the order is cancelled."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isFrench 
                ? `Le montant de ${totalAmount.toFixed(2)}$ sera préautorisé sur votre carte. Aucun prélèvement final avant la confirmation du service.`
                : `The amount of $${totalAmount.toFixed(2)} will be pre-authorized on your card. No final charge until service confirmation.`}
            </p>
          </div>
        </div>

        <RadioGroup 
          value={selectedPaymentMethod} 
          onValueChange={(v) => onPaymentMethodChange(v as "saved" | "new")}
        >
          {/* Saved Card Option */}
          {hasSavedCards && (
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedPaymentMethod === "saved" 
                  ? "border-cyan-500 bg-cyan-500/5" 
                  : "border-border hover:border-cyan-500/50"
              }`}
              onClick={() => onPaymentMethodChange("saved")}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="saved" id="payment-saved" className="mt-1" />
                <div className="flex-1 space-y-4">
                  <Label htmlFor="payment-saved" className="text-base font-medium cursor-pointer">
                    {isFrench ? "Carte enregistrée" : "Saved Card"}
                  </Label>

                  {selectedPaymentMethod === "saved" && (
                    <div className="space-y-4">
                      {/* Card selection */}
                      <div className="space-y-2">
                        {savedCards.map((card) => (
                          <div 
                            key={card.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedCardId === card.id 
                                ? "border-cyan-500 bg-cyan-500/10" 
                                : "border-border hover:border-cyan-500/50"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectedCardChange(card.id);
                            }}
                          >
                            <div className="w-10 h-6 bg-gradient-to-br from-cyan-500 to-cyan-400 rounded flex items-center justify-center">
                              <CreditCard className="w-4 h-4 text-navy-900" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-foreground">
                                {card.card_type} •••• {card.last_four}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {isFrench ? "Expire" : "Expires"} {card.expiry_month.toString().padStart(2, "0")}/{card.expiry_year}
                              </p>
                            </div>
                            {card.is_default && (
                              <Badge variant="outline" className="text-xs">
                                {isFrench ? "Par défaut" : "Default"}
                              </Badge>
                            )}
                            {card.is_preauthorized && (
                              <Badge className="bg-emerald-500/20 text-emerald-500 border-0 text-xs">
                                {isFrench ? "Pré-autorisé" : "Pre-authorized"}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* CVV Input for saved card */}
                      {selectedCardId && (
                        <div className="space-y-2 max-w-[120px]">
                          <Label htmlFor="saved-cvv" className="text-sm">
                            CVV <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="saved-cvv"
                            type="password"
                            placeholder="•••"
                            value={cvv}
                            onChange={(e) => onCvvChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            maxLength={4}
                            className={cvvError ? "border-destructive" : ""}
                          />
                          {cvvError && (
                            <p className="text-xs text-destructive">{cvvError}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {isFrench 
                              ? "Code de sécurité au dos de la carte"
                              : "Security code on back of card"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* New Card Option */}
          <div 
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedPaymentMethod === "new" 
                ? "border-cyan-500 bg-cyan-500/5" 
                : "border-border hover:border-cyan-500/50"
            }`}
            onClick={() => onPaymentMethodChange("new")}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value="new" id="payment-new" className="mt-1" />
              <div className="flex-1 space-y-4">
                <Label htmlFor="payment-new" className="text-base font-medium cursor-pointer">
                  {isFrench ? "Utiliser une nouvelle carte" : "Use a new card"}
                </Label>

                {selectedPaymentMethod === "new" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="card-number">
                        {isFrench ? "Numéro de carte" : "Card Number"} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="card-number"
                        placeholder="1234 5678 9012 3456"
                        value={newCardData.cardNumber}
                        onChange={(e) => onNewCardChange({
                          ...newCardData,
                          cardNumber: formatCardNumber(e.target.value)
                        })}
                        maxLength={19}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="card-name">
                        {isFrench ? "Nom sur la carte" : "Name on Card"} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="card-name"
                        placeholder="NOM COMPLET"
                        value={newCardData.cardName}
                        onChange={(e) => onNewCardChange({
                          ...newCardData,
                          cardName: e.target.value.toUpperCase()
                        })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="card-expiry">
                          {isFrench ? "Expiration" : "Expiry"} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="card-expiry"
                          placeholder="MM/AA"
                          value={newCardData.expiry}
                          onChange={(e) => onNewCardChange({
                            ...newCardData,
                            expiry: formatExpiry(e.target.value)
                          })}
                          maxLength={5}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="card-cvv">
                          CVV <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="card-cvv"
                          type="password"
                          placeholder="•••"
                          value={newCardData.cvv}
                          onChange={(e) => onNewCardChange({
                            ...newCardData,
                            cvv: e.target.value.replace(/\D/g, "").slice(0, 4)
                          })}
                          maxLength={4}
                        />
                      </div>
                    </div>

                    {/* Save card option */}
                    <div className="flex items-center gap-3 pt-2">
                      <Checkbox
                        id="save-card"
                        checked={saveNewCard}
                        onCheckedChange={(checked) => onSaveNewCardChange(checked as boolean)}
                      />
                      <Label htmlFor="save-card" className="text-sm text-muted-foreground cursor-pointer">
                        {isFrench 
                          ? "Sauvegarder cette carte pour mes prochains achats"
                          : "Save this card for future purchases"}
                      </Label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </RadioGroup>

        {/* Security notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
          <Lock className="w-4 h-4" />
          <span>
            {isFrench 
              ? "Paiement sécurisé. Vos informations sont chiffrées et protégées."
              : "Secure payment. Your information is encrypted and protected."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckoutPaymentSection;
