// ============================================================
// NIVRA TELECOM - PORTABILITY TEMPLATES
// Templates for phone number porting
// ============================================================

import { 
  emailDocument, header, statusBanner, contentWrapper, 
  footer, button, sectionHeader, helpSection, alertBox, infoRow,
  colors, escapeHtml
} from './components.ts';

interface BaseParams {
  supportPhone: string;
  supportEmail: string;
}

// 1. Demande de portabilité reçue
export const portingRequestReceived = (params: BaseParams & {
  clientName: string;
  phoneNumber: string;
  currentProvider: string;
  requestDate: string;
  estimatedCompletion?: string;
  portalUrl?: string;
}): string => {
  const { clientName, phoneNumber, currentProvider, requestDate, estimatedCompletion, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('info', '📥', 'Demande de portabilité reçue', 'Transfert de numéro')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons bien reçu votre demande de portabilité. Votre numéro sera bientôt transféré chez Nivra Télécom.
      </p>
      
      ${sectionHeader('Détails de la demande', 'primary')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro à transférer', phoneNumber)}
            ${infoRow('Fournisseur actuel', currentProvider)}
            ${infoRow('Date de demande', requestDate)}
            ${estimatedCompletion ? infoRow('Transfert estimé', estimatedCompletion) : ''}
            ${infoRow('Statut', '🔄 En attente')}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', 'ℹ️', 'Que se passe-t-il maintenant?', 'Nous communiquons avec votre ancien fournisseur pour initier le transfert. Ce processus prend généralement 2-5 jours ouvrables.')}
      
      ${alertBox('warning', '⚠️', 'Important', 'Ne résiliez PAS votre service actuel. La résiliation se fera automatiquement lors du transfert.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Suivre ma demande →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    'Demande de portabilité reçue - Nivra Télécom',
    `${clientName}, votre demande de transfert du ${phoneNumber} a été reçue`,
    content
  );
};

// 2. Portabilité en cours
export const portingInProgress = (params: BaseParams & {
  clientName: string;
  phoneNumber: string;
  currentProvider: string;
  estimatedCompletion: string;
  portalUrl?: string;
}): string => {
  const { clientName, phoneNumber, currentProvider, estimatedCompletion, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('warning', '🔄', 'Portabilité en cours', 'Transfert de numéro')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonne nouvelle! Le transfert de votre numéro est maintenant en cours.
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.warningLight} 0%, #fef3c7 100%); border: 2px solid ${colors.warning}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.gray500}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Numéro en transfert</p>
        <p style="color: ${colors.gray900}; font-size: 28px; font-weight: 800; margin: 0 0 16px 0; letter-spacing: 2px;">${escapeHtml(phoneNumber)}</p>
        <p style="color: ${colors.warningText}; font-size: 14px; margin: 0;">Transfert prévu: <strong>${escapeHtml(estimatedCompletion)}</strong></p>
      </div>
      
      ${sectionHeader('Détails', 'warning')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('De', currentProvider)}
            ${infoRow('Vers', 'Nivra Télécom')}
            ${infoRow('Statut', '🔄 En cours de transfert')}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', '📱', 'Pendant le transfert', 'Votre service actuel reste fonctionnel jusqu\'à la fin du transfert. Une brève interruption (quelques minutes) peut survenir lors de la bascule.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Suivre le transfert →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    'Portabilité en cours - Nivra Télécom',
    `${clientName}, le transfert de votre numéro ${phoneNumber} est en cours`,
    content
  );
};

// 3. Portabilité approuvée
export const portingApproved = (params: BaseParams & {
  clientName: string;
  phoneNumber: string;
  transferDate: string;
  portalUrl?: string;
}): string => {
  const { clientName, phoneNumber, transferDate, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '✓', 'Portabilité approuvée!', 'Transfert confirmé')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Excellente nouvelle! Votre demande de portabilité a été approuvée par votre ancien fournisseur.
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.successLight} 0%, #d1fae5 100%); border: 2px solid ${colors.success}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.successText}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Date de transfert confirmée</p>
        <p style="color: ${colors.gray900}; font-size: 28px; font-weight: 800; margin: 0;">${escapeHtml(transferDate)}</p>
      </div>
      
      ${sectionHeader('Votre numéro', 'success')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro', phoneNumber)}
            ${infoRow('Date de transfert', transferDate)}
            ${infoRow('Statut', '✅ Approuvé')}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', '📱', 'Préparez votre téléphone', 'Le jour du transfert, votre nouvelle carte SIM Nivra deviendra active. Assurez-vous de l\'avoir insérée dans votre appareil.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir les détails →', portalUrl, 'success')}
      </div>
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    'Portabilité approuvée! - Nivra Télécom',
    `${clientName}, votre transfert du ${phoneNumber} est confirmé pour le ${transferDate}`,
    content
  );
};

