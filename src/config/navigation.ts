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
    id: 'internet',
    label: 'Internet',
    labelFr: 'Internet',
    type: 'route',
    target: '/internet',
    fallbackRoute: '/internet',
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
    id: 'offers',
    label: 'Offers',
    labelFr: 'Offres',
    type: 'route',
    target: '/compare',
    fallbackRoute: '/compare',
  },
  {
    id: 'support',
    label: 'Support',
    labelFr: 'Support',
    type: 'route',
    target: '/aide',
    fallbackRoute: '/aide',
  },
  {
    id: 'account',
    label: 'My Account',
    labelFr: 'Mon compte',
    type: 'route',
    target: '/portal/auth',
    fallbackRoute: '/portal/auth',
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
