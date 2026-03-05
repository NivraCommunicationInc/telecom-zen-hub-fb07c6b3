/**
 * Order Orchestration - Pure Logic (no DB dependencies)
 * 
 * Graph builder, service detection, dependency rules.
 * Importable in tests without supabase client side-effects.
 */

export type ServiceCategory = 'internet' | 'tv' | 'mobile' | 'streaming' | 'security';

export interface ServiceDependency {
  from: ServiceCategory;
  to: ServiceCategory;
  reason: string;
}

/**
 * Carrier-grade dependency rules.
 */
export const SERVICE_DEPENDENCIES: ServiceDependency[] = [
  { from: 'internet', to: 'tv', reason: 'TV requires active Internet connection' },
];

/**
 * Provisioning job type mapping per service.
 */
export const SERVICE_JOB_MAP: Record<ServiceCategory, string[]> = {
  internet: ['INTERNET_ACTIVATE'],
  tv: ['TV_ACTIVATE', 'CHANNEL_PUSH'],
  mobile: ['MOBILE_ACTIVATE'],
  streaming: ['STREAMING_ACTIVATE'],
  security: ['SECURITY_ACTIVATE'],
};

/**
 * Detect service categories from order service_type string.
 */
export function detectServiceCategories(serviceType: string): ServiceCategory[] {
  const lower = serviceType.toLowerCase();
  const categories: ServiceCategory[] = [];

  if (lower.includes('internet') || lower.includes('fibre')) categories.push('internet');
  if (lower.includes('tv') || lower.includes('télé') || lower.includes('tele')) categories.push('tv');
  if (lower.includes('mobile') || lower.includes('cell')) categories.push('mobile');
  if (lower.includes('streaming')) categories.push('streaming');
  if (lower.includes('sécurité') || lower.includes('security') || lower.includes('alarm')) categories.push('security');

  return categories;
}

export interface ProvisioningNode {
  jobType: string;
  label: string;
  serviceCategory: ServiceCategory;
  priority: number;
  dependsOn: string | null;
}

export function buildProvisioningGraph(
  services: ServiceCategory[],
  hasPortIn: boolean = false
): ProvisioningNode[] {
  const nodes: ProvisioningNode[] = [];
  const hasInternet = services.includes('internet');

  for (const svc of services) {
    const jobs = SERVICE_JOB_MAP[svc] || [];
    
    for (const jobType of jobs) {
      let dependsOn: string | null = null;
      let priority = 50;

      switch (jobType) {
        case 'INTERNET_ACTIVATE':
          priority = 10;
          break;
        case 'TV_ACTIVATE':
          priority = 20;
          dependsOn = hasInternet ? 'INTERNET_ACTIVATE' : null;
          break;
        case 'CHANNEL_PUSH':
          priority = 25;
          dependsOn = 'TV_ACTIVATE';
          break;
        case 'MOBILE_ACTIVATE':
          priority = 5;
          break;
        case 'STREAMING_ACTIVATE':
          priority = 30;
          break;
        case 'SECURITY_ACTIVATE':
          priority = 15;
          dependsOn = hasInternet ? 'INTERNET_ACTIVATE' : null;
          break;
      }

      nodes.push({
        jobType,
        label: getJobLabel(jobType),
        serviceCategory: svc,
        priority,
        dependsOn,
      });
    }
  }

  if (hasPortIn && services.includes('mobile')) {
    nodes.push({
      jobType: 'PORT_IN',
      label: 'Portage numéro',
      serviceCategory: 'mobile',
      priority: 6,
      dependsOn: 'MOBILE_ACTIVATE',
    });
  }

  return nodes.sort((a, b) => a.priority - b.priority);
}

function getJobLabel(jobType: string): string {
  const labels: Record<string, string> = {
    INTERNET_ACTIVATE: 'Activation Internet',
    TV_ACTIVATE: 'Activation TV',
    MOBILE_ACTIVATE: 'Activation Mobile',
    STREAMING_ACTIVATE: 'Activation Streaming',
    SECURITY_ACTIVATE: 'Activation Sécurité',
    PORT_IN: 'Portage numéro',
    ESIM_PROVISION: 'Provisionnement eSIM',
    CHANNEL_PUSH: 'Configuration chaînes',
    EQUIPMENT_ASSIGN: 'Assignation équipement',
  };
  return labels[jobType] || jobType;
}
