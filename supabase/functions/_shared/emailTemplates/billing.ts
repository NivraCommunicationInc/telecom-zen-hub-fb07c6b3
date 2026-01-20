// ============================================================
// NIVRA TELECOM - BILLING & PAYMENT TEMPLATES (CRITICAL)
// Templates for invoices, payments, and billing events
// ============================================================

import { 
  emailDocument, header, statusBanner, contentWrapper, 
  footer, button, sectionHeader, helpSection, alertBox, infoRow, amountBox, divider,
  colors, escapeHtml, formatCurrencySimple, formatDate
} from './components.ts';

interface BaseParams {
  supportEmail: string;
}

interface Service {
  name: string;
  price: number;
  period?: string;
}

// 1. Facture mensuelle disponible
export const monthlyInvoice = (params: BaseParams & {
  clientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  services: Service[];
  subtotal: number;
  tpsAmount: number;
  tvqAmount: number;
  totalAmount: number;
  pdfUrl?: string;
  paymentUrl?: string;
  portalUrl?: string;
}): string => {
  const { clientName, invoiceNumber, invoiceDate, dueDate, services, subtotal, tpsAmount, tvqAmount, totalAmount, pdfUrl, paymentUrl, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const servicesHtml = services.map(s => `
    <tr style="border-bottom: 1px solid ${colors.gray200};">
      <td style="padding: 12px 0; color: ${colors.gray900}; font-size: 14px;">${escapeHtml(s.name)}</td>
      <td style="padding: 12px 0; color: ${colors.gray900}; font-size: 14px; font-weight: 600; text-align: right;">${formatCurrencySimple(s.price)}/${s.period || 'mois'}</td>
    </tr>
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner('info', '📄', 'Nouvelle facture', `#${invoiceNumber}`)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre facture mensuelle est maintenant disponible.
      </p>
      
      ${sectionHeader('Informations', 'primary')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Numéro de facture', invoiceNumber)}
            ${infoRow('Date de facture', invoiceDate)}
            ${infoRow('Date d\'échéance', dueDate)}
          </tbody>
        </table>
      </div>
      
      ${sectionHeader('Détail des services', 'primary')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; padding: 0 20px;">
          <tbody>
            ${servicesHtml}
            <tr style="border-bottom: 1px solid ${colors.gray200};">
              <td style="padding: 12px 0; color: ${colors.gray500}; font-size: 14px;">Sous-total</td>
              <td style="padding: 12px 0; color: ${colors.gray900}; font-size: 14px; text-align: right;">${formatCurrencySimple(subtotal)}</td>
            </tr>
            <tr style="border-bottom: 1px solid ${colors.gray200};">
              <td style="padding: 12px 0; color: ${colors.gray500}; font-size: 14px;">TPS (5%)</td>
              <td style="padding: 12px 0; color: ${colors.gray900}; font-size: 14px; text-align: right;">${formatCurrencySimple(tpsAmount)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: ${colors.gray500}; font-size: 14px;">TVQ (9.975%)</td>
              <td style="padding: 12px 0; color: ${colors.gray900}; font-size: 14px; text-align: right;">${formatCurrencySimple(tvqAmount)}</td>
            </tr>
          </tbody>
        </table>
        ${amountBox('Total à payer', formatCurrencySimple(totalAmount), 'Avant le ' + dueDate, 'primary')}
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${paymentUrl ? button('Payer maintenant →', paymentUrl, 'success') : ''}
        ${pdfUrl ? `<div style="margin-top: 16px;"><a href="${pdfUrl}" style="color: ${colors.primary}; font-size: 14px; text-decoration: underline;">Télécharger le PDF</a></div>` : ''}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Facture #${invoiceNumber} - Nivra Télécom`,
    `${clientName}, votre facture de ${formatCurrencySimple(totalAmount)} est disponible`,
    content
  );
};

// 2. Reçu de paiement
export const paymentReceipt = (params: BaseParams & {
  clientName: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  invoiceNumber?: string;
  transactionId?: string;
  portalUrl?: string;
}): string => {
  const { clientName, paymentDate, amount, paymentMethod, invoiceNumber, transactionId, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '✓', 'Paiement reçu', 'Merci!')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons bien reçu votre paiement. Merci!
      </p>
      
      <div style="background-color: ${colors.successLight}; border: 2px solid ${colors.success}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.gray500}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Montant payé</p>
        <p style="color: ${colors.successText}; font-size: 36px; font-weight: 800; margin: 0;">${formatCurrencySimple(amount)}</p>
      </div>
      
      ${sectionHeader('Détails du paiement', 'success')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Date', paymentDate)}
            ${infoRow('Montant', formatCurrencySimple(amount))}
            ${infoRow('Mode de paiement', paymentMethod)}
            ${invoiceNumber ? infoRow('Facture', invoiceNumber) : ''}
            ${transactionId ? infoRow('Transaction', transactionId) : ''}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir mon compte →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Reçu de paiement - Nivra Télécom',
    `${clientName}, merci pour votre paiement de ${formatCurrencySimple(amount)}`,
    content
  );
};

// 3. Paiement préautorisé réussi
export const preauthorizedPaymentSuccess = (params: BaseParams & {
  clientName: string;
  paymentDate: string;
  amount: number;
  invoiceNumber: string;
  nextPaymentDate?: string;
  portalUrl?: string;
}): string => {
  const { clientName, paymentDate, amount, invoiceNumber, nextPaymentDate, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '💳', 'Prélèvement effectué', 'Paiement automatique')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre paiement préautorisé a été effectué avec succès.
      </p>
      
      ${sectionHeader('Détails', 'success')}
      <div style="background-color: ${colors.successLight}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Montant prélevé', formatCurrencySimple(amount))}
            ${infoRow('Date du prélèvement', paymentDate)}
            ${infoRow('Facture', invoiceNumber)}
            ${nextPaymentDate ? infoRow('Prochain prélèvement', nextPaymentDate) : ''}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir ma facture →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Prélèvement effectué - Nivra Télécom',
    `${clientName}, votre paiement de ${formatCurrencySimple(amount)} a été prélevé`,
    content
  );
};

// 4. Paiement échoué
export const paymentFailed = (params: BaseParams & {
  clientName: string;
  amount: number;
  failureDate: string;
  failureReason?: string;
  retryDate?: string;
  invoiceNumber?: string;
  paymentUrl?: string;
}): string => {
  const { clientName, amount, failureDate, failureReason, retryDate, invoiceNumber, paymentUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('error', '❌', 'Paiement échoué', 'Action requise')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous n'avons pas pu traiter votre paiement. Veuillez mettre à jour vos informations de paiement.
      </p>
      
      ${alertBox('error', '❌', 'Échec du paiement', failureReason || 'Le paiement n\'a pas pu être traité.')}
      
      ${sectionHeader('Détails', 'error')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Montant', formatCurrencySimple(amount))}
            ${infoRow('Date', failureDate)}
            ${invoiceNumber ? infoRow('Facture', invoiceNumber) : ''}
            ${retryDate ? infoRow('Nouvelle tentative', retryDate) : ''}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Mettre à jour mon paiement →', paymentUrl, 'primary')}
      </div>
      
      ${alertBox('warning', '⚠️', 'Important', 'Sans paiement, votre service pourrait être interrompu. Réglez votre solde rapidement pour éviter toute interruption.')}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Paiement échoué - Action requise - Nivra Télécom',
    `${clientName}, votre paiement de ${formatCurrencySimple(amount)} a échoué`,
    content
  );
};

// 5. Nouvelle tentative de prélèvement
export const paymentRetry = (params: BaseParams & {
  clientName: string;
  amount: number;
  retryDate: string;
  invoiceNumber?: string;
  paymentUrl?: string;
}): string => {
  const { clientName, amount, retryDate, invoiceNumber, paymentUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('warning', '🔄', 'Nouvelle tentative', 'Prélèvement automatique')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Une nouvelle tentative de prélèvement sera effectuée prochainement.
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.warningLight} 0%, #fef3c7 100%); border: 2px solid ${colors.warning}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.warningText}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Prélèvement prévu le</p>
        <p style="color: ${colors.gray900}; font-size: 28px; font-weight: 800; margin: 0 0 8px 0;">${escapeHtml(retryDate)}</p>
        <p style="color: ${colors.warningDark}; font-size: 20px; font-weight: 600; margin: 0;">${formatCurrencySimple(amount)}</p>
      </div>
      
      ${alertBox('info', 'ℹ️', 'Assurez-vous que les fonds sont disponibles', 'Veuillez vous assurer que votre compte dispose des fonds nécessaires avant la date de prélèvement.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Payer maintenant →', paymentUrl, 'success')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Nouvelle tentative de prélèvement - Nivra Télécom',
    `${clientName}, nouvelle tentative de prélèvement de ${formatCurrencySimple(amount)} le ${retryDate}`,
    content
  );
};

// 6. Solde en retard
export const overdueBalance = (params: BaseParams & {
  clientName: string;
  overdueAmount: number;
  daysOverdue: number;
  invoiceNumber: string;
  dueDate: string;
  paymentUrl?: string;
}): string => {
  const { clientName, overdueAmount, daysOverdue, invoiceNumber, dueDate, paymentUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('error', '⚠️', 'Solde en retard', `${daysOverdue} jour${daysOverdue > 1 ? 's' : ''} de retard`)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous vous informons que votre facture est en retard de paiement depuis ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''}.
      </p>
      
      <div style="background-color: ${colors.errorLight}; border: 2px solid ${colors.error}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.errorText}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Montant en souffrance</p>
        <p style="color: ${colors.error}; font-size: 36px; font-weight: 800; margin: 0;">${formatCurrencySimple(overdueAmount)}</p>
      </div>
      
      ${sectionHeader('Détails', 'error')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Facture', invoiceNumber)}
            ${infoRow('Échéance initiale', dueDate)}
            ${infoRow('Jours de retard', `${daysOverdue} jour${daysOverdue > 1 ? 's' : ''}`)}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Payer maintenant →', paymentUrl, 'primary')}
      </div>
      
      ${alertBox('warning', '⚠️', 'Évitez l\'interruption de service', 'Sans paiement rapide, votre service pourrait être suspendu. Des frais de retard peuvent également s\'appliquer.')}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Solde en retard - Action requise - Nivra Télécom',
    `${clientName}, votre solde de ${formatCurrencySimple(overdueAmount)} est en retard de ${daysOverdue} jours`,
    content
  );
};

// 7. Avis de suspension imminente
export const suspensionWarning = (params: BaseParams & {
  clientName: string;
  overdueAmount: number;
  suspensionDate: string;
  invoiceNumber: string;
  paymentUrl?: string;
}): string => {
  const { clientName, overdueAmount, suspensionDate, invoiceNumber, paymentUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('error', '🚨', 'Avis de suspension', 'Action immédiate requise')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        <strong>Votre service sera suspendu le ${escapeHtml(suspensionDate)}</strong> si le solde impayé n'est pas réglé.
      </p>
      
      <div style="background-color: ${colors.errorLight}; border: 2px solid ${colors.error}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.error}; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">⚠️ SUSPENSION PRÉVUE LE</p>
        <p style="color: ${colors.gray900}; font-size: 28px; font-weight: 800; margin: 0 0 16px 0;">${escapeHtml(suspensionDate)}</p>
        <p style="color: ${colors.errorText}; font-size: 20px; font-weight: 700; margin: 0;">Solde dû: ${formatCurrencySimple(overdueAmount)}</p>
      </div>
      
      ${sectionHeader('Détails', 'error')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Facture', invoiceNumber)}
            ${infoRow('Montant dû', formatCurrencySimple(overdueAmount))}
            ${infoRow('Date de suspension', suspensionDate)}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Payer immédiatement →', paymentUrl, 'primary')}
      </div>
      
      ${alertBox('error', '🚨', 'Conséquences de la suspension', 'En cas de suspension, vous perdrez temporairement l\'accès à tous vos services. Des frais de réactivation peuvent s\'appliquer.')}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'URGENT: Avis de suspension - Nivra Télécom',
    `${clientName}, votre service sera suspendu le ${suspensionDate} - Action immédiate requise`,
    content
  );
};

// 8. Service suspendu
export const serviceSuspended = (params: BaseParams & {
  clientName: string;
  suspendedDate: string;
  overdueAmount: number;
  invoiceNumber: string;
  paymentUrl?: string;
}): string => {
  const { clientName, suspendedDate, overdueAmount, invoiceNumber, paymentUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('error', '🔴', 'Service suspendu', 'Compte inactif')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre service a été suspendu en raison d'un solde impayé.
      </p>
      
      <div style="background-color: ${colors.errorLight}; border: 2px solid ${colors.error}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.error}; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">🔴 SERVICE SUSPENDU</p>
        <p style="color: ${colors.gray900}; font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">Depuis le ${escapeHtml(suspendedDate)}</p>
        <p style="color: ${colors.errorText}; font-size: 28px; font-weight: 800; margin: 0;">${formatCurrencySimple(overdueAmount)} dû</p>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Réactiver mon service →', paymentUrl, 'primary')}
      </div>
      
      ${alertBox('info', 'ℹ️', 'Comment réactiver', 'Réglez votre solde impayé et votre service sera réactivé dans les 24 heures suivant la réception du paiement.')}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Service suspendu - Nivra Télécom',
    `${clientName}, votre service a été suspendu - Réglez ${formatCurrencySimple(overdueAmount)} pour réactiver`,
    content
  );
};

// 9. Service réactivé
export const serviceReactivated = (params: BaseParams & {
  clientName: string;
  reactivationDate: string;
  portalUrl?: string;
}): string => {
  const { clientName, reactivationDate, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '🟢', 'Service réactivé!', 'Bienvenue de retour')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Excellente nouvelle! Votre service a été réactivé avec succès.
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.successLight} 0%, #d1fae5 100%); border: 2px solid ${colors.success}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.success}; font-size: 48px; margin: 0 0 16px 0;">✓</p>
        <p style="color: ${colors.successText}; font-size: 20px; font-weight: 700; margin: 0;">Service actif</p>
        <p style="color: ${colors.gray500}; font-size: 14px; margin: 8px 0 0 0;">Réactivé le ${escapeHtml(reactivationDate)}</p>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon portail →', portalUrl, 'success')}
      </div>
      
      ${alertBox('info', '💡', 'Conseil', 'Activez le paiement préautorisé pour éviter les interruptions de service à l\'avenir et bénéficier d\'un rabais!')}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Service réactivé! - Nivra Télécom',
    `${clientName}, votre service Nivra est de nouveau actif!`,
    content
  );
};

// 10. Crédit appliqué
export const creditApplied = (params: BaseParams & {
  clientName: string;
  creditAmount: number;
  creditReason: string;
  newBalance?: number;
  portalUrl?: string;
}): string => {
  const { clientName, creditAmount, creditReason, newBalance, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '💰', 'Crédit appliqué', 'Bonne nouvelle!')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Un crédit a été appliqué à votre compte.
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.successLight} 0%, #d1fae5 100%); border: 2px solid ${colors.success}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.gray500}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Crédit appliqué</p>
        <p style="color: ${colors.success}; font-size: 36px; font-weight: 800; margin: 0;">+${formatCurrencySimple(creditAmount)}</p>
      </div>
      
      ${sectionHeader('Détails', 'success')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Montant du crédit', formatCurrencySimple(creditAmount))}
            ${infoRow('Raison', creditReason)}
            ${newBalance !== undefined ? infoRow('Nouveau solde', formatCurrencySimple(newBalance)) : ''}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir mon compte →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Crédit appliqué à votre compte - Nivra Télécom',
    `${clientName}, un crédit de ${formatCurrencySimple(creditAmount)} a été appliqué à votre compte`,
    content
  );
};

// 11. Rappel de paiement (avant échéance)
export const paymentReminder = (params: BaseParams & {
  clientName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  paymentUrl?: string;
}): string => {
  const { clientName, invoiceNumber, amount, dueDate, daysUntilDue, paymentUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('warning', '📅', 'Rappel de paiement', `Échéance dans ${daysUntilDue} jour${daysUntilDue > 1 ? 's' : ''}`)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Ceci est un rappel amical que votre facture arrive à échéance bientôt.
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.warningLight} 0%, #fef3c7 100%); border: 2px solid ${colors.warning}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.warningText}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">À payer avant le</p>
        <p style="color: ${colors.gray900}; font-size: 28px; font-weight: 800; margin: 0 0 8px 0;">${escapeHtml(dueDate)}</p>
        <p style="color: ${colors.warningDark}; font-size: 24px; font-weight: 700; margin: 0;">${formatCurrencySimple(amount)}</p>
      </div>
      
      ${sectionHeader('Détails', 'warning')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Facture', invoiceNumber)}
            ${infoRow('Montant', formatCurrencySimple(amount))}
            ${infoRow('Date d\'échéance', dueDate)}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Payer maintenant →', paymentUrl, 'success')}
      </div>
      
      ${alertBox('info', '💡', 'Conseil', 'Activez le paiement préautorisé pour ne plus avoir à vous soucier des échéances!')}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Rappel: Facture ${invoiceNumber} - Échéance ${dueDate}`,
    `${clientName}, votre facture de ${formatCurrencySimple(amount)} est due le ${dueDate}`,
    content
  );
};

// 12. Confirmation de changement de mode de paiement
export const paymentMethodChanged = (params: BaseParams & {
  clientName: string;
  newPaymentMethod: string;
  lastFourDigits?: string;
  changedAt: string;
  portalUrl?: string;
}): string => {
  const { clientName, newPaymentMethod, lastFourDigits, changedAt, portalUrl = 'https://nivratelecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '💳', 'Mode de paiement mis à jour', 'Modification confirmée')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre mode de paiement a été mis à jour avec succès.
      </p>
      
      ${sectionHeader('Nouveau mode de paiement', 'success')}
      <div style="background-color: ${colors.successLight}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Type', newPaymentMethod)}
            ${lastFourDigits ? infoRow('Terminant par', `****${lastFourDigits}`) : ''}
            ${infoRow('Date de modification', changedAt)}
          </tbody>
        </table>
      </div>
      
      ${alertBox('warning', '🔒', 'Sécurité', 'Si vous n\'avez pas effectué cette modification, contactez-nous immédiatement.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir mes paramètres →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Mode de paiement mis à jour - Nivra Télécom',
    `${clientName}, votre mode de paiement a été modifié`,
    content
  );
};
