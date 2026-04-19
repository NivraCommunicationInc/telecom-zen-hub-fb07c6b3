// ============================================================
// NIVRA TELECOM - ONBOARDING TEMPLATES
// Templates for account creation and welcome
// ============================================================

import { 
  emailDocument, header, statusBanner, contentWrapper, 
  footer, button, sectionHeader, helpSection, alertBox, infoRow,
  colors, escapeHtml, formatCurrencySimple
} from './components.ts';

interface BaseParams {
  supportEmail: string;
}

// 1. Confirmation de création de compte
export const accountCreated = (params: BaseParams & {
  clientName: string;
  clientEmail: string;
  accountNumber?: string;
  portalUrl?: string;
}): string => {
  const { clientName, clientEmail, accountNumber, portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '✓', 'Compte créé avec succès!', `Bienvenue ${clientName}`)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre compte Nivra Télécom a été créé avec succès! Voici vos informations:
      </p>
      
      ${sectionHeader('Informations du compte', 'primary')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Email', clientEmail)}
            ${accountNumber ? infoRow('Numéro de compte', accountNumber) : ''}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon portail →', portalUrl, 'primary')}
      </div>
      
      ${alertBox('info', '💡', 'Prochaines étapes', 'Vous pouvez maintenant commander vos services et gérer votre compte depuis votre portail client.')}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Votre compte Nivra a été créé',
    `${clientName}, bienvenue chez Nivra Télécom! Votre compte est prêt.`,
    content
  );
};

// 2. Vérification d'email (OTP)
export const emailVerificationOtp = (params: BaseParams & {
  clientName?: string;
  otpCode: string;
  expiresInMinutes?: number;
}): string => {
  const { clientName, otpCode, expiresInMinutes = 10, supportEmail } = params;
  const name = clientName || 'Cher client';
  
  const content = `
    ${header()}
    ${statusBanner('info', '🔐', 'Vérification de votre email', 'Code de sécurité')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(name)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Voici votre code de vérification pour confirmer votre adresse email:
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.navy} 0%, ${colors.navyLight} 100%); border-radius: 16px; padding: 40px; text-align: center; margin: 32px 0;">
        <p style="color: ${colors.gray400}; font-size: 14px; font-weight: 500; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">Votre code</p>
        <p style="color: ${colors.white}; font-size: 48px; font-weight: 800; margin: 0; letter-spacing: 12px; font-family: monospace;">${escapeHtml(otpCode)}</p>
      </div>
      
      ${alertBox('warning', '⏰', `Code valide ${expiresInMinutes} minutes`, 'Ce code expirera bientôt. Si vous n\'avez pas demandé ce code, ignorez cet email.')}
      
      <p style="color: ${colors.gray500}; font-size: 14px; text-align: center; margin-top: 24px;">
        Pour votre sécurité, ne partagez jamais ce code avec personne.
      </p>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Votre code de vérification - Nivra Télécom',
    `Votre code de vérification Nivra est: ${otpCode}`,
    content
  );
};

// 3. Vérification d'email (lien)
export const emailVerificationLink = (params: BaseParams & {
  clientName?: string;
  verificationUrl: string;
  expiresInHours?: number;
}): string => {
  const { clientName, verificationUrl, expiresInHours = 24, supportEmail } = params;
  const name = clientName || 'Cher client';
  
  const content = `
    ${header()}
    ${statusBanner('info', '✉️', 'Confirmez votre email', 'Une dernière étape')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(name)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte Nivra Télécom.
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        ${button('Confirmer mon email →', verificationUrl, 'primary')}
      </div>
      
      <p style="color: ${colors.gray500}; font-size: 13px; text-align: center; margin-top: 24px;">
        Ou copiez ce lien dans votre navigateur:<br>
        <a href="${verificationUrl}" style="color: ${colors.primary}; word-break: break-all;">${verificationUrl}</a>
      </p>
      
      ${alertBox('info', 'ℹ️', `Lien valide ${expiresInHours} heures`, 'Si vous n\'avez pas créé de compte, ignorez simplement cet email.')}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Confirmez votre email - Nivra Télécom',
    `${name}, confirmez votre adresse email pour activer votre compte Nivra`,
    content
  );
};

