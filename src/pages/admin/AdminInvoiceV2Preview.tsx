/**
 * Admin Invoice V2 Preview Page
 * Test page to preview and validate the new invoice template design
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, FileText, Eye, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { downloadInvoiceV2PDF, type InvoiceV2Data } from "@/lib/pdfEngine/invoiceTemplateV2";
import { useToast } from "@/hooks/use-toast";

// Sample data for preview
const getSampleInvoiceData = (): InvoiceV2Data => ({
  invoiceNumber: "INV-2026-001234",
  accountNumber: "5-0630-8172",
  paymentBankNumber: "50630817208",
  billingDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  
  clientName: "Jean-Pierre Tremblay",
  clientEmail: "jp.tremblay@exemple.ca",
  clientPhone: "514-555-1234",
  clientAddress: "1234 Rue Principale",
  clientCity: "Laval",
  clientProvince: "QC",
  clientPostalCode: "H7T 2Y5",
  
  previousBalance: 0,
  carriedBalance: 0,
  
  services: [
    {
      type: "Internet",
      name: "Internet Fibre 500 Mbps",
      description: "Connexion fibre optique haute vitesse",
      quantity: 1,
      monthlyPrice: 75.00,
      period: "/mois",
    },
    {
      type: "TV",
      name: "Forfait TV Essentiel",
      description: "100+ chaînes HD",
      quantity: 1,
      monthlyPrice: 35.00,
      period: "/mois",
    },
    {
      type: "Mobile",
      name: "Forfait Mobile 15 Go",
      description: "Appels illimités Canada",
      quantity: 1,
      monthlyPrice: 45.00,
      period: "/30 jours",
    },
  ],
  
  oneTimeFees: [
    { label: "Frais d'activation", amount: 25.00 },
  ],
  
  discounts: [
    { label: "Rabais fidélité", amount: 10.00 },
  ],
  
  subtotal: 155.00,
  tps: 7.75,
  tvq: 15.46,
  total: 178.21,
  
  isPaid: false,
  
  importantNotice: "Nous nous engageons à vous tenir au courant de tout changement apporté à vos services. Le gouvernement du Québec a mis à jour les frais d'accès au service d'urgence 911.",
  
  // No signatures for preview
  clientSignature: undefined,
  agentSignature: undefined,
});

const AdminInvoiceV2Preview = () => {
  const { toast } = useToast();
  const [invoiceData, setInvoiceData] = useState<InvoiceV2Data>(getSampleInvoiceData());
  const [isPaid, setIsPaid] = useState(false);
  const [showSignatures, setShowSignatures] = useState(false);
  const [clientSignatureText, setClientSignatureText] = useState("");
  const [agentSignatureText, setAgentSignatureText] = useState("");

  const handleDownload = () => {
    try {
      const dataToDownload: InvoiceV2Data = {
        ...invoiceData,
        isPaid,
        clientSignature: showSignatures && clientSignatureText ? clientSignatureText : undefined,
        clientSignatureType: showSignatures && clientSignatureText ? "text" : undefined,
        clientSignedAt: showSignatures && clientSignatureText ? new Date().toISOString() : undefined,
        agentSignature: showSignatures && agentSignatureText ? agentSignatureText : undefined,
        agentName: showSignatures && agentSignatureText ? agentSignatureText : undefined,
        agentSignedAt: showSignatures && agentSignatureText ? new Date().toISOString() : undefined,
      };
      
      downloadInvoiceV2PDF(dataToDownload);
      
      toast({
        title: "PDF généré!",
        description: "Le fichier a été téléchargé avec succès.",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF. Vérifiez la console.",
        variant: "destructive",
      });
    }
  };

  const updateService = (index: number, field: string, value: any) => {
    const updatedServices = [...invoiceData.services];
    (updatedServices[index] as any)[field] = value;
    
    // Recalculate totals
    const subtotal = updatedServices.reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);
    const tps = Math.round(subtotal * 0.05 * 100) / 100;
    const tvq = Math.round(subtotal * 0.09975 * 100) / 100;
    const total = subtotal + tps + tvq;
    
    setInvoiceData({
      ...invoiceData,
      services: updatedServices,
      subtotal,
      tps,
      tvq,
      total,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/pdf-test">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-accent" />
                Preview Facture V2
              </h1>
              <p className="text-muted-foreground">
                Nouveau template inspiré du style Rogers — Design professionnel
              </p>
            </div>
          </div>
          
          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Télécharger PDF
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Configuration */}
          <div className="space-y-4">
            {/* Client Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Informations client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nom complet</Label>
                    <Input
                      value={invoiceData.clientName}
                      onChange={(e) => setInvoiceData({ ...invoiceData, clientName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Numéro de compte</Label>
                    <Input
                      value={invoiceData.accountNumber}
                      onChange={(e) => setInvoiceData({ ...invoiceData, accountNumber: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Adresse</Label>
                  <Input
                    value={invoiceData.clientAddress}
                    onChange={(e) => setInvoiceData({ ...invoiceData, clientAddress: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Ville</Label>
                    <Input
                      value={invoiceData.clientCity}
                      onChange={(e) => setInvoiceData({ ...invoiceData, clientCity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Province</Label>
                    <Input
                      value={invoiceData.clientProvince}
                      onChange={(e) => setInvoiceData({ ...invoiceData, clientProvince: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Code postal</Label>
                    <Input
                      value={invoiceData.clientPostalCode}
                      onChange={(e) => setInvoiceData({ ...invoiceData, clientPostalCode: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Services</CardTitle>
                <CardDescription>Modifiez les services et les montants</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoiceData.services.map((service, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{service.type}</Badge>
                      <Input
                        type="number"
                        className="w-24 text-right"
                        value={service.monthlyPrice}
                        onChange={(e) => updateService(index, "monthlyPrice", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <Input
                      value={service.name}
                      onChange={(e) => updateService(index, "name", e.target.value)}
                      placeholder="Nom du service"
                    />
                  </div>
                ))}
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Sous-total:</span>
                  <span className="text-right font-medium">${invoiceData.subtotal.toFixed(2)}</span>
                  
                  <span className="text-muted-foreground">TPS (5%):</span>
                  <span className="text-right">${invoiceData.tps.toFixed(2)}</span>
                  
                  <span className="text-muted-foreground">TVQ (9.975%):</span>
                  <span className="text-right">${invoiceData.tvq.toFixed(2)}</span>
                  
                  <span className="font-bold">Total:</span>
                  <span className="text-right font-bold text-lg">${invoiceData.total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Facture payée</Label>
                    <p className="text-xs text-muted-foreground">Affiche le badge "PAYÉ"</p>
                  </div>
                  <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Inclure signatures</Label>
                    <p className="text-xs text-muted-foreground">Ajoute la section signatures</p>
                  </div>
                  <Switch checked={showSignatures} onCheckedChange={setShowSignatures} />
                </div>
                
                {showSignatures && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <Label>Signature client (texte)</Label>
                      <Input
                        value={clientSignatureText}
                        onChange={(e) => setClientSignatureText(e.target.value)}
                        placeholder="Nom du client pour signature"
                      />
                    </div>
                    <div>
                      <Label>Signature agent (texte)</Label>
                      <Input
                        value={agentSignatureText}
                        onChange={(e) => setAgentSignatureText(e.target.value)}
                        placeholder="Nom de l'agent pour signature"
                      />
                    </div>
                  </div>
                )}
                
                <Separator />
                
                <div>
                  <Label>Message important (optionnel)</Label>
                  <Textarea
                    value={invoiceData.importantNotice || ""}
                    onChange={(e) => setInvoiceData({ ...invoiceData, importantNotice: e.target.value })}
                    placeholder="Avis important à afficher sur la facture..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Aperçu du design
                </CardTitle>
                <CardDescription>
                  Représentation visuelle du template (le PDF final peut varier légèrement)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {/* Mini preview mockup */}
                <div className="bg-white border rounded-lg shadow-sm p-4 space-y-3 text-xs">
                  {/* Header bar mockup */}
                  <div className="h-1 bg-accent rounded-full" />
                  <div className="bg-muted/30 p-2 rounded flex justify-between items-center">
                    <div className="space-y-0.5">
                      <p className="text-[8px] text-muted-foreground">Numéro de compte</p>
                      <p className="font-bold text-[10px]">{invoiceData.accountNumber}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] text-muted-foreground">Numéro de facture</p>
                      <p className="font-bold text-[10px]">{invoiceData.invoiceNumber}</p>
                    </div>
                    <p className="font-bold text-accent text-sm">NIVRA</p>
                  </div>
                  
                  {/* Welcome */}
                  <p className="font-bold text-sm">
                    Bonjour {invoiceData.clientName.toUpperCase()}, voici votre facture.
                  </p>
                  
                  {/* Two columns */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border rounded p-2">
                      <p className="text-[8px] font-medium mb-1">Quels sont les frais totaux?</p>
                      <p className="text-lg font-bold text-primary">${invoiceData.total.toFixed(2)}</p>
                      {isPaid && (
                        <Badge className="bg-green-500 text-[8px] mt-1">PAYÉ</Badge>
                      )}
                    </div>
                    <div className="border rounded p-2">
                      <p className="text-[8px] font-medium mb-1">Que comprend mon total?</p>
                      <div className="space-y-0.5 text-[8px]">
                        {invoiceData.services.map((s, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{s.type}</span>
                            <span>${s.monthlyPrice.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Services table mockup */}
                  <div className="bg-primary text-white p-1 rounded text-[8px] font-bold">
                    DÉTAIL DES SERVICES
                  </div>
                  <div className="border rounded overflow-hidden">
                    <div className="bg-muted/50 p-1 flex text-[7px] font-medium">
                      <span className="w-12">TYPE</span>
                      <span className="flex-1">SERVICE</span>
                      <span className="w-16 text-right">PRIX</span>
                    </div>
                    {invoiceData.services.map((s, i) => (
                      <div key={i} className={`p-1 flex text-[7px] ${i % 2 === 0 ? 'bg-muted/20' : ''}`}>
                        <span className="w-12">{s.type}</span>
                        <span className="flex-1">{s.name}</span>
                        <span className="w-16 text-right">${s.monthlyPrice.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Signatures mockup */}
                  {showSignatures && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="border rounded p-2 h-12">
                        <p className="text-[7px] text-muted-foreground">Signature Client</p>
                        {clientSignatureText && (
                          <p className="italic text-[9px]">{clientSignatureText}</p>
                        )}
                      </div>
                      <div className="bg-primary text-primary-foreground rounded p-2 h-12">
                        <p className="text-[7px] opacity-80">Signature Nivra</p>
                        {agentSignatureText && (
                          <p className="italic text-[9px]">{agentSignatureText}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Design notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Notes de design</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>✓ Header horizontal avec infos compte (style Rogers)</p>
                <p>✓ Message de bienvenue personnalisé</p>
                <p>✓ Deux colonnes: Total + Sommaire</p>
                <p>✓ Badge "PAYÉ" visible si applicable</p>
                <p>✓ Économies affichées en vert</p>
                <p>✓ Tableau services propre avec alternance</p>
                <p>✓ Signatures client/agent avec date</p>
                <p>✓ Footer avec coordonnées Nivra</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminInvoiceV2Preview;
