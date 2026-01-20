// ============================================================
// NIVRA TELECOM - MARKETING & ACQUISITION TEMPLATES
// Templates for prospection, conversion, and marketing
// ============================================================

import { 
  emailDocument, header, statusBanner, contentWrapper, 
  footer, button, sectionHeader, helpSection, alertBox,
  colors, escapeHtml, formatCurrencySimple
} from './components.ts';

interface BaseParams {
  supportEmail: string;
}

// 1. Invitation : Découvrez Nivra Telecom
export const discoverNivra = (params: BaseParams & {
  recipientName?: string;
}): string => {
  const { recipientName, supportEmail } = params;
  const name = recipientName || 'Cher client';
  
  const content = `
    ${header()}
    ${statusBanner('info', '👋', 'Découvrez Nivra Télécom', 'Le futur de vos télécommunications')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(name)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous sommes ravis de vous présenter <strong>Nivra Télécom</strong>, votre nouveau fournisseur de services de télécommunications prépayés au Québec.
      </p>
      
      ${sectionHeader('Pourquoi choisir Nivra?', 'primary')}
      
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px; background-color: ${colors.gray50}; border-radius: 12px; margin-bottom: 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
              <tr>
                <td style="width: 48px; vertical-align: top;">
                  <div style="width: 40px; height: 40px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%); border-radius: 10px; text-align: center; line-height: 40px;">
                    <span style="font-size: 20px;">📱</span>
                  </div>
                </td>
                <td style="padding-left: 16px;">
                  <p style="color: ${colors.gray900}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Sans contrat</p>
                  <p style="color: ${colors.gray500}; font-size: 14px; margin: 0;">Liberté totale, sans engagement à long terme.</p>
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
                <td style="width: 48px; vertical-align: top;">
                  <div style="width: 40px; height: 40px; background: linear-gradient(135deg, ${colors.success} 0%, ${colors.successDark} 100%); border-radius: 10px; text-align: center; line-height: 40px;">
                    <span style="font-size: 20px;">💰</span>
                  </div>
                </td>
                <td style="padding-left: 16px;">
                  <p style="color: ${colors.gray900}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Prix transparents</p>
                  <p style="color: ${colors.gray500}; font-size: 14px; margin: 0;">Aucuns frais cachés, tout est clair dès le départ.</p>
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
                <td style="width: 48px; vertical-align: top;">
                  <div style="width: 40px; height: 40px; background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%); border-radius: 10px; text-align: center; line-height: 40px;">
                    <span style="font-size: 20px;">🇨🇦</span>
                  </div>
                </td>
                <td style="padding-left: 16px;">
                  <p style="color: ${colors.gray900}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Support local</p>
                  <p style="color: ${colors.gray500}; font-size: 14px; margin: 0;">Équipe québécoise à votre service via chat ou tickets.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Découvrir nos forfaits →', 'https://nivratelecom.ca/mobile', 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Découvrez Nivra Télécom',
    `${name}, découvrez le futur de vos télécommunications avec Nivra`,
    content
  );
};

// 2. Offre de bienvenue — 50% sur la 1re facture
export const welcomeOffer = (params: BaseParams & {
  recipientName?: string;
  discountPercent?: number;
  promoCode?: string;
  expiryDate?: string;
}): string => {
  const { recipientName, discountPercent = 50, promoCode = 'BIENVENUE50', expiryDate, supportEmail } = params;
  const name = recipientName || 'Cher client';
  
  const content = `
    ${header()}
    ${statusBanner('success', '🎉', `${discountPercent}% de rabais!`, 'Offre exclusive de bienvenue')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(name)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Pour vous souhaiter la bienvenue chez Nivra Télécom, nous vous offrons <strong>${discountPercent}% de rabais sur votre première facture</strong>!
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.successLight} 0%, #d1fae5 100%); border: 2px dashed ${colors.success}; border-radius: 16px; padding: 32px; text-align: center; margin: 32px 0;">
        <p style="color: ${colors.gray500}; font-size: 14px; font-weight: 500; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Votre code promo</p>
        <p style="color: ${colors.successText}; font-size: 32px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: 2px;">${escapeHtml(promoCode)}</p>
        ${expiryDate ? `<p style="color: ${colors.gray500}; font-size: 13px; margin: 0;">Valide jusqu'au ${escapeHtml(expiryDate)}</p>` : ''}
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Profiter de l\'offre →', 'https://nivratelecom.ca/contact', 'success')}
      </div>
      
      <p style="color: ${colors.gray500}; font-size: 13px; text-align: center; margin-top: 24px;">
        *Offre applicable sur la première facture mensuelle. Non cumulable avec d'autres promotions.
      </p>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `${discountPercent}% de rabais - Offre de bienvenue Nivra`,
    `${name}, profitez de ${discountPercent}% de rabais avec le code ${promoCode}`,
    content
  );
};

