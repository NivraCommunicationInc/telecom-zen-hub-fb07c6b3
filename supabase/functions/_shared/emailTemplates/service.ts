// ============================================================
// NIVRA TELECOM - SERVICE LIFECYCLE TEMPLATES
// Templates for service cancellation, suspension, reactivation
// ============================================================

import { 
  emailDocument, header, statusBanner, contentWrapper, 
  footer, button, sectionHeader, helpSection, alertBox, infoRow,
  colors, escapeHtml, formatCurrencySimple
} from './components.ts';

interface BaseParams {
  supportEmail: string;
}

// 1. Demande d'annulation reçue
export const cancellationRequestReceived = (params: BaseParams & {
  clientName: string;
  serviceName: string;
  requestDate: string;
  effectiveDate: string;
  requestNumber?: string;
  cancellationReason?: string;
  portalUrl?: string;
}): string => {
  const { clientName, serviceName, requestDate, effectiveDate, requestNumber, cancellationReason, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('warning', '📋', 'Demande d\'annulation reçue', serviceName)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons bien reçu votre demande d'annulation de service. Voici les détails:
      </p>
      
      ${sectionHeader('Détails de la demande', 'warning')}
      <div style="background-color: ${colors.warningBg}; border: 1px solid ${colors.warningBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${requestNumber ? infoRow('Numéro de demande', requestNumber) : ''}
            ${infoRow('Service', serviceName)}
            ${infoRow('Date de la demande', requestDate)}
            ${infoRow('Date d\'effet', effectiveDate)}
            ${cancellationReason ? infoRow('Raison', cancellationReason) : ''}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', 'ℹ️', 'Votre service reste actif', `Votre service ${serviceName} restera actif jusqu'au ${effectiveDate}. Vous pouvez continuer à l'utiliser normalement.`)}
      
      <p style="color: ${colors.textSecondary}; font-size: 15px; line-height: 1.7; margin: 24px 0;">
        Si vous avez changé d'avis ou si cette demande a été faite par erreur, vous pouvez l'annuler depuis votre portail client.
      </p>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Gérer ma demande →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Demande d\'annulation reçue - Nivra Télécom',
    `${clientName}, votre demande d'annulation pour ${serviceName} a été reçue`,
    content
  );
};