// 4. Bienvenue chez Nivra Telecom
export const welcomeToNivra = (params: BaseParams & {
  clientName: string;
  accountNumber?: string;
  portalUrl?: string;
}): string => {
  const { clientName, accountNumber, portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '🎉', 'Bienvenue chez Nivra!', 'Nous sommes ravis de vous compter parmi nous')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bienvenue dans la famille Nivra Télécom! Nous sommes ravis de vous avoir comme client.
      </p>
      
      ${sectionHeader('Ce que vous pouvez faire maintenant', 'primary')}
      
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px; background-color: ${colors.gray50}; border-radius: 12px; margin-bottom: 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
              <tr>
                <td style="width: 40px; vertical-align: top;">
                  <span style="font-size: 24px;">📱</span>
                </td>
                <td style="padding-left: 16px;">
                  <p style="color: ${colors.gray900}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Gérer vos services</p>
                  <p style="color: ${colors.gray500}; font-size: 14px; margin: 0;">Consultez vos forfaits, options et consommation.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height: 12px;"></td></tr>
        <tr>
          <td style="padding: 16px; background-color: ${colors.gray50}; border-radius: 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
              <tr>
                <td style="width: 40px; vertical-align: top;">
                  <span style="font-size: 24px;">💳</span>
                </td>
                <td style="padding-left: 16px;">
                  <p style="color: ${colors.gray900}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Consulter vos factures</p>
                  <p style="color: ${colors.gray500}; font-size: 14px; margin: 0;">Accédez à votre historique de facturation.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height: 12px;"></td></tr>
        <tr>
          <td style="padding: 16px; background-color: ${colors.gray50}; border-radius: 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
              <tr>
                <td style="width: 40px; vertical-align: top;">
                  <span style="font-size: 24px;">🎧</span>
                </td>
                <td style="padding-left: 16px;">
                  <p style="color: ${colors.gray900}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Contacter le support</p>
                  <p style="color: ${colors.gray500}; font-size: 14px; margin: 0;">Notre équipe est là pour vous aider via chat ou tickets.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon portail →', portalUrl, 'primary')}
      </div>
      
      <p style="color: ${colors.gray500}; font-size: 14px; text-align: center; margin-top: 24px;">
        Merci de faire confiance à Nivra Télécom!
      </p>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Bienvenue chez Nivra Télécom!',
    `${clientName}, bienvenue dans la famille Nivra! Votre compte est prêt.`,
    content
  );
};

// 5. Récapitulatif du plan choisi
export const planSummary = (params: BaseParams & {
  clientName: string;
  planName: string;
  planDetails: string;
  monthlyPrice: number;
  features: string[];
  startDate?: string;
  portalUrl?: string;
}): string => {
  const { clientName, planName, planDetails, monthlyPrice, features, startDate, portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const featuresHtml = features.map(f => `
    <tr>
      <td style="padding: 8px 0;">
        <span style="color: ${colors.success}; margin-right: 8px;">✓</span>
        <span style="color: ${colors.gray700}; font-size: 14px;">${escapeHtml(f)}</span>
      </td>
    </tr>
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner('success', '📋', 'Votre forfait', planName)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Voici le récapitulatif de votre forfait:
      </p>
      
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <div style="padding: 24px;">
          <h3 style="color: ${colors.gray900}; font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">${escapeHtml(planName)}</h3>
          <p style="color: ${colors.gray500}; font-size: 14px; margin: 0 0 16px 0;">${escapeHtml(planDetails)}</p>
          
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tbody>
              ${featuresHtml}
            </tbody>
          </table>
        </div>
        
        <div style="background: linear-gradient(135deg, ${colors.navy} 0%, ${colors.navyLight} 100%); padding: 20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td>
                <p style="color: ${colors.gray400}; font-size: 13px; margin: 0;">Prix mensuel</p>
                ${startDate ? `<p style="color: ${colors.white}; font-size: 12px; margin: 4px 0 0 0;">Actif depuis le ${escapeHtml(startDate)}</p>` : ''}
              </td>
              <td style="text-align: right;">
                <span style="color: ${colors.accent}; font-size: 28px; font-weight: 800;">${formatCurrencySimple(monthlyPrice)}</span>
                <span style="color: ${colors.gray400}; font-size: 14px;">/mois</span>
              </td>
            </tr>
          </table>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir mes services →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Récapitulatif: ${planName} - Nivra Télécom`,
    `${clientName}, voici le récapitulatif de votre forfait ${planName}`,
    content
  );
};

// 6. Acceptation des conditions générales
export const termsAccepted = (params: BaseParams & {
  clientName: string;
  acceptedAt: string;
  termsVersion?: string;
  termsUrl?: string;
}): string => {
  const { clientName, acceptedAt, termsVersion = '1.0', termsUrl = 'https://nivra-telecom.ca/terms', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '✓', 'Conditions acceptées', 'Merci pour votre confiance')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Vous avez accepté les conditions générales d'utilisation de Nivra Télécom.
      </p>
      
      ${sectionHeader('Détails', 'primary')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Date d\'acceptation', acceptedAt)}
            ${infoRow('Version', termsVersion)}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 24px;">
        <a href="${termsUrl}" style="color: ${colors.primary}; font-size: 14px; text-decoration: underline;">Consulter les conditions générales →</a>
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Conditions générales acceptées - Nivra Télécom',
    `${clientName}, vous avez accepté les conditions générales de Nivra Télécom`,
    content
  );
};

