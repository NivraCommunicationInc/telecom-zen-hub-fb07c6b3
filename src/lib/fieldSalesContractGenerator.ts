/**
 * Field Sales Contract PDF Generator
 * Generates door-to-door sales contracts
 */
import { jsPDF } from "jspdf";
import { ACTIVE_CONTRACT_TEMPLATE, getContractEngineFooterLine } from "./contractTemplate";

// Tax calculation — centralized server tax engine
import { estimateTaxes, COMBINED_TAX_MULTIPLIER } from "@/lib/pricing/serverTaxEngine";

interface FieldSalesContractData {
  orderNumber: string;
  createdAt: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
  };
  service: {
    type: string;
    planName: string;
    monthlyPrice: number;
  };
  payment: {
    method: string;
    status: string;
    totalAmount: number;
    reference: string | null;
  };
  salespersonName: string;
  appointmentDate: string | null;
  appointmentNotes: string | null;
  signatureData?: string | null;
}

export async function generateFieldSalesContractPDF(data: FieldSalesContractData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 20;

  // Helper functions
  const addText = (text: string, x: number, y: number, options?: any) => {
    doc.text(text, x, y, options);
  };

  const drawLine = (y: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
  };

  // ========== HEADER ==========
  doc.setFillColor(249, 115, 22); // Orange
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  addText("NIVRA TELECOM", marginLeft, 18);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  addText("Contrat de service - Vente porte-à-porte", marginLeft, 28);
  
  doc.setFontSize(10);
  addText(`Contrat #: ${data.orderNumber}`, pageWidth - marginRight - 60, 18);
  addText(new Date(data.createdAt).toLocaleDateString("fr-CA"), pageWidth - marginRight - 60, 28);
  
  currentY = 50;

  // ========== CONTRACT INFO BOX ==========
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(marginLeft, currentY, contentWidth, 25, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  addText(`Numéro de contrat: ${data.orderNumber}`, marginLeft + 5, currentY + 8);
  addText(`Représentant: ${data.salespersonName}`, marginLeft + 80, currentY + 8);
  addText(`Date de signature: ${new Date(data.createdAt).toLocaleDateString("fr-CA")}`, marginLeft + 5, currentY + 18);
  addText(`Version: ${ACTIVE_CONTRACT_TEMPLATE.version}`, marginLeft + 80, currentY + 18);
  
  currentY += 35;

  // ========== CLIENT SECTION ==========
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(249, 115, 22);
  addText("INFORMATIONS DU CLIENT", marginLeft, currentY);
  currentY += 3;
  drawLine(currentY);
  currentY += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const clientInfo = [
    ["Nom complet:", data.customer.name],
    ["Courriel:", data.customer.email],
    ["Téléphone:", data.customer.phone],
    ["Adresse de service:", `${data.customer.address}, ${data.customer.city} ${data.customer.postalCode}`],
  ];

  clientInfo.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    addText(label, marginLeft, currentY);
    doc.setFont("helvetica", "normal");
    addText(value, marginLeft + 45, currentY);
    currentY += 7;
  });

  currentY += 10;

  // ========== SERVICE SECTION ==========
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(249, 115, 22);
  addText("DÉTAILS DU SERVICE", marginLeft, currentY);
  currentY += 3;
  drawLine(currentY);
  currentY += 10;

  doc.setTextColor(0, 0, 0);
  
  // Service table header
  doc.setFillColor(249, 115, 22);
  doc.setTextColor(255, 255, 255);
  doc.rect(marginLeft, currentY, contentWidth, 8, 'F');
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  addText("Service", marginLeft + 5, currentY + 6);
  addText("Plan", marginLeft + 60, currentY + 6);
  addText("Prix mensuel", marginLeft + 130, currentY + 6);
  currentY += 8;

  // Service row
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFillColor(250, 250, 250);
  doc.rect(marginLeft, currentY, contentWidth, 8, 'F');
  addText(data.service.type.charAt(0).toUpperCase() + data.service.type.slice(1), marginLeft + 5, currentY + 6);
  addText(data.service.planName, marginLeft + 60, currentY + 6);
  addText(`${data.service.monthlyPrice.toFixed(2)} $`, marginLeft + 130, currentY + 6);
  currentY += 15;

  // ========== BILLING SECTION ==========
  const subtotal = data.payment.totalAmount / COMBINED_TAX_MULTIPLIER;
  const taxResult = estimateTaxes(subtotal);
  const tps = taxResult.tps;
  const tvq = taxResult.tvq;

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(marginLeft + 90, currentY, 80, 40, 3, 3, 'F');
  
  doc.setFontSize(9);
  let billingY = currentY + 8;
  addText("Sous-total:", marginLeft + 95, billingY);
  addText(`${subtotal.toFixed(2)} $`, marginLeft + 145, billingY, { align: "right" });
  billingY += 7;
  addText("TPS (5%):", marginLeft + 95, billingY);
  addText(`${tps.toFixed(2)} $`, marginLeft + 145, billingY, { align: "right" });
  billingY += 7;
  addText("TVQ (9.975%):", marginLeft + 95, billingY);
  addText(`${tvq.toFixed(2)} $`, marginLeft + 145, billingY, { align: "right" });
  billingY += 2;
  doc.line(marginLeft + 95, billingY, marginLeft + 165, billingY);
  billingY += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  addText("Total:", marginLeft + 95, billingY);
  addText(`${data.payment.totalAmount.toFixed(2)} $`, marginLeft + 145, billingY, { align: "right" });

  currentY += 50;

  // ========== PAYMENT INFO ==========
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(249, 115, 22);
  addText("PAIEMENT", marginLeft, currentY);
  currentY += 3;
  drawLine(currentY);
  currentY += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const paymentMethodLabel = {
    interac: "Interac e-Transfer",
    paypal: "PayPal",
    deferred: "Paiement différé",
    cash: "Comptant",
  }[data.payment.method] || data.payment.method;

  addText(`Méthode de paiement: ${paymentMethodLabel}`, marginLeft, currentY);
  currentY += 7;
  addText(`Statut: ${data.payment.status === "confirmed" ? "Confirmé" : "En attente"}`, marginLeft, currentY);
  if (data.payment.reference) {
    currentY += 7;
    addText(`Référence: ${data.payment.reference}`, marginLeft, currentY);
  }

  currentY += 15;

  // ========== APPOINTMENT INFO ==========
  if (data.appointmentDate) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(249, 115, 22);
    addText("RENDEZ-VOUS D'INSTALLATION", marginLeft, currentY);
    currentY += 3;
    drawLine(currentY);
    currentY += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    addText(`Date: ${new Date(data.appointmentDate).toLocaleDateString("fr-CA", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, marginLeft, currentY);
    
    if (data.appointmentNotes) {
      currentY += 7;
      addText(`Notes: ${data.appointmentNotes}`, marginLeft, currentY);
    }
    currentY += 15;
  }

  // ========== TERMS ==========
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(249, 115, 22);
  addText("CONDITIONS GÉNÉRALES", marginLeft, currentY);
  currentY += 3;
  drawLine(currentY);
  currentY += 8;

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  const terms = [
    "1. Le service est activé après confirmation du paiement complet.",
    "2. Le cycle de facturation de 30 jours débute à la date d'activation du service.",
    "3. Les paiements sont acceptés exclusivement par Interac e-Transfer ou PayPal.",
    "4. Aucun remboursement après activation du service.",
    "5. Le client est responsable de l'équipement fourni pendant la durée du service.",
    "6. Nivra Telecom se réserve le droit de suspendre le service en cas de non-paiement.",
    "7. Ce contrat peut être annulé dans les 10 jours suivant la signature (droit de résolution).",
  ];

  terms.forEach((term) => {
    const lines = doc.splitTextToSize(term, contentWidth);
    doc.text(lines, marginLeft, currentY);
    currentY += lines.length * 4 + 2;
  });

  currentY += 10;

  // ========== SIGNATURE SECTION ==========
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(249, 115, 22);
  addText("SIGNATURE", marginLeft, currentY);
  currentY += 3;
  drawLine(currentY);
  currentY += 15;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Client signature box
  doc.setDrawColor(200, 200, 200);
  doc.rect(marginLeft, currentY, 80, 25);
  addText("Signature du client", marginLeft + 20, currentY + 30);
  
  // Add signature if available
  if (data.signatureData) {
    try {
      doc.addImage(data.signatureData, 'PNG', marginLeft + 5, currentY + 2, 70, 20);
    } catch (e) {
      console.warn("Could not add signature image:", e);
    }
  }

  // Date box
  doc.rect(marginLeft + 90, currentY, 80, 25);
  addText("Date", marginLeft + 120, currentY + 30);
  addText(new Date(data.createdAt).toLocaleDateString("fr-CA"), marginLeft + 110, currentY + 15);

  // ========== FOOTER ==========
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "italic");
  addText(getContractEngineFooterLine({ contractId: data.orderNumber }), marginLeft, footerY);
  addText("Nivra Telecom • 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5 • 438-544-2233", pageWidth / 2, footerY + 5, { align: "center" });

  // Download
  doc.save(`Contrat-${data.orderNumber}.pdf`);
}