// 2. Service annulé
export const serviceCancelled = (params: BaseParams & {
  clientName: string;
  serviceName: string;
  cancellationDate: string;
  finalBillAmount?: number;
  refundAmount?: number;
  feedbackUrl?: string;
}): string => {
  const { clientName, serviceName, cancellationDate, finalBillAmount, refundAmount, feedbackUrl = 'https://nivratelecom.ca/feedback', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('error', '📤', 'Service annulé', serviceName)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous confirmons l'annulation de votre service ${escapeHtml(serviceName)}. Nous sommes désolés de vous voir partir.
      </p>
      
      ${sectionHeader('Détails de l\'annulation', 'error')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Service', serviceName)}
            ${infoRow('Date d\'annulation', cancellationDate)}
            ${infoRow('Statut', '❌ Annulé')}
            ${finalBillAmount ? infoRow('Facture finale', formatCurrencySimple(finalBillAmount)) : ''}
            ${refundAmount ? infoRow('Remboursement', formatCurrencySimple(refundAmount)) : ''}
          </tbody>
        </table>
      </div>
      
      ${refundAmount ? alertBox('success', '💰', 'Remboursement en cours', `Un remboursement de ${formatCurrencySimple(refundAmount)} sera effectué dans les 5 à 10 jours ouvrables.`) : ''}
      
      <div style="background-color: ${colors.primaryLight}; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: ${colors.textPrimary}; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Vous nous manquerez! 💙</p>
        <p style="color: ${colors.textSecondary}; font-size: 14px; margin: 0 0 16px 0;">N'hésitez pas à revenir. Nous serons toujours là pour vous.</p>
        ${button('Donnez-nous votre avis', feedbackUrl, 'secondary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Service annulé - Nivra Télécom',
    `${clientName}, votre service ${serviceName} a été annulé`,
    content
  );
};

// 3. Service suspendu
export const serviceSuspended = (params: BaseParams & {
  clientName: string;
  serviceName: string;
  suspensionDate: string;
  suspensionReason: string;
  amountDue?: number;
  reactivationUrl?: string;
}): string => {
  const { clientName, serviceName, suspensionDate, suspensionReason, amountDue, reactivationUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('error', '⏸️', 'Service suspendu', serviceName)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous vous informons que votre service ${escapeHtml(serviceName)} a été suspendu.
      </p>
      
      ${alertBox('error', '⏸️', 'Raison de la suspension', suspensionReason)}
      
      ${sectionHeader('Détails', 'error')}
      <div style="background-color: ${colors.errorBg}; border: 1px solid ${colors.errorBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Service', serviceName)}
            ${infoRow('Date de suspension', suspensionDate)}
            ${infoRow('Statut', '⏸️ Suspendu')}
            ${amountDue ? infoRow('Montant dû', formatCurrencySimple(amountDue)) : ''}
          </tbody>
        </table>
      </div>
      
      ${amountDue ? `
        <div style="background-color: ${colors.warningBg}; border: 2px solid ${colors.warning}; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
          <p style="color: ${colors.warningText}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0;">Pour réactiver votre service</p>
          <p style="color: ${colors.textPrimary}; font-size: 28px; font-weight: 800; margin: 0 0 16px 0;">${formatCurrencySimple(amountDue)}</p>
          <p style="color: ${colors.textSecondary}; font-size: 13px; margin: 0;">Veuillez envoyer votre paiement par Interac e-Transfer à ${supportEmail}</p>
        </div>
      ` : ''}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Réactiver mon service →', reactivationUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Service suspendu - Action requise - Nivra Télécom',
    `${clientName}, votre service ${serviceName} a été suspendu`,
    content
  );
};

// 4. Service réactivé
export const serviceReactivated = (params: BaseParams & {
  clientName: string;
  serviceName: string;
  reactivationDate: string;
  portalUrl?: string;
}): string => {
  const { clientName, serviceName, reactivationDate, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '▶️', 'Service réactivé!', serviceName)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Excellente nouvelle! Votre service ${escapeHtml(serviceName)} a été réactivé avec succès. Vous pouvez maintenant en profiter à nouveau!
      </p>
      
      ${sectionHeader('Détails', 'success')}
      <div style="background-color: ${colors.successBg}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Service', serviceName)}
            ${infoRow('Date de réactivation', reactivationDate)}
            ${infoRow('Statut', '✅ Actif')}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon compte →', portalUrl, 'success')}
      </div>
      
      <p style="color: ${colors.textSecondary}; font-size: 14px; text-align: center; margin-top: 24px;">
        Merci de faire confiance à Nivra Télécom!
      </p>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Service réactivé! - Nivra Télécom',
    `${clientName}, votre service ${serviceName} est de nouveau actif!`,
    content
  );
};

// 5. Changement de forfait confirmé
export const planChangeConfirmed = (params: BaseParams & {
  clientName: string;
  oldPlan: string;
  newPlan: string;
  effectiveDate: string;
  newMonthlyPrice: number;
  proratedAmount?: number;
  portalUrl?: string;
}): string => {
  const { clientName, oldPlan, newPlan, effectiveDate, newMonthlyPrice, proratedAmount, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '🔄', 'Changement de forfait confirmé', newPlan)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre changement de forfait a été effectué avec succès!
      </p>
      
      ${sectionHeader('Détails du changement', 'success')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Ancien forfait', oldPlan)}
            ${infoRow('Nouveau forfait', newPlan)}
            ${infoRow('Date d\'effet', effectiveDate)}
            ${infoRow('Nouveau prix mensuel', formatCurrencySimple(newMonthlyPrice))}
            ${proratedAmount ? infoRow('Montant proratisé', formatCurrencySimple(proratedAmount)) : ''}
          </tbody>
        </table>
      </div>
      
      ${proratedAmount ? alertBox('info', 'ℹ️', 'Ajustement proratisé', `Un montant de ${formatCurrencySimple(proratedAmount)} sera ajusté sur votre prochaine facture pour la période de transition.`) : ''}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir mon nouveau forfait →', portalUrl, 'success')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Changement de forfait confirmé - Nivra Télécom',
    `${clientName}, votre forfait a été changé pour ${newPlan}`,
    content
  );
};

// 6. SIM perdue déclarée
export const simLostReported = (params: BaseParams & {
  clientName: string;
  phoneNumber: string;
  reportedAt: string;
  replacementFee?: number;
  portalUrl?: string;
}): string => {
  const { clientName, phoneNumber, reportedAt, replacementFee, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('warning', '📱', 'SIM déclarée perdue', phoneNumber)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons bien enregistré la déclaration de perte de votre carte SIM. Par mesure de sécurité, votre ligne a été immédiatement désactivée.
      </p>
      
      ${alertBox('success', '🔒', 'Ligne sécurisée', 'Votre ligne a été désactivée pour empêcher toute utilisation frauduleuse.')}
      
      ${sectionHeader('Détails', 'warning')}
      <div style="background-color: ${colors.warningBg}; border: 1px solid ${colors.warningBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro', phoneNumber)}
            ${infoRow('Déclaré le', reportedAt)}
            ${infoRow('Statut', '🔒 Ligne désactivée')}
            ${replacementFee ? infoRow('Frais de remplacement', formatCurrencySimple(replacementFee)) : ''}
          </tbody>
        </table>
      </div>
      
      ${sectionHeader('Prochaines étapes', 'primary')}
      <div style="background-color: ${colors.bgSection}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: ${colors.primary}; margin-right: 12px; font-weight: 600;">1.</span>
              <span style="color: ${colors.textPrimary};">Commandez une nouvelle SIM depuis votre portail</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: ${colors.primary}; margin-right: 12px; font-weight: 600;">2.</span>
              <span style="color: ${colors.textPrimary};">Recevez votre nouvelle SIM sous 3-5 jours ouvrables</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: ${colors.primary}; margin-right: 12px; font-weight: 600;">3.</span>
              <span style="color: ${colors.textPrimary};">Activez votre nouvelle SIM et conservez votre numéro</span>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Commander une nouvelle SIM →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'SIM déclarée perdue - Nivra Télécom',
    `${clientName}, votre déclaration de perte a été enregistrée`,
    content
  );
};

// 7. Nouvelle SIM envoyée (remplacement)
export const replacementSimShipped = (params: BaseParams & {
  clientName: string;
  phoneNumber: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: string;
  activationGuideUrl?: string;
}): string => {
  const { clientName, phoneNumber, trackingNumber, carrier, estimatedDelivery, activationGuideUrl = 'https://nivratelecom.ca/activation', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '📦', 'Nouvelle SIM expédiée!', phoneNumber)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Excellente nouvelle! Votre nouvelle carte SIM de remplacement a été expédiée. Vous conserverez votre numéro ${escapeHtml(phoneNumber)}.
      </p>
      
      ${sectionHeader('Informations de livraison', 'success')}
      <div style="background-color: ${colors.successBg}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro', phoneNumber)}
            ${carrier ? infoRow('Transporteur', carrier) : ''}
            ${trackingNumber ? infoRow('Numéro de suivi', trackingNumber) : ''}
            ${estimatedDelivery ? infoRow('Livraison estimée', estimatedDelivery) : ''}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', '📱', 'Activation facile', 'Dès réception, suivez le guide d\'activation pour réactiver votre ligne en quelques minutes.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Guide d\'activation →', activationGuideUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Nouvelle SIM expédiée! - Nivra Télécom',
    `${clientName}, votre nouvelle carte SIM est en route`,
    content
  );
};
