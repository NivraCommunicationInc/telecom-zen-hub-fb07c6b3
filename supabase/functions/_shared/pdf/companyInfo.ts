/**
 * Nivra Communications Inc. — Single Source of Truth
 * ALL PDF documents MUST use this file for company identity.
 */

export const NIVRA = {
  // Legal identity
  legalName: "NIVRA COMMUNICATIONS INC.",
  tradeName: "Nivra Telecom",
  neq: "2291249786",

  // Tax registration  
  tps: "732287291 RT0001",
  tvq: "1229249786 TQ0001",
  tpsLabel: "TPS : 732287291 RT0001",
  tvqLabel: "TVQ : 1229249786 TQ0001",

  // Contact
  email: "Support@nivra-telecom.ca",
  website: "www.nivra-telecom.ca",

  // Address
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  city: "Laval",
  province: "QC",
  postalCode: "H7T 2Y5",

  // PDF header lines
  division: "Service à la clientèle — Division facturation",
  tagline: "Fournisseur de services de télécommunications — Province de Québec",
} as const;

/** Tax rates for Quebec */
export const TAX = {
  GST_RATE: 0.05,
  QST_RATE: 0.09975,
  GST_LABEL: "TPS (5%)",
  QST_LABEL: "TVQ (9,975%)",
} as const;

/** Standard colors for all PDFs */
export const PDF_THEME = {
  navy:      [15, 23, 42]    as [number, number, number],   // #0F172A
  darkSlate: [30, 41, 59]    as [number, number, number],   // #1E293B
  teal:      [20, 184, 166]  as [number, number, number],   // #14B8A6
  blue:      [0, 102, 204]   as [number, number, number],   // #0066CC
  white:     [255, 255, 255] as [number, number, number],
  lightBg:   [248, 250, 252] as [number, number, number],   // #F8FAFC
  text:      [30, 41, 59]    as [number, number, number],
  textMuted: [100, 116, 139] as [number, number, number],   // #64748B
  success:   [22, 163, 74]   as [number, number, number],   // #16A34A
  warning:   [245, 158, 11]  as [number, number, number],
  error:     [239, 68, 68]   as [number, number, number],
  border:    [226, 232, 240] as [number, number, number],   // #E2E8F0
} as const;
