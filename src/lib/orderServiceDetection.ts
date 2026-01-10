/**
 * Order Service Detection Utility
 * Determines which fulfillment modules to display for an order based on service_type
 */

export type ServiceKind = 'mobile' | 'internet' | 'tv' | 'streaming';

const MOBILE_KEYWORDS = ['mobile', 'sim', 'forfait', 'cellulaire', 'téléphone', 'phone'];
const INTERNET_KEYWORDS = ['internet', 'giga', 'fibre', 'wifi', 'réseau', 'modem'];
const TV_KEYWORDS = ['tv', 'télé', 'chaîne', 'channel', 'iptv', 'television'];
const STREAMING_KEYWORDS = ['streaming', 'streaming+', 'netflix', 'disney', 'ott'];

/**
 * Parse and normalize service types from order data
 * Handles both comma-separated strings and arrays
 */
export function detectOrderServices(order: {
  service_type?: string | null;
  services?: string[] | null;
  category?: string | null;
}): Set<ServiceKind> {
  const services = new Set<ServiceKind>();
  
  // Collect all service type strings
  const serviceStrings: string[] = [];
  
  // Handle comma-separated service_type string
  if (order.service_type) {
    const parts = order.service_type.split(',').map(s => s.trim().toLowerCase());
    serviceStrings.push(...parts);
  }
  
  // Handle services array
  if (Array.isArray(order.services)) {
    serviceStrings.push(...order.services.map(s => s.toLowerCase()));
  }
  
  // Handle category as fallback
  if (order.category) {
    serviceStrings.push(order.category.toLowerCase());
  }
  
  // Match keywords to service kinds
  for (const str of serviceStrings) {
    if (MOBILE_KEYWORDS.some(kw => str.includes(kw))) {
      services.add('mobile');
    }
    if (INTERNET_KEYWORDS.some(kw => str.includes(kw))) {
      services.add('internet');
    }
    if (TV_KEYWORDS.some(kw => str.includes(kw))) {
      services.add('tv');
    }
    if (STREAMING_KEYWORDS.some(kw => str.includes(kw))) {
      services.add('streaming');
    }
  }
  
  return services;
}

/**
 * Check if order requires technician installation
 */
export function requiresTechnicianInstallation(services: Set<ServiceKind>): boolean {
  return services.has('internet') || services.has('tv');
}

/**
 * Get human-readable service labels
 */
export function getServiceLabels(services: Set<ServiceKind>): string[] {
  const labels: string[] = [];
  if (services.has('mobile')) labels.push('Mobile');
  if (services.has('internet')) labels.push('Internet');
  if (services.has('tv')) labels.push('TV');
  if (services.has('streaming')) labels.push('Streaming+');
  return labels;
}
