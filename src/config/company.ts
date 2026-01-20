/**
 * Single source of truth for company contact information
 * Update these values here only - they are used throughout the entire system
 */

export const COMPANY_CONTACT = {
  // Support contact details
  supportEmail: "support@nivratelecom.ca",
  supportEmailDisplay: "Support@nivratelecom.ca",
  // Phone removed - all support via chat/tickets
  supportPhoneDisplay: "", // Deprecated - use chat/tickets
  supportPhoneTel: "", // Deprecated - use chat/tickets  
  supportPhoneFormatted: "", // Deprecated - use chat/tickets
  
  
  // E-Transfer payment info (if different from support email)
  paymentEmail: "support@nivratelecom.ca",
  paymentEmailDisplay: "Support@nivratelecom.ca",
  
  // Company info
  companyName: "Nivra Telecom",
  legalName: "Nivra Communications Inc.",
  
  // Address
  address: "Montréal, Québec, Canada",
  fullAddress: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  city: "Laval",
  province: "QC",
  country: "Canada",
  
  // Website
  website: "www.nivratelecom.ca",
  portalUrl: "https://nivratelecom.ca",
  
  // Service hours
  supportHours: "Lun–Ven : 9AM – 10PM | Sam–Dim : 9AM – 8PM",
  supportHoursEn: "Mon–Fri: 9AM – 10PM | Sat–Sun: 9AM – 8PM",
  supportHoursWeekday: "Lun–Ven : 9AM – 10PM",
  supportHoursWeekend: "Sam–Dim : 9AM – 8PM",
  
  // Service territory
  serviceTerritory: "Province of Québec only",
  
  // From email for transactional emails
  fromEmail: "Nivra Telecom <support@nivratelecom.ca>",
  replyToEmail: "support@nivratelecom.ca",
} as const;

// Helper functions for generating links
export const getMailtoLink = (email: string = COMPANY_CONTACT.supportEmail) => 
  `mailto:${email.toLowerCase()}`;

export const getTelLink = (phone: string = COMPANY_CONTACT.supportPhoneTel) => 
  `tel:${phone}`;

// E-Transfer configuration
export const ETRANSFER_CONFIG = {
  email: COMPANY_CONTACT.paymentEmail,
  emailDisplay: COMPANY_CONTACT.paymentEmailDisplay,
  securityQuestion: "Le numero de la facture",
  securityAnswer: "( vous mettez le numero de la facture dont vous voulez payer )",
} as const;
