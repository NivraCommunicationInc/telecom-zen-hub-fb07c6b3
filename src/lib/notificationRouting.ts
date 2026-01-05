/**
 * Notification Routing Utility
 * Maps notification types to existing routes with query params for deep-linking
 */

export type NotificationScope = 'admin' | 'portal';

export interface NotificationData {
  type: string;
  link_target?: string | null;
  link_id?: string | null;
  message?: string | null;
  title?: string;
}

interface RouteConfig {
  admin: string;
  portal: string;
  queryParam: string;
}

// Map notification types to their corresponding routes
const routeConfig: Record<string, RouteConfig> = {
  invoice: {
    admin: '/admin/billing',
    portal: '/portal/invoices',
    queryParam: 'invoice',
  },
  payment: {
    admin: '/admin/billing',
    portal: '/portal/payments',
    queryParam: 'payment',
  },
  order: {
    admin: '/admin/orders',
    portal: '/portal/orders',
    queryParam: 'order',
  },
  appointment: {
    admin: '/admin/appointments',
    portal: '/portal/appointments',
    queryParam: 'appt',
  },
  ticket: {
    admin: '/admin/tickets',
    portal: '/portal/tickets',
    queryParam: 'ticket',
  },
  contract: {
    admin: '/admin/contracts',
    portal: '/portal/contracts',
    queryParam: 'contract',
  },
  system: {
    admin: '/admin',
    portal: '/portal',
    queryParam: '',
  },
};

/**
 * Extracts a reference ID from notification data
 * Tries link_id first, then parses from message/title for patterns like INV-2026-XXXX
 */
function extractReferenceId(notification: NotificationData): string | null {
  // First try link_id directly
  if (notification.link_id) {
    return notification.link_id;
  }
  
  // Try to extract from message or title
  const textToSearch = `${notification.message || ''} ${notification.title || ''}`;
  
  // Common patterns: INV-2026-0001, ORD-2026-0001, APPT-2026-0001, etc.
  const patterns = [
    /INV-\d{4}-\d+/i,
    /ORD-\d{4}-\d+/i,
    /APPT-\d{4}-\d+/i,
    /TKT-\d{4}-\d+/i,
    /CTR-\d{4}-\d+/i,
    // UUID pattern
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  ];
  
  for (const pattern of patterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * Validates if a link_target points to an existing route
 */
function isValidRoute(linkTarget: string, scope: NotificationScope): boolean {
  const validAdminRoutes = [
    '/admin',
    '/admin/billing',
    '/admin/orders',
    '/admin/appointments',
    '/admin/tickets',
    '/admin/contracts',
    '/admin/clients',
    '/admin/services',
    '/admin/requests',
    '/admin/activity',
    '/admin/careers',
    '/admin/applications',
    '/admin/channels',
    '/admin/technicians',
    '/admin/replacements',
    '/admin/employees',
    '/admin/promotions',
    '/admin/accounts',
    '/admin/recouvrement',
    '/admin/streaming',
    '/admin/streaming-catalog',
    '/admin/system-status',
    '/admin/internal-tickets',
    '/admin/email-activity',
    '/admin/account',
    '/admin/users',
    '/admin/users-access',
    '/admin/audit-log',
  ];
  
  const validPortalRoutes = [
    '/portal',
    '/portal/appointments',
    '/portal/orders',
    '/portal/invoices',
    '/portal/monthly-invoices',
    '/portal/services',
    '/portal/tickets',
    '/portal/channels',
    '/portal/internet',
    '/portal/tv-order',
    '/portal/replacement',
    '/portal/profile',
    '/portal/payments',
    '/portal/contracts',
  ];
  
  const validRoutes = scope === 'admin' ? validAdminRoutes : validPortalRoutes;
  
  // Extract base path (without query params)
  const basePath = linkTarget.split('?')[0];
  
  return validRoutes.includes(basePath);
}

/**
 * Gets the notification href with proper routing and deep-linking
 * Returns a safe route that won't result in 404
 */
export function getNotificationHref(
  notification: NotificationData,
  scope: NotificationScope
): string {
  // If link_target is provided and valid, use it
  if (notification.link_target) {
    if (isValidRoute(notification.link_target, scope)) {
      // If it already has query params, use as-is
      if (notification.link_target.includes('?')) {
        return notification.link_target;
      }
      // Try to add deep-linking query param
      const refId = extractReferenceId(notification);
      const config = routeConfig[notification.type];
      if (refId && config?.queryParam) {
        return `${notification.link_target}?${config.queryParam}=${encodeURIComponent(refId)}`;
      }
      return notification.link_target;
    }
  }
  
  // Fallback: build route from type
  const config = routeConfig[notification.type] || routeConfig.system;
  const basePath = scope === 'admin' ? config.admin : config.portal;
  
  // Try to add deep-linking query param
  const refId = extractReferenceId(notification);
  if (refId && config.queryParam) {
    return `${basePath}?${config.queryParam}=${encodeURIComponent(refId)}`;
  }
  
  return basePath;
}

/**
 * Gets the fallback list page for a notification type
 * Used when the specific record cannot be found
 */
export function getNotificationFallbackRoute(
  notificationType: string,
  scope: NotificationScope
): string {
  const config = routeConfig[notificationType] || routeConfig.system;
  return scope === 'admin' ? config.admin : config.portal;
}
