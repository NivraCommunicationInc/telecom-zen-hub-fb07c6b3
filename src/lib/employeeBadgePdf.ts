/**
 * employeeBadgePdf — generates a credit-card-size (85.6 x 54 mm) employee
 * badge PDF using jsPDF. Includes role-coloured background, name, role,
 * department, badge number and a QR code.
 */
import jsPDF from "jspdf";
import QRCode from "qrcode";

export interface BadgeData {
  full_name: string;
  agent_number: string;
  role_title_fr: string;
  dept_fr: string;
  color: string;
  qr_payload: string;
  support_email: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [
    parseInt(m.substring(0, 2), 16),
    parseInt(m.substring(2, 4), 16),
    parseInt(m.substring(4, 6), 16),
  ];
}

export async function downloadBadgePdf(badge: BadgeData): Promise<void> {
  // Credit-card size, landscape
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });
  const [r, g, b] = hexToRgb(badge.color || "#7C3AED");

  // Coloured background
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 85.6, 54, "F");

  // Header
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("NIVRA TELECOM", 4, 6);

  // Name (large)
  doc.setFontSize(14);
  doc.text(truncate(badge.full_name, 28), 4, 18);

  // Role
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(truncate(badge.role_title_fr, 32), 4, 24);

  // Department
  doc.setFontSize(7);
  doc.text(truncate(badge.dept_fr, 32), 4, 29);

  // Badge number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Badge: ${badge.agent_number}`, 4, 42);

  // Support email
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(badge.support_email, 4, 50);

  // QR code (top-right)
  try {
    const qrDataUrl = await QRCode.toDataURL(badge.qr_payload, {
      margin: 0,
      width: 200,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    // White backing for contrast
    doc.setFillColor(255, 255, 255);
    doc.rect(64, 32, 18, 18, "F");
    doc.addImage(qrDataUrl, "PNG", 65, 33, 16, 16);
  } catch {
    // QR generation failure is non-fatal
  }

  doc.save(`badge-nivra-${badge.agent_number}.pdf`);
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.substring(0, n - 1) + "…" : s;
}
