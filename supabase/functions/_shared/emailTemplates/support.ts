// ============================================================
// NIVRA TELECOM - SUPPORT & TICKET TEMPLATES
// Templates for support tickets and customer service
// ============================================================

import { 
  emailDocument, header, statusBanner, contentWrapper, 
  footer, button, sectionHeader, helpSection, alertBox, infoRow,
  colors, escapeHtml
} from './components.ts';

interface BaseParams {
  supportEmail: string;
}

// 1. Ticket créé
export const ticketCreated = (params: BaseParams & {
  clientName: string;
  ticketNumber: string;
  subject: string;
  category?: string;
  priority?: string;
  createdAt: string;
  portalUrl?: string;
}): string => {
  const { clientName, ticketNumber, subject, category, priority, createdAt, portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const priorityColors: Record<string, { bg: string; text: string }> = {
    'urgent': { bg: colors.errorBg, text: colors.error },
    'high': { bg: colors.warningBg, text: colors.warning },
    'normal': { bg: colors.infoBg, text: colors.info },
    'low': { bg: colors.bgSection, text: colors.textMuted },
  };
  
  const pConfig = priorityColors[priority?.toLowerCase() || 'normal'] || priorityColors.normal;
  
  const content = `
    ${header()}
    ${statusBanner('info', '🎫', 'Ticket créé', `#${ticketNumber}`)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons bien reçu votre demande de support. Un membre de notre équipe vous répondra dans les plus brefs délais.
      </p>
      
      ${sectionHeader('Détails du ticket', 'primary')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro de ticket', ticketNumber)}
            ${infoRow('Sujet', subject)}
            ${category ? infoRow('Catégorie', category) : ''}
            ${priority ? `
              <tr>
                <td style="color: ${colors.textMuted}; font-size: 14px; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">Priorité</td>
                <td style="font-size: 14px; text-align: right; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">
                  <span style="background-color: ${pConfig.bg}; color: ${pConfig.text}; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 12px;">${priority}</span>
                </td>
              </tr>
            ` : ''}
            ${infoRow('Créé le', createdAt)}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', '⏱️', 'Temps de réponse', 'Notre équipe répond généralement dans un délai de 1 à 24 heures ouvrables.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Suivre mon ticket →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Ticket #${ticketNumber} créé - Nivra Télécom`,
    `${clientName}, votre demande de support a été enregistrée`,
    content
  );
};

// 2. Ticket mis à jour
export const ticketUpdated = (params: BaseParams & {
  clientName: string;
  ticketNumber: string;
  subject: string;
  updateMessage: string;
  updatedBy: string;
  updatedAt: string;
  portalUrl?: string;
}): string => {
  const { clientName, ticketNumber, subject, updateMessage, updatedBy, updatedAt, portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('info', '💬', 'Nouvelle réponse', `Ticket #${ticketNumber}`)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Une nouvelle réponse a été ajoutée à votre ticket de support.
      </p>
      
      ${sectionHeader('Ticket', 'primary')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro', ticketNumber)}
            ${infoRow('Sujet', subject)}
          </tbody>
        </table>
      </div>
      
      ${sectionHeader('Nouvelle réponse', 'primary')}
      <div style="background-color: ${colors.infoBg}; border-left: 4px solid ${colors.info}; border-radius: 4px; padding: 20px; margin-bottom: 24px;">
        <p style="color: ${colors.textMuted}; font-size: 12px; margin: 0 0 8px 0;">
          ${escapeHtml(updatedBy)} • ${escapeHtml(updatedAt)}
        </p>
        <p style="color: ${colors.textPrimary}; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${escapeHtml(updateMessage)}</p>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Répondre →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Réponse au ticket #${ticketNumber} - Nivra Télécom`,
    `${clientName}, nouvelle réponse à votre ticket de support`,
    content
  );
};

// 3. Ticket résolu
export const ticketResolved = (params: BaseParams & {
  clientName: string;
  ticketNumber: string;
  subject: string;
  resolution: string;
  resolvedAt: string;
  feedbackUrl?: string;
}): string => {
  const { clientName, ticketNumber, subject, resolution, resolvedAt, feedbackUrl = 'https://nivratelecom.ca/feedback', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '✅', 'Ticket résolu', `#${ticketNumber}`)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons le plaisir de vous informer que votre ticket de support a été résolu.
      </p>
      
      ${sectionHeader('Détails', 'success')}
      <div style="background-color: ${colors.successBg}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro', ticketNumber)}
            ${infoRow('Sujet', subject)}
            ${infoRow('Résolu le', resolvedAt)}
            ${infoRow('Statut', '✅ Résolu')}
          </tbody>
        </table>
      </div>
      
      ${sectionHeader('Résolution', 'success')}
      <div style="background-color: ${colors.bgSection}; border-left: 4px solid ${colors.success}; border-radius: 4px; padding: 20px; margin-bottom: 24px;">
        <p style="color: ${colors.textPrimary}; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${escapeHtml(resolution)}</p>
      </div>
      
      <div style="background-color: ${colors.primaryLight}; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: ${colors.textPrimary}; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Votre avis compte! ⭐</p>
        <p style="color: ${colors.textSecondary}; font-size: 14px; margin: 0 0 16px 0;">Comment était notre service?</p>
        ${button('Donner mon avis', feedbackUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Ticket #${ticketNumber} résolu - Nivra Télécom`,
    `${clientName}, votre ticket de support a été résolu`,
    content
  );
};

// 4. Ticket fermé automatiquement
export const ticketAutoClosed = (params: BaseParams & {
  clientName: string;
  ticketNumber: string;
  subject: string;
  closedAt: string;
  reopenUrl?: string;
}): string => {
  const { clientName, ticketNumber, subject, closedAt, reopenUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('info', '📁', 'Ticket fermé', `#${ticketNumber}`)}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre ticket de support a été automatiquement fermé après 7 jours d'inactivité.
      </p>
      
      ${sectionHeader('Détails', 'primary')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro', ticketNumber)}
            ${infoRow('Sujet', subject)}
            ${infoRow('Fermé le', closedAt)}
            ${infoRow('Statut', '📁 Fermé')}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', 'ℹ️', 'Besoin de rouvrir?', 'Si votre problème n\'est pas résolu, vous pouvez rouvrir ce ticket ou en créer un nouveau.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Rouvrir le ticket →', reopenUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Ticket #${ticketNumber} fermé - Nivra Télécom`,
    `${clientName}, votre ticket de support a été fermé`,
    content
  );
};

// 5. Demande de documents
export const documentRequest = (params: BaseParams & {
  clientName: string;
  ticketNumber?: string;
  requestReason: string;
  requiredDocuments: string[];
  uploadUrl: string;
  deadline?: string;
}): string => {
  const { clientName, ticketNumber, requestReason, requiredDocuments, uploadUrl, deadline, supportEmail } = params;
  
  const docsHtml = requiredDocuments.map(doc => `
    <tr>
      <td style="padding: 8px 0; color: ${colors.textPrimary}; font-size: 14px;">
        <span style="color: ${colors.primary}; margin-right: 12px;">📄</span>
        ${escapeHtml(doc)}
      </td>
    </tr>
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner('warning', '📎', 'Documents requis', 'Action requise')}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Pour traiter votre demande, nous avons besoin de documents supplémentaires.
      </p>
      
      ${alertBox('info', 'ℹ️', 'Raison', requestReason)}
      
      ${sectionHeader('Documents demandés', 'warning')}
      <div style="background-color: ${colors.warningBg}; border: 1px solid ${colors.warningBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${docsHtml}
          </tbody>
        </table>
      </div>
      
      ${deadline ? alertBox('warning', '⏰', 'Date limite', `Veuillez soumettre vos documents avant le ${deadline}.`) : ''}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Téléverser mes documents →', uploadUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Documents requis - Action requise - Nivra Télécom',
    `${clientName}, nous avons besoin de documents pour traiter votre demande`,
    content
  );
};