// 4. Portabilité complétée
export const portingCompleted = (params: BaseParams & {
  clientName: string;
  phoneNumber: string;
  completionDate: string;
  portalUrl?: string;
}): string => {
  const { clientName, phoneNumber, completionDate, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '🎉', 'Portabilité complétée!', 'Bienvenue chez Nivra')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Félicitations! Votre numéro a été transféré avec succès chez Nivra Télécom. Vous pouvez maintenant profiter de tous nos services!
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.successLight} 0%, #d1fae5 100%); border: 2px solid ${colors.success}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.successText}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Votre numéro Nivra</p>
        <p style="color: ${colors.gray900}; font-size: 32px; font-weight: 800; margin: 0; letter-spacing: 2px;">${escapeHtml(phoneNumber)}</p>
      </div>
      
      ${sectionHeader('Détails du transfert', 'success')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro', phoneNumber)}
            ${infoRow('Date de complétion', completionDate)}
            ${infoRow('Statut', '✅ Actif chez Nivra')}
          </tbody>
        </table>
      </div>
      
      ${alertBox('success', '📱', 'Votre service est prêt', 'Vous pouvez maintenant passer des appels, envoyer des textos et utiliser vos données avec votre forfait Nivra.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon portail →', portalUrl, 'success')}
      </div>
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    'Portabilité complétée! - Nivra Télécom',
    `${clientName}, votre numéro ${phoneNumber} est maintenant actif chez Nivra!`,
    content
  );
};

// 5. Problème de portabilité (documents requis)
export const portingIssue = (params: BaseParams & {
  clientName: string;
  phoneNumber: string;
  issueDescription: string;
  requiredDocuments?: string[];
  uploadUrl?: string;
  portalUrl?: string;
}): string => {
  const { clientName, phoneNumber, issueDescription, requiredDocuments = [], uploadUrl, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const docsHtml = requiredDocuments.map(doc => `
    <tr>
      <td style="padding: 8px 0;">
        <span style="color: ${colors.error}; margin-right: 8px;">•</span>
        <span style="color: ${colors.gray700}; font-size: 14px;">${escapeHtml(doc)}</span>
      </td>
    </tr>
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner('error', '⚠️', 'Action requise', 'Portabilité en attente')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons rencontré un problème avec votre demande de portabilité pour le numéro <strong>${escapeHtml(phoneNumber)}</strong>.
      </p>
      
      ${alertBox('error', '❌', 'Problème identifié', issueDescription)}
      
      ${requiredDocuments.length > 0 ? `
        ${sectionHeader('Documents requis', 'error')}
        <div style="background-color: ${colors.errorLight}; border: 1px solid ${colors.errorBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="color: ${colors.errorText}; font-size: 14px; margin: 0 0 12px 0;">Veuillez nous fournir les documents suivants:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tbody>
              ${docsHtml}
            </tbody>
          </table>
        </div>
      ` : ''}
      
      <div style="text-align: center; margin-top: 32px;">
        ${uploadUrl ? button('Soumettre les documents →', uploadUrl, 'primary') : button('Contacter le support →', portalUrl, 'primary')}
      </div>
      
      ${alertBox('warning', '⏰', 'Délai de réponse', 'Veuillez nous fournir les informations demandées dans les 5 jours ouvrables pour éviter l\'annulation de votre demande.')}
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    'Action requise pour votre portabilité - Nivra Télécom',
    `${clientName}, action requise pour le transfert de votre numéro ${phoneNumber}`,
    content
  );
};