// 3. Campagne saisonnière (Black Friday, Rentrée, Fêtes)
export const seasonalCampaign = (params: BaseParams & {
  recipientName?: string;
  campaignTitle: string;
  campaignSubtitle: string;
  bannerIcon?: string;
  offerTitle: string;
  offerDescription: string;
  promoCode?: string;
  expiryDate?: string;
  ctaText?: string;
  ctaUrl?: string;
}): string => {
  const { 
    recipientName, campaignTitle, campaignSubtitle, bannerIcon = '🎁',
    offerTitle, offerDescription, promoCode, expiryDate,
    ctaText = 'Profiter de l\'offre', ctaUrl = 'https://nivratelecom.ca',
    supportEmail 
  } = params;
  const name = recipientName || 'Cher client';
  
  const content = `
    ${header()}
    ${statusBanner('purple', bannerIcon, campaignTitle, campaignSubtitle)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(name)},
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.purpleLight} 0%, #ede9fe 100%); border: 1px solid ${colors.purpleBorder}; border-radius: 16px; padding: 32px; margin: 24px 0;">
        <h3 style="color: ${colors.gray900}; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">${escapeHtml(offerTitle)}</h3>
        <p style="color: ${colors.gray600}; font-size: 15px; line-height: 1.6; margin: 0;">${escapeHtml(offerDescription)}</p>
        
        ${promoCode ? `
          <div style="background-color: ${colors.white}; border: 2px dashed ${colors.purple}; border-radius: 12px; padding: 20px; text-align: center; margin-top: 24px;">
            <p style="color: ${colors.gray500}; font-size: 12px; font-weight: 500; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px;">Code promo</p>
            <p style="color: ${colors.purpleDark}; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: 2px;">${escapeHtml(promoCode)}</p>
          </div>
        ` : ''}
      </div>
      
      ${expiryDate ? `
        ${alertBox('warning', '⏰', 'Offre limitée', `Cette offre se termine le ${expiryDate}. Ne manquez pas cette opportunité!`)}
      ` : ''}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button(ctaText + ' →', ctaUrl, 'primary')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    campaignTitle + ' - Nivra Télécom',
    `${name}, ${campaignSubtitle}`,
    content
  );
};

// 4. Relance panier abandonné
export const abandonedCart = (params: BaseParams & {
  recipientName?: string;
  cartItems?: Array<{ name: string; price: number }>;
  cartTotal?: number;
  cartUrl?: string;
}): string => {
  const { recipientName, cartItems = [], cartTotal, cartUrl = 'https://nivratelecom.ca/contact', supportEmail } = params;
  const name = recipientName || 'Cher client';
  
  const itemsHtml = cartItems.map(item => `
    <tr style="border-bottom: 1px solid ${colors.gray200};">
      <td style="padding: 12px 0; color: ${colors.gray900}; font-size: 14px;">${escapeHtml(item.name)}</td>
      <td style="padding: 12px 0; color: ${colors.gray900}; font-size: 14px; font-weight: 600; text-align: right;">${formatCurrencySimple(item.price)}/mois</td>
    </tr>
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner('warning', '🛒', 'Vous avez oublié quelque chose!', 'Votre panier vous attend')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(name)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous avons remarqué que vous n'avez pas finalisé votre commande. Vos services sélectionnés sont toujours disponibles!
      </p>
      
      ${cartItems.length > 0 ? `
        ${sectionHeader('Votre sélection', 'primary')}
        <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tbody>
              ${itemsHtml}
              ${cartTotal ? `
                <tr>
                  <td style="padding: 16px 0 0 0; color: ${colors.gray900}; font-size: 16px; font-weight: 700;">Total estimé</td>
                  <td style="padding: 16px 0 0 0; color: ${colors.success}; font-size: 18px; font-weight: 700; text-align: right;">${formatCurrencySimple(cartTotal)}/mois</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      ` : ''}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Finaliser ma commande →', cartUrl, 'success')}
      </div>
      
      <p style="color: ${colors.gray500}; font-size: 14px; text-align: center; margin-top: 24px;">
        Des questions? N'hésitez pas à nous contacter via chat ou tickets, nous sommes là pour vous aider!
      </p>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Votre panier vous attend - Nivra Télécom',
    `${name}, finalisez votre commande chez Nivra Télécom`,
    content
  );
};

// 5. Newsletter Nivra
export const newsletter = (params: BaseParams & {
  recipientName?: string;
  subject: string;
  previewText: string;
  sections: Array<{
    title: string;
    content: string;
    ctaText?: string;
    ctaUrl?: string;
    imageUrl?: string;
  }>;
  unsubscribeUrl?: string;
}): string => {
  const { recipientName, subject, previewText, sections, unsubscribeUrl = '#', supportEmail } = params;
  const name = recipientName || 'Cher abonné';
  
  const sectionsHtml = sections.map((section, index) => `
    <div style="margin-bottom: 32px; ${index > 0 ? `padding-top: 32px; border-top: 1px solid ${colors.gray200};` : ''}">
      ${section.imageUrl ? `<img src="${section.imageUrl}" alt="" style="width: 100%; border-radius: 12px; margin-bottom: 16px;">` : ''}
      <h3 style="color: ${colors.gray900}; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">${escapeHtml(section.title)}</h3>
      <p style="color: ${colors.gray600}; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">${escapeHtml(section.content)}</p>
      ${section.ctaText && section.ctaUrl ? `
        <a href="${section.ctaUrl}" style="color: ${colors.primary}; font-size: 14px; font-weight: 600; text-decoration: none;">
          ${escapeHtml(section.ctaText)} →
        </a>
      ` : ''}
    </div>
  `).join('');
  
  const content = `
    ${header()}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 32px 0;">
        Bonjour ${escapeHtml(name)},
      </p>
      
      ${sectionsHtml}
      
      <hr style="border: none; border-top: 1px solid ${colors.gray200}; margin: 32px 0;">
      
      <p style="color: ${colors.gray500}; font-size: 13px; text-align: center; margin: 0;">
        Vous recevez cet email car vous êtes inscrit à notre newsletter.<br>
        <a href="${unsubscribeUrl}" style="color: ${colors.gray500}; text-decoration: underline;">Se désabonner</a>
      </p>
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(subject, previewText, content);
};

// 6. Email parrainage
export const referralInvite = (params: BaseParams & {
  referrerName: string;
  recipientName?: string;
  referralCode: string;
  referralBenefit: string;
  referralUrl?: string;
}): string => {
  const { referrerName, recipientName, referralCode, referralBenefit, referralUrl = 'https://nivratelecom.ca', supportEmail } = params;
  const name = recipientName || 'Cher ami';
  
  const content = `
    ${header()}
    ${statusBanner('success', '🎁', `${referrerName} vous recommande!`, 'Parrainage Nivra Télécom')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(name)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        <strong>${escapeHtml(referrerName)}</strong> pense que vous aimeriez Nivra Télécom et vous offre un avantage exclusif!
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.successLight} 0%, #d1fae5 100%); border: 2px solid ${colors.success}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.successText}; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">${escapeHtml(referralBenefit)}</p>
        <p style="color: ${colors.gray500}; font-size: 14px; margin: 0 0 16px 0;">Utilisez le code de parrainage:</p>
        <div style="background-color: ${colors.white}; border: 2px dashed ${colors.success}; border-radius: 12px; padding: 16px; display: inline-block;">
          <p style="color: ${colors.successDark}; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: 3px;">${escapeHtml(referralCode)}</p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Devenir client →', referralUrl, 'success')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    `${referrerName} vous recommande Nivra Télécom`,
    `${referrerName} vous offre ${referralBenefit} chez Nivra Télécom`,
    content
  );
};

// 7. Proposition personnalisée (suite à contact)
export const personalizedProposal = (params: BaseParams & {
  recipientName: string;
  agentName?: string;
  proposalSummary: string;
  services: Array<{ name: string; price: number; description?: string }>;
  totalMonthly: number;
  validUntil?: string;
  portalUrl?: string;
}): string => {
  const { recipientName, agentName = 'L\'équipe Nivra', proposalSummary, services, totalMonthly, validUntil, portalUrl = 'https://nivratelecom.ca/contact', supportEmail } = params;
  
  const servicesHtml = services.map(service => `
    <tr style="border-bottom: 1px solid ${colors.gray200};">
      <td style="padding: 16px 0;">
        <p style="color: ${colors.gray900}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">${escapeHtml(service.name)}</p>
        ${service.description ? `<p style="color: ${colors.gray500}; font-size: 13px; margin: 0;">${escapeHtml(service.description)}</p>` : ''}
      </td>
      <td style="padding: 16px 0; text-align: right; vertical-align: top;">
        <span style="color: ${colors.gray900}; font-size: 15px; font-weight: 600;">${formatCurrencySimple(service.price)}/mois</span>
      </td>
    </tr>
  `).join('');
  
  const content = `
    ${header()}
    ${statusBanner('info', '📋', 'Votre proposition personnalisée', `De ${agentName}`)}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(recipientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        ${escapeHtml(proposalSummary)}
      </p>
      
      ${sectionHeader('Services proposés', 'primary')}
      <div style="background-color: ${colors.gray50}; border: 1px solid ${colors.gray200}; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; padding: 0 20px;">
          <tbody>
            ${servicesHtml}
            <tr>
              <td style="padding: 20px 0;">
                <p style="color: ${colors.gray900}; font-size: 16px; font-weight: 700; margin: 0;">Total mensuel</p>
              </td>
              <td style="padding: 20px 0; text-align: right;">
                <span style="color: ${colors.success}; font-size: 24px; font-weight: 800;">${formatCurrencySimple(totalMonthly)}</span>
                <span style="color: ${colors.gray500}; font-size: 14px;">/mois</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      ${validUntil ? alertBox('warning', '⏰', 'Offre valide jusqu\'au ' + validUntil, 'N\'attendez pas pour profiter de cette proposition personnalisée!') : ''}
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accepter cette offre →', portalUrl, 'success')}
      </div>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Votre proposition personnalisée - Nivra Télécom',
    `${recipientName}, voici votre proposition personnalisée de ${formatCurrencySimple(totalMonthly)}/mois`,
    content
  );
};

// 8. Feedback request
export const feedbackRequest = (params: BaseParams & {
  clientName: string;
  feedbackUrl?: string;
}): string => {
  const { clientName, feedbackUrl = 'https://nivratelecom.ca/feedback', supportEmail } = params;
  
  const content = `
    ${header()}
    ${statusBanner('purple', '💬', 'Votre avis compte!', 'Aidez-nous à nous améliorer')}
    ${contentWrapper(`
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour ${escapeHtml(clientName)},
      </p>
      <p style="color: ${colors.gray700}; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Nous espérons que vous appréciez vos services Nivra Télécom! Votre satisfaction est notre priorité, et nous aimerions connaître votre avis.
      </p>
      
      <div style="background: linear-gradient(135deg, ${colors.purpleLight} 0%, #ede9fe 100%); border: 1px solid ${colors.purpleBorder}; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <p style="color: ${colors.gray900}; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Comment évaluez-vous votre expérience?</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="padding: 0 8px;"><span style="font-size: 32px; cursor: pointer;">😞</span></td>
            <td style="padding: 0 8px;"><span style="font-size: 32px; cursor: pointer;">😐</span></td>
            <td style="padding: 0 8px;"><span style="font-size: 32px; cursor: pointer;">🙂</span></td>
            <td style="padding: 0 8px;"><span style="font-size: 32px; cursor: pointer;">😊</span></td>
            <td style="padding: 0 8px;"><span style="font-size: 32px; cursor: pointer;">🤩</span></td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        ${button('Donner mon avis →', feedbackUrl, 'primary')}
      </div>
      
      <p style="color: ${colors.gray500}; font-size: 14px; text-align: center; margin-top: 24px;">
        Merci de prendre le temps de nous aider à nous améliorer!
      </p>
      
      ${helpSection(supportEmail)}
    `)}
    ${footer(supportEmail)}
  `;
  
  return emailDocument(
    'Votre avis compte! - Nivra Télécom',
    `${clientName}, nous aimerions connaître votre avis sur Nivra Télécom`,
    content
  );
};
