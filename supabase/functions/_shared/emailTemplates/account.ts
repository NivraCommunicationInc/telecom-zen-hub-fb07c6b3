// ============================================================
// NIVRA TELECOM - ACCOUNT & SECURITY TEMPLATES
// Templates for account management, security, and lifecycle
// ============================================================

import { 
  emailDocument, header, statusBanner, contentWrapper, 
  footer, button, sectionHeader, helpSection, alertBox, infoRow,
  colors, escapeHtml, formatCurrencySimple
} from './components.ts';

interface BaseParams {
  supportEmail: string;
}

// 1. Compte bloqué
export const accountBlocked = (params: BaseParams & {
  clientName: string;
  blockReason: string;
  blockedAt: string;
  contactUrl?: string;
}): string => {
  const { clientName, blockReason, blockedAt, contactUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('error', '🔒', 'Compte bloqué', 'Action requise')}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous vous informons que votre compte Nivra Télécom a été temporairement bloqué.
      </p>
      
      ${alertBox('error', '🔒', 'Raison du blocage', blockReason)}
      
      ${sectionHeader('Informations', 'error')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Date de blocage', blockedAt)}
            ${infoRow('Statut', '🔒 Bloqué')}
          </tbody>
        </table>
      </div>
      
      <p style="color: ${colors.textSecondary}; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
        Pour débloquer votre compte, veuillez contacter notre équipe de support. Nous traiterons votre demande dans les plus brefs délais.
      </p>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Contacter le support →', contactUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Compte bloqué - Action requise - Nivra Télécom',
    `${clientName}, votre compte a été temporairement bloqué`,
    content
  );
};

// 2. Compte débloqué
export const accountUnblocked = (params: BaseParams & {
  clientName: string;
  unblockedAt: string;
  portalUrl?: string;
}): string => {
  const { clientName, unblockedAt, portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '🔓', 'Compte débloqué!', 'Accès restauré')}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Excellente nouvelle! Votre compte Nivra Télécom a été débloqué avec succès. Vous pouvez maintenant accéder à tous vos services.
      </p>
      
      ${sectionHeader('Détails', 'success')}
      <div style="background-color: ${colors.successBg}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Date de déblocage', unblockedAt)}
            ${infoRow('Statut', '✅ Actif')}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon compte →', portalUrl, 'success')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Compte débloqué! - Nivra Télécom',
    `${clientName}, votre compte a été débloqué avec succès`,
    content
  );
};

// 3. Accès en ligne bloqué
export const onlineAccessBlocked = (params: BaseParams & {
  clientName: string;
  blockReason: string;
  blockedAt: string;
  contactUrl?: string;
}): string => {
  const { clientName, blockReason, blockedAt, contactUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('warning', '🔐', 'Accès en ligne bloqué', 'Sécurité')}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Par mesure de sécurité, l'accès à votre portail en ligne a été temporairement suspendu.
      </p>
      
      ${alertBox('warning', '🔐', 'Raison', blockReason)}
      
      ${sectionHeader('Informations', 'warning')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Date', blockedAt)}
            ${infoRow('Vos services', '✅ Toujours actifs')}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', 'ℹ️', 'Vos services restent actifs', 'Seul l\'accès au portail en ligne est bloqué. Vos services de téléphonie et internet fonctionnent normalement.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Contacter le support →', contactUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Accès en ligne bloqué - Nivra Télécom',
    `${clientName}, votre accès au portail a été temporairement bloqué`,
    content
  );
};

// 4. Réinitialisation de mot de passe
export const passwordReset = (params: BaseParams & {
  clientName?: string;
  resetUrl: string;
  expiresInHours?: number;
  requestedAt: string;
}): string => {
  const { clientName, resetUrl, expiresInHours = 24, requestedAt, supportEmail } = params;
  const name = clientName || 'Cher client';
  
  const content = `
    ${header()}
    ${statusBanner('info', '🔑', 'Réinitialisation de mot de passe', 'Demande reçue')}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(name)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte Nivra Télécom.
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        ${button('Réinitialiser mon mot de passe →', resetUrl, 'primary')}
      </div>
      
      <p style="color: ${colors.textMuted}; font-size: 13px; text-align: center; margin-top: 16px;">
        Ou copiez ce lien dans votre navigateur:<br>
        <a href="${resetUrl}" style="color: ${colors.primary}; word-break: break-all; font-size: 12px;">${resetUrl}</a>
      </p>
      
      ${alertBox('warning', '⏰', `Lien valide ${expiresInHours} heures`, 'Ce lien expirera bientôt. Si vous n\'avez pas demandé cette réinitialisation, ignorez cet email et votre mot de passe restera inchangé.')}
      
      ${sectionHeader('Informations', 'primary')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Demande reçue le', requestedAt)}
            ${infoRow('Expire dans', `${expiresInHours} heures`)}
          </tbody>
        </table>
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Réinitialisation de mot de passe - Nivra Télécom',
    `${name}, réinitialisez votre mot de passe Nivra Télécom`,
    content
  );
};

// 5. Mot de passe changé
export const passwordChanged = (params: BaseParams & {
  clientName: string;
  changedAt: string;
  contactUrl?: string;
}): string => {
  const { clientName, changedAt, contactUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '🔐', 'Mot de passe modifié', 'Confirmation')}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre mot de passe Nivra Télécom a été modifié avec succès.
      </p>
      
      ${sectionHeader('Détails', 'success')}
      <div style="background-color: ${colors.successBg}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Modifié le', changedAt)}
            ${infoRow('Statut', '✅ Mot de passe mis à jour')}
          </tbody>
        </table>
      </div>
      
      ${alertBox('warning', '⚠️', 'Ce n\'était pas vous?', 'Si vous n\'avez pas effectué cette modification, contactez immédiatement notre support pour sécuriser votre compte.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Contacter le support →', contactUrl, 'secondary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Mot de passe modifié - Nivra Télécom',
    `${clientName}, votre mot de passe a été modifié avec succès`,
    content
  );
};

// 6. Connexion suspecte
export const suspiciousLogin = (params: BaseParams & {
  clientName: string;
  loginTime: string;
  ipAddress: string;
  location?: string;
  device?: string;
  secureAccountUrl?: string;
}): string => {
  const { clientName, loginTime, ipAddress, location, device, secureAccountUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('warning', '⚠️', 'Connexion inhabituelle détectée', 'Vérification de sécurité')}
    ${contentWrapper(`
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons détecté une connexion à votre compte depuis un appareil ou un emplacement inhabituel.
      </p>
      
      ${alertBox('warning', '⚠️', 'Connexion détectée', 'Si c\'était vous, ignorez cet email. Sinon, sécurisez votre compte immédiatement.')}
      
      ${sectionHeader('Détails de la connexion', 'warning')}
      <div style="background-color: ${colors.warningBg}; border: 1px solid ${colors.warningBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Date et heure', loginTime)}
            ${infoRow('Adresse IP', ipAddress)}
            ${location ? infoRow('Localisation', location) : ''}
            ${device ? infoRow('Appareil', device) : ''}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Sécuriser mon compte →', secureAccountUrl, 'warning')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Alerte de sécurité - Connexion inhabituelle - Nivra Télécom',
    `${clientName}, nous avons détecté une connexion inhabituelle à votre compte`,
    content
  );
};
