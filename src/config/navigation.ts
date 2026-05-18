/**
 * Centralized navigation configuration
 * Single source of truth for all navbar navigation targets
 * 
 * REGRESSION GUARD: If you modify this file, ensure all targets exist:
 * - For 'scroll' type: section with matching ID must exist on Index page
 * - For 'route' type: route must be defined in App.tsx
 */

export type NavTargetType = 'scroll' | 'route';

export interface NavTarget {
  id: string;
  label: string;
  labelFr: string;
  type: NavTargetType;
  target: string; // section ID for scroll, route path for route
  fallbackRoute: string; // safe fallback if target doesn't exist
  /** Sub-items shown in a dropdown on hover/click */
  children?: NavTarget[];
}

export const NAV_TARGETS: NavTarget[] = [
  {
    id: 'services',
    label: 'Services',
    labelFr: 'Services',
    type: 'scroll',
    target: 'services',
    fallbackRoute: '/#services',
  },
  {
    id: 'internet',
    label: 'Internet',
    labelFr: 'Internet',
    type: 'route',
    target: '/internet',
    fallbackRoute: '/internet',
  },
  {
    id: 'tv',
    label: 'TV',
    labelFr: 'TV',
    type: 'route',
    target: '/tv',
    fallbackRoute: '/tv',
    children: [
      {
        id: 'tv-plans',
        label: 'TV Plans',
        labelFr: 'Forfaits TV',
        type: 'route',
        target: '/tv',
        fallbackRoute: '/tv',
      },
      {
        id: 'tv-custom',
        label: 'Custom TV',
        labelFr: 'TV sur mesure',
        type: 'route',
        target: '/television-sur-mesure',
        fallbackRoute: '/television-sur-mesure',
      },
    ],
  },
  {
    id: 'mobile',
    label: 'Mobile',
    labelFr: 'Mobile',
    type: 'route',
    target: '/mobile',
    fallbackRoute: '/mobile',
  },
  {
    id: 'couverture',
    label: 'Coverage',
    labelFr: 'Couverture',
    type: 'route',
    target: '/couverture',
    fallbackRoute: '/couverture',
  },
  {
    id: 'phones',
    label: 'Phones',
    labelFr: 'Téléphones',
    type: 'route',
    target: '/telephones',
    fallbackRoute: '/telephones',
  },
  {
    id: 'streaming',
    label: 'Streaming+',
    labelFr: 'Streaming+',
    type: 'route',
    target: '/streaming',
    fallbackRoute: '/streaming',
  },
  {
    id: 'compare',
    label: 'Compare',
    labelFr: 'Comparer',
    type: 'route',
    target: '/compare',
    fallbackRoute: '/compare',
  },
  {
    id: 'parrainage',
    label: 'Refer a friend',
    labelFr: 'Parrainage',
    type: 'route',
    target: '/parrainage',
    fallbackRoute: '/parrainage',
  },
  {
    id: 'support',
    label: 'Support',
    labelFr: 'Support',
    type: 'route',
    target: '/support',
    fallbackRoute: '/support',
  },
  {
    id: 'about',
    label: 'About',
    labelFr: 'À propos',
    type: 'route',
    target: '/a-propos',
    fallbackRoute: '/a-propos',
  },
];

/**
 * Validates that all navigation targets exist in the DOM or routing
 * Call this in development to catch missing targets early
 */
export function validateNavTargets(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof window === 'undefined') {
    return { valid: true, errors: [] };
  }

  NAV_TARGETS.forEach((target) => {
    if (target.type === 'scroll') {
      const element = document.getElementById(target.target);
      if (!element) {
        errors.push(`[NAV WARNING] Scroll target "${target.target}" not found in DOM for "${target.label}"`);
      }
    }
  });

  if (errors.length > 0) {
    console.warn('[Navigation Validation]', errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Safe scroll to section with fallback
 */
export function safeScrollToSection(sectionId: string, fallbackRoute?: string): boolean {
  try {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }
    
    console.warn(`[Navigation] Section "${sectionId}" not found, using fallback`);
    if (fallbackRoute) {
      window.location.href = fallbackRoute;
    }
    return false;
  } catch (error) {
    console.error('[Navigation] Error scrolling to section:', error);
    return false;
  }
}