// 7. Mandat de paiement préautorisé confirmé
export const preauthorizedPaymentConfirmed = (params: BaseParams & {
  clientName: string;
  paymentMethod: string;
  lastFourDigits?: string;
  billingDay?: number;
  monthlyAmount?: number;
  portalUrl?: string;
}): string => {
  const { clientName, paymentMethod, lastFourDigits, billingDay, monthlyAmount, portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '💳', 'Paiement préautorisé activé', 'Votre mandat est en place')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre mandat de paiement préautorisé a été configuré avec succès. Vos factures seront maintenant payées automatiquement.
      </p>
      
      ${sectionHeader('Détails du mandat', 'success')}
      <div style="background-color: ${colors.successLight}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Mode de paiement', paymentMethod)}
            ${lastFourDigits ? infoRow('Terminant par', `****${lastFourDigits}`) : ''}
            ${billingDay ? infoRow('Jour de prélèvement', `Le ${billingDay} de chaque mois`) : ''}
            ${monthlyAmount ? infoRow('Montant estimé', formatCurrencySimple(monthlyAmount) + '/mois') : ''}
          </tbody>
        </table>
      </div>
      
      ${alertBox('success', '🎁', 'Avantage préautorisé', 'Vous bénéficiez d\'un rabais automatique sur vos factures grâce au paiement préautorisé!')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Gérer mes paiements →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Paiement préautorisé confirmé - Nivra Télécom',
    `${clientName}, votre paiement préautorisé est maintenant actif`,
    content
  );
};

// ============================================================
// EMPLOYEE WELCOME — Onboarding for new staff (RH portal access)
// ============================================================
export const employeeWelcome = (params: BaseParams & {
  employeeName: string;
  employeeEmail: string;
  jobTitle?: string;
  department?: string;
  hireDate?: string;
  hasEmployeePortal?: boolean;
  rhUrl?: string;
  employeeUrl?: string;
  /** Magic link or invitation link to set password and access /rh */
  setupLink?: string;
}): { subject: string; html: string } => {
  const {
    employeeName,
    employeeEmail,
    jobTitle,
    department,
    hireDate,
    hasEmployeePortal = false,
    rhUrl = 'https://nivra-telecom.ca/rh',
    employeeUrl = 'https://nivra-telecom.ca/employee',
    setupLink,
    supportEmail,
  } = params;

  const subject = "Bienvenue chez Nivra — Accès à votre espace employé";

  const formattedHireDate = hireDate
    ? new Date(hireDate).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const content = `
    ${header()}
    ${statusBanner('purple', '🎉', 'BIENVENUE', 'Bienvenue dans l\u2019équipe Nivra')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0;">
        Bonjour ${escapeHtml(employeeName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre espace employé est prêt. Utilisez les identifiants ci-dessous pour accéder à tous vos portails Nivra.
      </p>

      ${sectionHeader('Vos informations', 'purple')}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: ${colors.gray50}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <tr><td>
          ${infoRow('Nom', employeeName)}
          ${jobTitle ? infoRow('Poste', jobTitle) : ''}
          ${department ? infoRow('Département', department) : ''}
          ${infoRow('Date de début', formattedHireDate)}
          ${infoRow('Email de connexion', employeeEmail)}
        </td></tr>
      </table>

      ${setupLink ? `
      ${alertBox('success', '🔐 Activez votre compte',
        'Cliquez sur le bouton ci-dessous pour configurer votre mot de passe et accéder à votre portail RH immédiatement. Ce lien est personnel — ne le partagez avec personne.')}

      <div style="text-align: center; margin-top: 24px; margin-bottom: 16px;">
        ${button('Activer mon compte et configurer mon mot de passe →', setupLink, 'primary')}
      </div>

      <p style="color: ${colors.gray500}; font-size: 13px; text-align: center; margin: 0 0 24px 0;">
        Ou copiez ce lien dans votre navigateur:<br>
        <a href="${setupLink}" style="color: ${colors.primary}; word-break: break-all; font-size: 12px;">${setupLink}</a>
      </p>
      ` : `
      ${alertBox('info', 'Première connexion',
        'Vous recevrez sous peu un courriel séparé contenant un lien magique pour configurer votre compte (mot de passe, NIP, MFA si requis). Conservez cet email comme référence pour vos accès.')}
      `}

      <div style="text-align: center; margin-top: 32px;">
        ${button(setupLink ? 'Voir mon espace RH' : 'Accéder à mon espace RH →', rhUrl, setupLink ? 'secondary' : 'primary')}
      </div>

      ${hasEmployeePortal ? `
      <div style="text-align: center; margin-top: 16px;">
        ${button('Accéder à Nivra Employee →', employeeUrl, 'secondary')}
      </div>` : ''}

      <p style="color: ${colors.gray500}; font-size: 14px; line-height: 1.6; margin: 32px 0 0 0;">
        Utilisez ces identifiants pour accéder à tous vos portails Nivra (RH, Employee, Field selon votre rôle). Pour toute question, contactez l\u2019équipe RH à
        <a href="mailto:${supportEmail}" style="color: ${colors.primary};">${supportEmail}</a>.
      </p>

      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;

  return {
    subject,
    html: emailDocument(
      subject,
      `${employeeName}, votre espace employé Nivra est prêt.`,
      content
    ),
  };
};
