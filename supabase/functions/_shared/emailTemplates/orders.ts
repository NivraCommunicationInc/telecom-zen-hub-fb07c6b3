// ===========================================================
// NIVRA TELECOM - ORDER & ACTIVATION TEMPLATES
// Templates for orders, shipping, and service activation
// ===========================================================

import { 
  emailDocument, header, statusBanner, contentWrapper, 
  footer, button, sectionHeader, helpSection, alertBox, infoRow, amountBox,
  colors, escapeHtml, formatCurrencySimple, formatDate, formatDateTime
} from './components.ts';

interface BaseParams {
  supportEmail: string;
}

interface Service {
  name: string;
  price: number;
  period?: string;
  details?: string;
}

interface Address {
  street: string;
  city: string;
  province: string;
  postalCode: string;
}

// 1. Confirmation de commande (already implemented in send-order-confirmation)
// Keeping for reference/export

// 2. Suivi de commande
export const orderTracking = (params: BaseParams & {
  clientName: string;
  orderNumber: string;
  status: 'processing' | 'preparing' | 'shipped' | 'delivered';
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  carrier?: string;
  portalUrl?: string;
}): string => {
  const { clientName, orderNumber, status, trackingNumber, trackingUrl, estimatedDelivery, carrier, portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const statusConfig = {
    processing: { icon: '📋', title: 'Commande en traitement', color: 'info' as const },
    preparing: { icon: '📦', title: 'Préparation en cours', color: 'warning' as const },
    shipped: { icon: '🚚', title: 'Expédiée!', color: 'success' as const },
    delivered: { icon: '✅', title: 'Livrée!', color: 'success' as const },
  };
  
  const config = statusConfig[status];
  
  const steps = [
    { label: 'Commande reçue', done: true },
    { label: 'En préparation', done: status !== 'processing' },
    { label: 'Expédiée', done: status === 'shipped' || status === 'delivered' },
    { label: 'Livrée', done: status === 'delivered' },
  ];
  
  const stepsHtml = steps.map((step, i) => `
    <td style="text-align: center; width: 25%;">
      <div style="width: 32px; height: 32px; background-color: ${step.done ? colors.success : colors.gray200}; border-radius: 50%; margin: 0 auto 8px auto; line-height: 32px; color: ${step.done ? colors.white : colors.gray500}; font-weight: 600; font-size: 14px;">
        ${step.done ? '✓' : i + 1}
      </div>
      <p style="color: ${step.done ? colors.gray900 : colors.gray400}; font-size: 12px; margin: 0; font-weight: ${step.done ? '600' : '400'};">${step.label}</p>
    </td>
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner(config.color, config.icon, config.title, `Commande #${orderNumber}`)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      
      <!-- Progress Steps -->
      <div style="background-color: ${colors.gray50}; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            ${stepsHtml}
          </tr>
        </table>
      </div>
      
      ${trackingNumber || estimatedDelivery ? `
        ${sectionHeader('Informations de livraison', 'primary')}
        <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tbody>
              ${carrier ? infoRow('Transporteur', carrier) : ''}
              ${trackingNumber ? infoRow('Numéro de suivi', trackingNumber) : ''}
              ${estimatedDelivery ? infoRow('Livraison estimée', estimatedDelivery) : ''}
            </tbody>
          </table>
        </div>
        
        ${trackingUrl ? `
          <div style="text-align: center; margin-bottom: 24px;">
            ${button('Suivre mon colis →', trackingUrl, 'primary')}
          </div>
        ` : ''}
      ` : ''}
      
      <div style="text-align: center; margin-top: 24px;">
        ${button('Voir ma commande →', portalUrl, 'secondary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Suivi commande #${orderNumber} - ${config.title}`,
    `${clientName}, votre commande est ${status === 'shipped' ? 'en route' : status === 'delivered' ? 'livrée' : 'en cours de traitement'}`,
    content
  );
};

// 3. Confirmation d'expédition SIM / eSIM
export const simShipped = (params: BaseParams & {
  clientName: string;
  orderNumber: string;
  simType: 'physical' | 'esim';
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  carrier?: string;
  deliveryAddress?: Address;
  activationGuideUrl?: string;
}): string => {
  const { clientName, orderNumber, simType, trackingNumber, trackingUrl, estimatedDelivery, carrier, deliveryAddress, activationGuideUrl, supportEmail } = params;
  
  const isEsim = simType === 'esim';
  
  const content = `
    ${header()}
    ${statusBanner('success', isEsim ? '📲' : '📦', isEsim ? 'Votre eSIM est prête!' : 'SIM expédiée!', `Commande #${orderNumber}`)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      
      ${isEsim ? `
        <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
          Excellente nouvelle! Votre eSIM est prête à être installée sur votre appareil. Suivez les instructions ci-dessous pour l'activer.
        </p>
        
        ${alertBox('success', '📱', 'Installation facile', 'Votre eSIM peut être installée en quelques minutes directement depuis votre téléphone.')}
      ` : `
        <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
          Votre carte SIM a été expédiée et est en route vers vous!
        </p>
        
        ${sectionHeader('Informations de livraison', 'primary')}
        <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tbody>
              ${carrier ? infoRow('Transporteur', carrier) : ''}
              ${trackingNumber ? infoRow('Numéro de suivi', trackingNumber) : ''}
              ${estimatedDelivery ? infoRow('Livraison estimée', estimatedDelivery) : ''}
              ${deliveryAddress ? infoRow('Adresse', `${deliveryAddress.street}, ${deliveryAddress.city}`) : ''}
            </tbody>
          </table>
        </div>
        
        ${trackingUrl ? `
          <div style="text-align: center; margin-bottom: 24px;">
            ${button('Suivre mon colis →', trackingUrl, 'primary')}
          </div>
        ` : ''}
      `}
      
      ${activationGuideUrl ? `
        <div style="text-align: center; margin-top: 24px;">
          ${button('Guide d\'activation →', activationGuideUrl, isEsim ? 'primary' : 'secondary')}
        </div>
      ` : ''}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    isEsim ? 'Votre eSIM est prête! - Nivra Télécom' : 'SIM expédiée - Nivra Télécom',
    `${clientName}, ${isEsim ? 'votre eSIM est prête à être installée' : 'votre carte SIM est en route'}`,
    content
  );
};

// 4. Rendez-vous technicien planifié
export const technicianScheduled = (params: BaseParams & {
  clientName: string;
  appointmentDate: string;
  appointmentTime: string;
  technicianName?: string;
  serviceAddress: Address;
  serviceType: string;
  appointmentNumber?: string;
  rescheduleUrl?: string;
  notes?: string;
}): string => {
  const { clientName, appointmentDate, appointmentTime, technicianName, serviceAddress, serviceType, appointmentNumber, rescheduleUrl, notes, supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('purple', '🔧', 'Rendez-vous confirmé', serviceType)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Votre rendez-vous d'installation a été confirmé. Un technicien se rendra chez vous à la date prévue.
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.purpleLight} 0%, #ede9fe 100%); border: 2px solid ${colors.purple}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.gray500}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Date du rendez-vous</p>
        <p style="color: ${colors.gray900}; font-size: 28px; font-weight: 800; margin: 0 0 8px 0;">${escapeHtml(appointmentDate)}</p>
        <p style="color: ${colors.purpleDark}; font-size: 20px; font-weight: 600; margin: 0;">${escapeHtml(appointmentTime)}</p>
      </div>
      
      ${sectionHeader('Détails du rendez-vous', 'purple')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${appointmentNumber ? infoRow('Numéro de RDV', appointmentNumber) : ''}
            ${infoRow('Service', serviceType)}
            ${technicianName ? infoRow('Technicien', technicianName) : ''}
            ${infoRow('Adresse', `${serviceAddress.street}, ${serviceAddress.city}, ${serviceAddress.province} ${serviceAddress.postalCode}`)}
          </tbody>
        </table>
      </div>
      
      ${notes ? alertBox('info', 'ℹ️', 'Notes importantes', notes) : ''}
      
      ${alertBox('warning', '📋', 'Préparation', 'Assurez-vous qu\'un adulte soit présent lors du rendez-vous et que l\'accès aux équipements soit dégagé.')}
      
      ${rescheduleUrl ? `
        <div style="text-align: center; margin-top: 32px;">
          ${button('Modifier le rendez-vous', rescheduleUrl, 'secondary')}
        </div>
      ` : ''}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Rendez-vous confirmé: ${appointmentDate} - Nivra Télécom`,
    `${clientName}, votre rendez-vous d'installation est confirmé pour le ${appointmentDate} à ${appointmentTime}`,
    content
  );
};

// 5. Rappel de rendez-vous (24h avant)
export const appointmentReminder = (params: BaseParams & {
  clientName: string;
  appointmentDate: string;
  appointmentTime: string;
  technicianName?: string;
  serviceAddress: Address;
  serviceType: string;
  appointmentNumber?: string;
  rescheduleUrl?: string;
}): string => {
  const { clientName, appointmentDate, appointmentTime, technicianName, serviceAddress, serviceType, appointmentNumber, rescheduleUrl, supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('warning', '⏰', 'Rappel: Rendez-vous demain!', serviceType)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Ceci est un rappel pour votre rendez-vous d'installation <strong>demain</strong>.
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.warningLight} 0%, #fef3c7 100%); border: 2px solid ${colors.warning}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.warningText}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Demain</p>
        <p style="color: ${colors.gray900}; font-size: 28px; font-weight: 800; margin: 0 0 8px 0;">${escapeHtml(appointmentDate)}</p>
        <p style="color: ${colors.warningDark}; font-size: 20px; font-weight: 600; margin: 0;">${escapeHtml(appointmentTime)}</p>
      </div>
      
      ${sectionHeader('Détails', 'warning')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${appointmentNumber ? infoRow('Numéro de RDV', appointmentNumber) : ''}
            ${technicianName ? infoRow('Technicien', technicianName) : ''}
            ${infoRow('Adresse', `${serviceAddress.street}, ${serviceAddress.city}`)}
          </tbody>
        </table>
      </div>
      
      ${alertBox('info', '✅', 'Checklist', 'Un adulte présent • Accès dégagé aux équipements • Animaux sécurisés')}
      
      ${rescheduleUrl ? `
        <p style="color: ${colors.gray500}; font-size: 14px; text-align: center; margin-top: 24px;">
          Besoin de reporter? <a href="${rescheduleUrl}" style="color: ${colors.primary}; text-decoration: underline;">Modifier le rendez-vous</a>
        </p>
      ` : ''}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Rappel: Rendez-vous demain ${appointmentTime} - Nivra Télécom`,
    `${clientName}, rappel de votre rendez-vous demain à ${appointmentTime}`,
    content
  );
};

// 6. Confirmation d'activation réussie
export const activationSuccess = (params: BaseParams & {
  clientName: string;
  serviceName: string;
  phoneNumber?: string;
  activationDate: string;
  portalUrl?: string;
}): string => {
  const { clientName, serviceName, phoneNumber, activationDate, portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('success', '🎉', 'Service activé!', serviceName)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Excellente nouvelle! Votre service a été activé avec succès. Vous pouvez maintenant en profiter pleinement!
      </p>
      
      ${sectionHeader('Détails de l\'activation', 'success')}
      <div style="background-color: ${colors.successLight}; border: 1px solid ${colors.successBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Service', serviceName)}
            ${phoneNumber ? infoRow('Numéro de téléphone', phoneNumber) : ''}
            ${infoRow('Date d\'activation', activationDate)}
            ${infoRow('Statut', '✅ Actif')}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon portail →', portalUrl, 'success')}
      </div>
      
      ${alertBox('info', '💡', 'Besoin d\'aide?', 'Consultez notre guide de démarrage rapide ou contactez notre support via chat ou tickets.')}
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Service activé! - Nivra Télécom',
    `${clientName}, votre service ${serviceName} est maintenant actif!`,
    content
  );
};

// 7. Guide de démarrage rapide
export const quickStartGuide = (params: BaseParams & {
  clientName: string;
  serviceName: string;
  steps: Array<{ title: string; description: string }>;
  faqUrl?: string;
  portalUrl?: string;
}): string => {
  const { clientName, serviceName, steps, faqUrl = 'https://nivra-telecom.ca/faq', portalUrl = 'https://nivra-telecom.ca/portal', supportEmail } = params;
  
  const stepsHtml = steps.map((step, index) => `
    <tr>
      <td style="padding: 16px; background-color: ${colors.gray50}; border-radius: 12px; margin-bottom: 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="width: 48px; vertical-align: top;">
              <div style="width: 36px; height: 36px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%); border-radius: 50%; text-align: center; line-height: 36px; color: ${colors.white}; font-weight: 700; font-size: 16px;">
                ${index + 1}
              </div>
            </td>
            <td style="padding-left: 16px;">
              <p style="color: ${colors.gray900}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">${escapeHtml(step.title)}</p>
              <p style="color: ${colors.gray500}; font-size: 14px; margin: 0; line-height: 1.5;">${escapeHtml(step.description)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${index < steps.length - 1 ? '<tr><td style="height: 12px;"></td></tr>' : ''}
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner('info', '🚀', 'Guide de démarrage', serviceName)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Voici comment démarrer avec votre nouveau service:
      </p>
      
      ${sectionHeader('Étapes de démarrage', 'primary')}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 24px;">
        <tbody>
          ${stepsHtml}
        </tbody>
      </table>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon portail →', portalUrl, 'primary')}
        <div style="margin-top: 16px;">
          <a href="${faqUrl}" style="color: ${colors.primary}; font-size: 14px; text-decoration: underline;">Consulter la FAQ →</a>
        </div>
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `Guide de démarrage: ${serviceName} - Nivra Télécom`,
    `${clientName}, voici comment démarrer avec ${serviceName}`,
    content
  );
};
