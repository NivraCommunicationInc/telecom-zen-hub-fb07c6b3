/**
 * Unified Email Payload Builder
 * Central helper for consistent email payloads across all service types
 */

export type ServiceEmailKind = 'mobile' | 'streaming' | 'installation' | 'service_status';

export interface BaseEmailPayload {
  client_id: string;
  client_email: string;
  client_name: string;
  client_first_name?: string;
  order_id: string;
  order_number: string;
  service_kind: ServiceEmailKind;
  locale: 'fr' | 'en';
  portal_url: string;
}

export interface MobileEmailPayload extends BaseEmailPayload {
  service_kind: 'mobile';
  status: 'number_assigned' | 'port_in_initiated' | 'port_in_submitted' | 'port_in_completed' | 'sim_shipped' | 'sim_delivered' | 'activated';
  phone_number?: string;
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string;
  sim_iccid?: string;
  port_in_number?: string;
  port_in_carrier?: string;
}

export interface StreamingEmailPayload extends BaseEmailPayload {
  service_kind: 'streaming';
  status: 'link_sent' | 'link_reissued' | 'activated' | 'expired';
  token_id: string;
  service_name: string;
  activation_link?: string;
  promo_code?: string;
  expires_at?: string;
}

export interface InstallationEmailPayload extends BaseEmailPayload {
  service_kind: 'installation';
  status: 'installation_scheduled' | 'technician_en_route' | 'technician_assigned' | 'installation_in_progress' | 'installation_completed' | 'completed';
  scheduled_date_time?: string;
  technician_name?: string;
  service_address?: string;
  old_status?: string;
}

export interface ServiceStatusEmailPayload extends BaseEmailPayload {
  service_kind: 'service_status';
  service_instance_id: string;
  service_name: string;
  service_type: string;
  new_status: string;
  old_status?: string;
  reason?: string;
}

export type ServiceEmailPayload = MobileEmailPayload | StreamingEmailPayload | InstallationEmailPayload | ServiceStatusEmailPayload;

interface OrderContext {
  id: string;
  order_number?: string;
  user_id: string;
  client_email?: string;
  profiles?: {
    email?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    service_address?: string;
  };
}

interface ClientContext {
  id?: string;
  email?: string;
  full_name?: string;
  first_name?: string;
}

const PORTAL_BASE_URL = 'https://nivra-telecom.ca/portal';

/**
 * Build base payload shared by all email types
 */
function buildBasePayload(
  order: OrderContext,
  client: ClientContext,
  kind: ServiceEmailKind,
  locale: 'fr' | 'en' = 'fr'
): BaseEmailPayload {
  const clientId = client.id || order.user_id;
  const clientEmail = client.email || order.client_email || order.profiles?.email || '';
  const clientName = client.full_name || order.profiles?.full_name || 'Client';
  const clientFirstName = client.first_name || order.profiles?.first_name || clientName.split(' ')[0];
  
  return {
    client_id: clientId,
    client_email: clientEmail,
    client_name: clientName,
    client_first_name: clientFirstName,
    order_id: order.id,
    order_number: order.order_number || order.id.slice(0, 8).toUpperCase(),
    service_kind: kind,
    locale,
    portal_url: `${PORTAL_BASE_URL}/orders/${order.id}`,
  };
}

/**
 * Build Mobile status email payload
 */
export function buildMobileEmailPayload(
  order: OrderContext,
  client: ClientContext,
  status: MobileEmailPayload['status'],
  details: {
    phone_number?: string;
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
    estimated_delivery?: string;
    sim_iccid?: string;
    port_in_number?: string;
    port_in_carrier?: string;
  } = {},
  locale: 'fr' | 'en' = 'fr'
): MobileEmailPayload {
  const base = buildBasePayload(order, client, 'mobile', locale);
  
  return {
    ...base,
    service_kind: 'mobile',
    status,
    ...details,
  };
}

/**
 * Build Streaming activation email payload
 */
export function buildStreamingEmailPayload(
  order: OrderContext,
  client: ClientContext,
  status: StreamingEmailPayload['status'],
  details: {
    token_id: string;
    service_name: string;
    activation_link?: string;
    promo_code?: string;
    expires_at?: string;
  },
  locale: 'fr' | 'en' = 'fr'
): StreamingEmailPayload {
  const base = buildBasePayload(order, client, 'streaming', locale);
  
  return {
    ...base,
    service_kind: 'streaming',
    status,
    ...details,
  };
}

/**
 * Build Installation status email payload
 */
export function buildInstallationEmailPayload(
  order: OrderContext,
  client: ClientContext,
  status: InstallationEmailPayload['status'],
  details: {
    scheduled_date_time?: string;
    technician_name?: string;
    service_address?: string;
    old_status?: string;
  } = {},
  locale: 'fr' | 'en' = 'fr'
): InstallationEmailPayload {
  const base = buildBasePayload(order, client, 'installation', locale);
  
  return {
    ...base,
    service_kind: 'installation',
    status,
    ...details,
  };
}

/**
 * Build general service status email payload
 */
export function buildServiceStatusEmailPayload(
  order: OrderContext,
  client: ClientContext,
  details: {
    service_instance_id: string;
    service_name: string;
    service_type: string;
    new_status: string;
    old_status?: string;
    reason?: string;
  },
  locale: 'fr' | 'en' = 'fr'
): ServiceStatusEmailPayload {
  const base = buildBasePayload(order, client, 'service_status', locale);
  
  return {
    ...base,
    service_kind: 'service_status',
    ...details,
  };
}

/**
 * Log payload for debugging (without sensitive data)
 */
export function logEmailPayload(payload: ServiceEmailPayload, functionName: string): void {
  const safePayload = {
    ...payload,
    client_email: payload.client_email ? `${payload.client_email.split('@')[0]}@***` : undefined,
  };
  console.log(`[${functionName}] Email payload:`, JSON.stringify(safePayload, null, 2));
}
