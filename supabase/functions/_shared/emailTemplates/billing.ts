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
  supportPhone: string;
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
  const { clientName, invoiceNumber, invoiceDate, dueDate, services, subtotal, tpsAmount, tvqAmount, totalAmount, pdfUrl, paymentUrl, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
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
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
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
  const { clientName, paymentDate, amount, paymentMethod, invoiceNumber, transactionId, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
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
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
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
  const { clientName, paymentDate, amount, invoiceNumber, nextPaymentDate, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
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
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
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
  const { clientName, amount, failureDate, failureReason, retryDate, invoiceNumber, paymentUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
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
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
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
  const { clientName, amount, retryDate, invoiceNumber, paymentUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
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
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
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
  const { clientName, overdueAmount, daysOverdue, invoiceNumber, dueDate, paymentUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
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
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
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
  const { clientName, overdueAmount, suspensionDate, invoiceNumber, paymentUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
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
      
      ${alertBox('error', '🚫', 'Conséquences de la suspension', 'Vous perdrez l\'accès à tous vos services Nivra (appels, textos, données, Internet). Des frais de rétablissement peuvent s\'appliquer.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('⚡ Payer immédiatement →', paymentUrl, 'primary')}
      </div>
      
      <p style="color: ${colors.gray500}; font-size: 14px; text-align: center; margin-top: 24px;">
        Si vous avez des difficultés de paiement, contactez-nous pour discuter d'un arrangement.
      </p>
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    '🚨 Suspension imminente - Nivra Télécom',
    `${clientName}, votre service sera suspendu le ${suspensionDate} sans paiement`,
    content
  );
};

// 8. Suspension de service
export const serviceSuspended = (params: BaseParams & {
  clientName: string;
  overdueAmount: number;
  suspensionDate: string;
  servicesAffected: string[];
  paymentUrl?: string;
}): string => {
  const { clientName, overdueAmount, suspensionDate, servicesAffected, paymentUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const servicesHtml = servicesAffected.map(s => `
    <tr><td style="padding: 6px 0; color: ${colors.gray700}; font-size: 14px;">🚫 ${escapeHtml(s)}</td></tr>
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner('error', '🔴', 'Service suspendu', 'Compte en souffrance')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        En raison d'un solde impayé, votre service a été suspendu le ${escapeHtml(suspensionDate)}.
      </p>
      
      ${sectionHeader('Services suspendus', 'error')}
      <div style="background-color: ${colors.errorLight}; border: 1px solid ${colors.errorBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${servicesHtml}
          </tbody>
        </table>
      </div>
      
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Solde à payer', formatCurrencySimple(overdueAmount))}
            ${infoRow('Date de suspension', suspensionDate)}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Régler mon solde →', paymentUrl, 'success')}
      </div>
      
      ${alertBox('info', 'ℹ️', 'Rétablissement', 'Votre service sera rétabli dans les minutes suivant la réception de votre paiement.')}
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    'Service suspendu - Nivra Télécom',
    `${clientName}, votre service a été suspendu. Solde dû: ${formatCurrencySimple(overdueAmount)}`,
    content
  );
};

// 9. Rétablissement après paiement
export const serviceRestored = (params: BaseParams & {
  clientName: string;
  paymentAmount: number;
  paymentDate: string;
  servicesRestored: string[];
  portalUrl?: string;
}): string => {
  const { clientName, paymentAmount, paymentDate, servicesRestored, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const servicesHtml = servicesRestored.map(s => `
    <tr><td style="padding: 6px 0; color: ${colors.successText}; font-size: 14px;">✅ ${escapeHtml(s)}</td></tr>
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner('success', '✓', 'Service rétabli!', 'Merci pour votre paiement')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons bien reçu votre paiement et votre service a été rétabli!
      </p>
      
      ${sectionHeader('Services rétablis', 'success')}
      <div style="background-color: ${colors.successLight}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${servicesHtml}
          </tbody>
        </table>
      </div>
      
      ${sectionHeader('Paiement reçu', 'success')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Montant', formatCurrencySimple(paymentAmount))}
            ${infoRow('Date', paymentDate)}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon portail →', portalUrl, 'success')}
      </div>
      
      ${alertBox('success', '💡', 'Conseil', 'Activez le paiement préautorisé pour ne plus jamais manquer une échéance et profiter d\'un rabais automatique!')}
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    'Service rétabli! - Nivra Télécom',
    `${clientName}, votre service a été rétabli suite à votre paiement`,
    content
  );
};

// 10. Crédit appliqué
export const creditApplied = (params: BaseParams & {
  clientName: string;
  creditAmount: number;
  reason: string;
  newBalance?: number;
  portalUrl?: string;
}): string => {
  const { clientName, creditAmount, reason, newBalance, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '💰', 'Crédit appliqué', 'Ajustement de compte')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Un crédit a été appliqué à votre compte.
      </p>
      
      <div style="background-color: ${colors.successLight}; border: 2px solid ${colors.success}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.gray500}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Crédit appliqué</p>
        <p style="color: ${colors.successText}; font-size: 36px; font-weight: 800; margin: 0;">-${formatCurrencySimple(creditAmount)}</p>
      </div>
      
      ${sectionHeader('Détails', 'success')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Montant du crédit', formatCurrencySimple(creditAmount))}
            ${infoRow('Raison', reason)}
            ${newBalance !== undefined ? infoRow('Nouveau solde', formatCurrencySimple(newBalance)) : ''}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir mon compte →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    'Crédit appliqué - Nivra Télécom',
    `${clientName}, un crédit de ${formatCurrencySimple(creditAmount)} a été appliqué à votre compte`,
    content
  );
};

// 11. Ajustement de facture
export const invoiceAdjustment = (params: BaseParams & {
  clientName: string;
  invoiceNumber: string;
  originalAmount: number;
  adjustedAmount: number;
  adjustmentReason: string;
  newTotal: number;
  portalUrl?: string;
}): string => {
  const { clientName, invoiceNumber, originalAmount, adjustedAmount, adjustmentReason, newTotal, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const isCredit = adjustedAmount < 0;
  
  const content = `
    ${header()}
    ${statusBanner('info', '📝', 'Ajustement de facture', `Facture #${invoiceNumber}`)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre facture #${escapeHtml(invoiceNumber)} a été ajustée.
      </p>
      
      ${sectionHeader('Détails de l\'ajustement', 'primary')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Montant original', formatCurrencySimple(originalAmount))}
            ${infoRow('Ajustement', (isCredit ? '-' : '+') + formatCurrencySimple(Math.abs(adjustedAmount)))}
            ${infoRow('Raison', adjustmentReason)}
          </tbody>
        </table>
      </div>
      
      ${amountBox('Nouveau total', formatCurrencySimple(newTotal), undefined, isCredit ? 'success' : 'primary')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir ma facture →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    `Ajustement facture #${invoiceNumber} - Nivra Télécom`,
    `${clientName}, votre facture a été ajustée. Nouveau total: ${formatCurrencySimple(newTotal)}`,
    content
  );
};

// 12. Remboursement traité
export const refundProcessed = (params: BaseParams & {
  clientName: string;
  refundAmount: number;
  refundDate: string;
  refundMethod: string;
  refundReason: string;
  transactionId?: string;
  portalUrl?: string;
}): string => {
  const { clientName, refundAmount, refundDate, refundMethod, refundReason, transactionId, portalUrl = 'https://nivratelecom.ca/portal', supportPhone, supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '💸', 'Remboursement traité', 'Votre demande a été acceptée')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre remboursement a été traité avec succès.
      </p>
      
      <div style="background-color: ${colors.successLight}; border: 2px solid ${colors.success}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.gray500}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Montant remboursé</p>
        <p style="color: ${colors.successText}; font-size: 36px; font-weight: 800; margin: 0;">${formatCurrencySimple(refundAmount)}</p>
      </div>
      
      ${sectionHeader('Détails', 'success')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Montant', formatCurrencySimple(refundAmount))}
            ${infoRow('Date', refundDate)}
            ${infoRow('Méthode', refundMethod)}
            ${infoRow('Raison', refundReason)}
            ${transactionId ? infoRow('Transaction', transactionId) : ''}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', 'ℹ️', 'Délai de traitement', 'Le remboursement apparaîtra sur votre relevé dans un délai de 5-10 jours ouvrables selon votre institution financière.')}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Voir mon compte →', portalUrl, 'primary')}
      </div>
      
      ${helpSection(supportPhone, supportEmail)}
    `)}
    ${footer(supportPhone, supportEmail)}
  `;
  
  return emailDocument(
    'Remboursement traité - Nivra Télécom',
    `${clientName}, votre remboursement de ${formatCurrencySimple(refundAmount)} a été traité`,
    content
  );
};
