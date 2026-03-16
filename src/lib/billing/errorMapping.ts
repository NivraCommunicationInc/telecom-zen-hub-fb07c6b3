/**
 * Billing Error Mapping - Telco-grade UX
 * Maps DB constraint violations and RPC errors to user-friendly messages.
 */

export interface BillingError {
  code: string;
  title: string;
  description: string;
  severity: 'warning' | 'error';
}

const BILLING_ERROR_MAP: Record<string, BillingError> = {
  DUPLICATE_SERVICE_AT_ADDRESS: {
    code: 'DUPLICATE_SERVICE_AT_ADDRESS',
    title: 'Service déjà actif à cette adresse',
    description: 'Un service de cette catégorie est déjà actif ou en cours d\'activation à cette adresse. Veuillez choisir une autre adresse ou annuler le service existant avant d\'en commander un nouveau.',
    severity: 'warning',
  },
  ORDER_NOT_FOUND: {
    code: 'ORDER_NOT_FOUND',
    title: 'Commande introuvable',
    description: 'La commande référencée est introuvable. Veuillez réessayer ou contacter le support.',
    severity: 'error',
  },
  CUSTOMER_NOT_FOUND: {
    code: 'CUSTOMER_NOT_FOUND',
    title: 'Compte client introuvable',
    description: 'Votre compte de facturation n\'a pas été trouvé. Veuillez contacter le support.',
    severity: 'error',
  },
  NO_LINE_ITEMS: {
    code: 'NO_LINE_ITEMS',
    title: 'Aucun service à activer',
    description: 'Cette commande ne contient aucun service ou équipement à provisionner.',
    severity: 'error',
  },
  ADDRESS_REQUIRED: {
    code: 'ADDRESS_REQUIRED',
    title: 'Adresse de service requise',
    description: 'Une adresse de service est requise pour les services Internet, TV ou Combo. Veuillez sélectionner ou ajouter une adresse.',
    severity: 'error',
  },
  DUPLICATE_ADDRESS: {
    code: 'DUPLICATE_ADDRESS',
    title: 'Adresse déjà enregistrée',
    description: 'Cette adresse existe déjà dans votre compte, même si elle est écrite différemment. Sélectionnez-la dans la liste.',
    severity: 'warning',
  },
  CHECKOUT_FINALIZING: {
    code: 'CHECKOUT_FINALIZING',
    title: 'Commande en cours de finalisation',
    description: 'Votre commande est en cours de finalisation. Veuillez patienter quelques instants puis vérifier Mes commandes.',
    severity: 'warning',
  },
};

/**
 * Maps a raw DB/RPC error to a user-friendly billing error.
 * Handles both RPC response errors and raw PostgreSQL constraint violations.
 */
export function mapBillingError(error: any): BillingError {
  // Check if it's a structured RPC response with error code
  if (error?.error && BILLING_ERROR_MAP[error.error]) {
    return BILLING_ERROR_MAP[error.error];
  }

  // Also read `error.error` raw text (many backends return message there instead of `message`)
  const rawMessage = String(error?.message || error?.error || error?.details || '').toLowerCase();

  // Never expose internal canonical chain failures to clients
  if (
    rawMessage.includes('billing_invoice_lines') ||
    rawMessage.includes('lignes de facturation') ||
    rawMessage.includes('dossier de facturation') ||
    rawMessage.includes('no account resolved')
  ) {
    return BILLING_ERROR_MAP.CHECKOUT_FINALIZING;
  }

  // Check raw PostgreSQL error code 23505 (unique_violation)
  if (error?.code === '23505') {
    const detail = error?.details || error?.message || '';
    if (detail.includes('idx_unique_sub_per_address_category')) {
      return BILLING_ERROR_MAP.DUPLICATE_SERVICE_AT_ADDRESS;
    }
    if (detail.includes('idx_unique_address_hash_per_account')) {
      return BILLING_ERROR_MAP.DUPLICATE_ADDRESS;
    }
    return {
      code: 'DUPLICATE_ENTRY',
      title: 'Entrée en double',
      description: 'Cette opération a déjà été effectuée. Veuillez rafraîchir la page.',
      severity: 'warning',
    };
  }

  // Check for RLS/permission errors
  if (error?.code === '42501' || error?.code === 'PGRST301') {
    return {
      code: 'PERMISSION_DENIED',
      title: 'Accès refusé',
      description: 'Votre session a peut-être expiré. Veuillez vous reconnecter.',
      severity: 'error',
    };
  }

  // Default fallback
  return {
    code: 'UNKNOWN_ERROR',
    title: 'Erreur inattendue',
    description: error?.message || 'Une erreur est survenue. Veuillez réessayer ou contacter le support.',
    severity: 'error',
  };
}
