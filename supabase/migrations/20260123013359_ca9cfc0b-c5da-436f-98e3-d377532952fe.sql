-- ============================================================
-- NIVRA TELECOM - TEMPLATES MARKETING PRÉ-DÉFINIS
-- Catégories: Marketing, Onboarding, Billing, Service, Newsletter, Promotional
-- ============================================================

-- 1. MARKETING - Découvrir Nivra
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Découvrir Nivra',
  'discover-nivra',
  'Découvrez pourquoi {{client_name}} devrait choisir Nivra',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Découvrez Nivra</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.content{padding:40px}.btn{display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;border-top:1px solid #e5e5e5;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1><span style="color:#64748b;font-size:11px;text-transform:uppercase">Télécommunications</span></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151;line-height:1.7">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">Êtes-vous fatigué des contrats compliqués et des frais cachés? Chez Nivra, nous croyons en la transparence totale.</p><h2 style="color:#0066CC;font-size:18px;margin:24px 0 16px">Pourquoi choisir Nivra?</h2><ul style="color:#374151;line-height:2"><li><strong>Sans contrat</strong> – Restez libre, partez quand vous voulez</li><li><strong>Prix clairs</strong> – Ce que vous voyez est ce que vous payez</li><li><strong>Support local</strong> – Une équipe québécoise à votre écoute</li></ul><div style="text-align:center;margin:32px 0"><a href="{{portal_link}}" class="btn" style="color:#fff">Découvrir nos forfaits →</a></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5</p><p>Support@nivratelecom.ca | <a href="{{unsubscribe_link}}">Se désabonner</a></p></td></tr></table></div></body></html>',
  'Découvrez les avantages Nivra: sans contrat, prix clairs, support local',
  'marketing',
  '["client_name", "portal_link", "unsubscribe_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 2. PROMOTIONAL - Offre de bienvenue
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Offre de bienvenue',
  'welcome-offer',
  '🎉 {{client_name}}, profitez de {{discount_percent}}% de rabais!',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Offre spéciale</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.content{padding:40px}.offer-box{background:linear-gradient(135deg,#0066CC,#0052a3);border-radius:12px;padding:32px;text-align:center;color:#fff}.promo-code{background:#fff;color:#0066CC;padding:12px 24px;border-radius:8px;font-size:24px;font-weight:700;display:inline-block;margin:16px 0}.btn{display:inline-block;background:#fff;color:#0066CC;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;border-top:1px solid #e5e5e5;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151">Nous avons une offre exclusive pour vous!</p><div class="offer-box"><p style="font-size:48px;font-weight:800;margin:0">{{discount_percent}}%</p><p style="font-size:18px;margin:8px 0">de rabais sur votre première facture</p><div class="promo-code">{{promo_code}}</div><p style="font-size:14px;opacity:0.9">Valide jusqu''au {{expiry_date}}</p><a href="{{portal_link}}" class="btn">Activer mon offre →</a></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | Support@nivratelecom.ca</p><p><a href="{{unsubscribe_link}}">Se désabonner</a></p></td></tr></table></div></body></html>',
  'Offre exclusive: économisez sur votre première facture',
  'promotional',
  '["client_name", "discount_percent", "promo_code", "expiry_date", "portal_link", "unsubscribe_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 3. PROMOTIONAL - Campagne saisonnière
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Campagne saisonnière',
  'seasonal-campaign',
  '{{campaign_title}} - Offre limitée chez Nivra',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Campagne saisonnière</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.hero{background:#0066CC;color:#fff;padding:48px 40px;text-align:center}.content{padding:40px}.btn{display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="hero"><h2 style="font-size:36px;margin:0 0 16px">{{campaign_title}}</h2><p style="font-size:18px;margin:0;opacity:0.9">{{campaign_subtitle}}</p></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151;line-height:1.7">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">{{offer_details}}</p><div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;margin:24px 0;text-align:center"><p style="margin:0 0 8px;color:#0369a1;font-weight:600">Code promo</p><p style="margin:0;font-size:24px;font-weight:700;color:#0066CC">{{promo_code}}</p><p style="margin:8px 0 0;font-size:14px;color:#64748b">Expire le {{expiry_date}}</p></div><div style="text-align:center"><a href="{{portal_link}}" class="btn" style="color:#fff">Profiter de l''offre →</a></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | <a href="{{unsubscribe_link}}">Se désabonner</a></p></td></tr></table></div></body></html>',
  'Offre exclusive à durée limitée',
  'promotional',
  '["client_name", "campaign_title", "campaign_subtitle", "offer_details", "promo_code", "expiry_date", "portal_link", "unsubscribe_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 4. MARKETING - Panier abandonné
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Panier abandonné',
  'abandoned-cart',
  '{{client_name}}, vous avez oublié quelque chose! 🛒',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Panier abandonné</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.content{padding:40px}.cart-item{background:#f8fafc;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:12px 0}.btn{display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151">Vous avez laissé des articles dans votre panier. Complétez votre commande avant qu''il ne soit trop tard!</p><div class="cart-item"><p style="margin:0;font-weight:600;color:#1f2937">{{cart_items}}</p><p style="margin:8px 0 0;color:#64748b">Total estimé: <strong style="color:#0066CC">{{cart_total}}</strong></p></div><div style="text-align:center;margin:32px 0"><a href="{{portal_link}}" class="btn" style="color:#fff">Compléter ma commande →</a></div><p style="font-size:14px;color:#64748b;text-align:center">Des questions? Contactez-nous à Support@nivratelecom.ca</p></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | <a href="{{unsubscribe_link}}">Se désabonner</a></p></td></tr></table></div></body></html>',
  'Votre panier vous attend',
  'marketing',
  '["client_name", "cart_items", "cart_total", "portal_link", "unsubscribe_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 5. MARKETING - Proposition personnalisée
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Proposition personnalisée',
  'personalized-proposal',
  '📋 {{client_name}}, votre proposition sur mesure',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Proposition personnalisée</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.content{padding:40px}.service-row{border-bottom:1px solid #e5e5e5;padding:16px 0}.total-row{background:#f0f9ff;padding:20px;border-radius:8px;margin-top:16px}.btn{display:inline-block;background:#16a34a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="content"><div style="background:#f0f9ff;border-left:4px solid #0066CC;padding:16px;margin-bottom:24px"><p style="margin:0;font-weight:600;color:#0066CC">📋 Votre proposition personnalisée</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">De {{agent_name}}</p></div><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">{{proposal_summary}}</p><h3 style="color:#0066CC;margin:24px 0 16px">Services proposés</h3><div style="background:#f8fafc;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden"><div style="padding:0 20px">{{services_list}}</div><div class="total-row"><table style="width:100%"><tr><td style="font-weight:700;color:#1f2937">Total mensuel</td><td style="text-align:right"><span style="font-size:24px;font-weight:800;color:#16a34a">{{monthly_total}}</span><span style="color:#64748b">/mois</span></td></tr></table></div></div><div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:24px 0"><p style="margin:0;color:#92400e">⏰ Offre valide jusqu''au {{valid_until}}</p></div><div style="text-align:center"><a href="{{portal_link}}" class="btn" style="color:#fff">Accepter cette offre →</a></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | Support@nivratelecom.ca</p></td></tr></table></div></body></html>',
  'Votre proposition personnalisée est prête',
  'marketing',
  '["client_name", "agent_name", "proposal_summary", "services_list", "monthly_total", "valid_until", "portal_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 6. MARKETING - Demande d''avis
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Demande d''avis',
  'feedback-request',
  '{{client_name}}, votre avis compte pour nous! ⭐',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Demande d''avis</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.content{padding:40px}.emoji-row{text-align:center;margin:32px 0}.emoji{font-size:48px;margin:0 12px;cursor:pointer;text-decoration:none}.btn{display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">Merci de faire partie de la famille Nivra! Nous aimerions connaître votre expérience avec nos services.</p><p style="font-size:16px;color:#374151">Comment évalueriez-vous nos services?</p><div class="emoji-row"><a href="{{feedback_link}}?rating=1" class="emoji">😠</a><a href="{{feedback_link}}?rating=2" class="emoji">😕</a><a href="{{feedback_link}}?rating=3" class="emoji">😐</a><a href="{{feedback_link}}?rating=4" class="emoji">🙂</a><a href="{{feedback_link}}?rating=5" class="emoji">😍</a></div><div style="text-align:center;margin:32px 0"><a href="{{feedback_link}}" class="btn" style="color:#fff">Donner mon avis →</a></div><p style="font-size:14px;color:#64748b;text-align:center">Votre feedback nous aide à améliorer nos services pour vous.</p></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | <a href="{{unsubscribe_link}}">Se désabonner</a></p></td></tr></table></div></body></html>',
  'Partagez votre expérience avec Nivra',
  'marketing',
  '["client_name", "feedback_link", "unsubscribe_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 7. MARKETING - Invitation parrainage
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Invitation parrainage',
  'referral-invite',
  '{{client_name}}, parrainez un ami et économisez! 🎁',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Programme de parrainage</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.content{padding:40px}.reward-box{background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px;padding:32px;text-align:center;color:#fff}.btn{display:inline-block;background:#fff;color:#7c3aed;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">Vous aimez Nivra? Partagez l''expérience avec vos proches et gagnez des récompenses!</p><div class="reward-box"><p style="font-size:24px;font-weight:700;margin:0 0 16px">🎁 {{reward_amount}} de crédit</p><p style="font-size:16px;margin:0 0 24px;opacity:0.9">Pour vous ET votre ami(e)</p><a href="{{referral_link}}" class="btn">Inviter un ami →</a></div><h3 style="color:#1f2937;margin:32px 0 16px">Comment ça marche?</h3><ol style="color:#374151;line-height:2"><li>Partagez votre lien de parrainage unique</li><li>Votre ami s''inscrit et active son service</li><li>Vous recevez tous les deux {{reward_amount}} de crédit!</li></ol></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | <a href="{{unsubscribe_link}}">Se désabonner</a></p></td></tr></table></div></body></html>',
  'Gagnez des crédits en invitant vos amis',
  'marketing',
  '["client_name", "reward_amount", "referral_link", "unsubscribe_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 8. NEWSLETTER - Newsletter mensuelle améliorée
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Newsletter - Nouvelles du mois',
  'newsletter-monthly-v2',
  '📰 Les nouvelles Nivra de {{month}} {{year}}',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Newsletter</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.content{padding:40px}.section{margin:32px 0;padding:24px;background:#f8fafc;border-radius:8px}.btn{display:inline-block;background:#0066CC;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1><span style="color:#64748b;font-size:14px">Newsletter {{month}} {{year}}</span></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">Voici les dernières nouvelles de Nivra Telecom.</p>{{content}}<div style="text-align:center;margin:32px 0"><a href="{{portal_link}}" class="btn" style="color:#fff">Accéder à mon portail →</a></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | 1799 Av. Pierre-Péladeau, Laval</p><p><a href="{{unsubscribe_link}}">Se désabonner</a></p></td></tr></table></div></body></html>',
  'Nouvelles, promotions et mises à jour de Nivra',
  'newsletter',
  '["client_name", "month", "year", "content", "portal_link", "unsubscribe_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 9. ONBOARDING - Compte créé
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Bienvenue - Compte créé',
  'account-created',
  '🎉 Bienvenue chez Nivra, {{client_name}}!',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Bienvenue</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.hero{background:#0066CC;color:#fff;padding:48px 40px;text-align:center}.content{padding:40px}.step{display:flex;margin:16px 0;padding:16px;background:#f8fafc;border-radius:8px}.step-num{background:#0066CC;color:#fff;width:32px;height:32px;border-radius:50%;text-align:center;line-height:32px;font-weight:700;margin-right:16px;flex-shrink:0}.btn{display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="hero"><p style="font-size:48px;margin:0">🎉</p><h2 style="font-size:28px;margin:16px 0 8px">Bienvenue dans la famille Nivra!</h2><p style="font-size:16px;margin:0;opacity:0.9">Votre compte a été créé avec succès</p></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">Merci de nous avoir choisis! Voici les prochaines étapes:</p><div class="step"><span class="step-num">1</span><div><strong>Explorez votre portail</strong><p style="margin:4px 0 0;color:#64748b;font-size:14px">Gérez vos services et factures</p></div></div><div class="step"><span class="step-num">2</span><div><strong>Configurez vos préférences</strong><p style="margin:4px 0 0;color:#64748b;font-size:14px">Personnalisez vos notifications</p></div></div><div class="step"><span class="step-num">3</span><div><strong>Contactez-nous si besoin</strong><p style="margin:4px 0 0;color:#64748b;font-size:14px">Notre équipe est là pour vous</p></div></div><div style="text-align:center;margin:32px 0"><a href="{{portal_link}}" class="btn" style="color:#fff">Accéder à mon portail →</a></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | Support@nivratelecom.ca</p></td></tr></table></div></body></html>',
  'Votre compte Nivra est prêt',
  'onboarding',
  '["client_name", "portal_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 10. SERVICE - Activation confirmée
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Service activé',
  'service-activated-v2',
  '✅ {{client_name}}, votre {{service_type}} est maintenant actif!',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Service activé</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.success-banner{background:#dcfce7;border-bottom:1px solid #86efac;padding:20px 40px;text-align:center}.content{padding:40px}.info-box{background:#f8fafc;border:1px solid #e5e5e5;border-radius:8px;padding:20px;margin:24px 0}.btn{display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="success-banner"><span style="font-size:32px">✅</span><p style="margin:8px 0 0;font-size:18px;font-weight:600;color:#16a34a">Service activé avec succès!</p></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">Excellente nouvelle! Votre service est maintenant actif et prêt à être utilisé.</p><div class="info-box"><table style="width:100%"><tr><td style="padding:8px 0;color:#64748b">Service</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#1f2937">{{service_type}}</td></tr><tr><td style="padding:8px 0;color:#64748b">Forfait</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#1f2937">{{plan_name}}</td></tr><tr><td style="padding:8px 0;color:#64748b">Date d''activation</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#1f2937">{{activation_date}}</td></tr><tr style="border-top:1px solid #e5e5e5"><td style="padding:16px 0 8px;color:#64748b">Montant mensuel</td><td style="padding:16px 0 8px;text-align:right;font-weight:700;font-size:20px;color:#0066CC">{{amount}}</td></tr></table></div><div style="text-align:center"><a href="{{portal_link}}" class="btn" style="color:#fff">Voir mes services →</a></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | Support@nivratelecom.ca</p></td></tr></table></div></body></html>',
  'Votre service Nivra est maintenant actif',
  'service',
  '["client_name", "service_type", "plan_name", "activation_date", "amount", "portal_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 11. BILLING - Facture créée
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Nouvelle facture',
  'invoice-created',
  '📄 {{client_name}}, votre facture #{{invoice_number}} est disponible',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Nouvelle facture</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.content{padding:40px}.invoice-box{background:#f8fafc;border:1px solid #e5e5e5;border-radius:8px;padding:24px;text-align:center;margin:24px 0}.btn{display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">Votre nouvelle facture est maintenant disponible.</p><div class="invoice-box"><p style="margin:0;color:#64748b;font-size:14px">Facture #{{invoice_number}}</p><p style="margin:16px 0;font-size:36px;font-weight:800;color:#1f2937">{{amount}}</p><p style="margin:0;color:#64748b">À payer avant le <strong>{{due_date}}</strong></p></div><div style="text-align:center;margin:24px 0"><a href="{{payment_link}}" class="btn" style="color:#fff">Payer maintenant →</a></div><div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin-top:24px"><p style="margin:0;color:#92400e;font-size:14px"><strong>💡 Virement Interac:</strong> Envoyez votre paiement à Support@nivratelecom.ca avec votre numéro de facture comme référence.</p></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | 1799 Av. Pierre-Péladeau, Laval</p></td></tr></table></div></body></html>',
  'Votre facture Nivra est prête',
  'billing',
  '["client_name", "invoice_number", "amount", "due_date", "payment_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 12. BILLING - Rappel paiement amélioré
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Rappel de paiement - Urgent',
  'payment-reminder-urgent',
  '⚠️ {{client_name}}, votre paiement est en retard',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Rappel de paiement</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.warning-banner{background:#fef2f2;border-bottom:1px solid #fecaca;padding:20px 40px;text-align:center}.content{padding:40px}.amount-box{background:#fef2f2;border:2px solid #f87171;border-radius:8px;padding:24px;text-align:center;margin:24px 0}.btn{display:inline-block;background:#dc2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="warning-banner"><span style="font-size:32px">⚠️</span><p style="margin:8px 0 0;font-size:18px;font-weight:600;color:#dc2626">Paiement en retard</p></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">Nous n''avons pas encore reçu votre paiement pour la facture #{{invoice_number}}.</p><div class="amount-box"><p style="margin:0;color:#dc2626;font-size:14px">Montant dû</p><p style="margin:8px 0;font-size:36px;font-weight:800;color:#dc2626">{{amount}}</p><p style="margin:0;color:#64748b">Échéance dépassée: {{due_date}}</p></div><div style="text-align:center;margin:24px 0"><a href="{{payment_link}}" class="btn" style="color:#fff">Régulariser maintenant →</a></div><p style="font-size:14px;color:#64748b;text-align:center">Si vous avez déjà effectué le paiement, veuillez ignorer ce message.</p></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | Support@nivratelecom.ca</p></td></tr></table></div></body></html>',
  'Action requise: paiement en retard',
  'billing',
  '["client_name", "invoice_number", "amount", "due_date", "payment_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 13. SERVICE - Rendez-vous confirmé
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Rendez-vous confirmé',
  'appointment-confirmed',
  '📅 {{client_name}}, votre rendez-vous est confirmé',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Rendez-vous confirmé</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.content{padding:40px}.appointment-box{background:#f0f9ff;border:2px solid #0066CC;border-radius:12px;padding:24px;text-align:center;margin:24px 0}.btn{display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.btn-outline{display:inline-block;background:#fff;color:#0066CC;border:2px solid #0066CC;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-left:8px}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">Votre rendez-vous a été confirmé.</p><div class="appointment-box"><p style="font-size:48px;margin:0">📅</p><p style="margin:16px 0 8px;font-size:24px;font-weight:700;color:#0066CC">{{appointment_date}}</p><p style="margin:0;font-size:18px;color:#374151">{{appointment_time}}</p><p style="margin:16px 0 0;color:#64748b">{{service_type}}</p></div><div style="background:#f8fafc;border:1px solid #e5e5e5;border-radius:8px;padding:20px;margin:24px 0"><p style="margin:0 0 8px;font-weight:600;color:#1f2937">📍 Adresse</p><p style="margin:0;color:#64748b">{{service_address}}</p></div><div style="text-align:center"><a href="{{portal_link}}" class="btn" style="color:#fff">Voir les détails</a><a href="{{reschedule_link}}" class="btn-outline">Modifier</a></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | Support@nivratelecom.ca</p></td></tr></table></div></body></html>',
  'Votre rendez-vous Nivra est confirmé',
  'service',
  '["client_name", "appointment_date", "appointment_time", "service_type", "service_address", "portal_link", "reschedule_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 14. PROMOTIONAL - Black Friday
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Black Friday',
  'black-friday',
  '🖤 BLACK FRIDAY - Jusqu''à {{discount_percent}}% de rabais!',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Black Friday</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#111}.container{max-width:600px;margin:0 auto;background:#111;border:1px solid #333}.header{padding:28px 40px;border-bottom:3px solid #f59e0b;background:#111}h1{margin:0;font-size:26px;font-weight:700;color:#fff}.hero{background:linear-gradient(135deg,#111,#1f1f1f);padding:48px 40px;text-align:center}.content{padding:40px;background:#111}.offer{background:#1f1f1f;border:2px solid #f59e0b;border-radius:12px;padding:24px;margin:24px 0;text-align:center}.btn{display:inline-block;background:#f59e0b;color:#111;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px}.footer{padding:32px;background:#0a0a0a;text-align:center;font-size:12px;color:#6b7280}</style></head><body><div style="padding:32px 16px;background:#111"><table class="container" role="presentation"><tr class="header"><td><h1 style="color:#fff">Nivra Telecom</h1></td></tr><tr><td class="hero"><p style="font-size:64px;margin:0;color:#f59e0b">🖤</p><h2 style="font-size:48px;margin:16px 0;color:#fff;letter-spacing:4px">BLACK FRIDAY</h2><p style="font-size:20px;color:#9ca3af;margin:0">Offres exclusives à durée limitée</p></td></tr><tr><td class="content"><p style="font-size:16px;color:#d1d5db">Bonjour {{client_name}},</p><div class="offer"><p style="font-size:64px;font-weight:800;color:#f59e0b;margin:0">{{discount_percent}}%</p><p style="font-size:18px;color:#fff;margin:8px 0">DE RABAIS</p><p style="color:#9ca3af;margin:16px 0 0">Code: <strong style="color:#f59e0b">{{promo_code}}</strong></p></div><div style="text-align:center"><a href="{{portal_link}}" class="btn">PROFITER DE L''OFFRE →</a></div><p style="color:#6b7280;text-align:center;margin-top:24px;font-size:14px">Offre valide jusqu''au {{expiry_date}}</p></td></tr><tr><td class="footer"><p style="color:#6b7280">Nivra Communications Inc. | <a href="{{unsubscribe_link}}" style="color:#9ca3af">Se désabonner</a></p></td></tr></table></div></body></html>',
  'Offres Black Friday exceptionnelles chez Nivra',
  'promotional',
  '["client_name", "discount_percent", "promo_code", "expiry_date", "portal_link", "unsubscribe_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;

-- 15. PROMOTIONAL - Rentrée scolaire
INSERT INTO public.email_templates (name, slug, subject, html_content, preview_text, category, variables, is_active)
VALUES (
  'Rentrée scolaire',
  'back-to-school',
  '📚 Rentrée: Forfaits étudiants à prix réduit!',
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Rentrée scolaire</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px}.header{padding:28px 40px;border-bottom:3px solid #0066CC}h1{margin:0;font-size:26px;font-weight:700;color:#0066CC}.hero{background:linear-gradient(135deg,#1e40af,#3b82f6);padding:48px 40px;text-align:center}.content{padding:40px}.plan-box{background:#f8fafc;border:2px solid #3b82f6;border-radius:12px;padding:24px;margin:16px 0;text-align:center}.btn{display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}.footer{padding:32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div style="padding:32px 16px;background:#f5f5f5"><table class="container" role="presentation"><tr class="header"><td><h1>Nivra Telecom</h1></td></tr><tr><td class="hero"><p style="font-size:48px;margin:0">📚</p><h2 style="font-size:32px;margin:16px 0;color:#fff">Spécial Rentrée!</h2><p style="font-size:18px;color:rgba(255,255,255,0.9);margin:0">Forfaits étudiants à prix réduit</p></td></tr><tr><td class="content"><p style="font-size:16px;color:#374151">Bonjour {{client_name}},</p><p style="font-size:16px;color:#374151;line-height:1.7">La rentrée approche! Profitez de nos forfaits spéciaux pour étudiants.</p><div class="plan-box"><p style="margin:0;font-size:14px;color:#3b82f6;font-weight:600">FORFAIT ÉTUDIANT</p><p style="margin:8px 0;font-size:36px;font-weight:800;color:#1f2937">{{plan_price}}<span style="font-size:16px;color:#64748b">/mois</span></p><p style="margin:0;color:#64748b">{{plan_features}}</p></div><div style="background:#dbeafe;border-radius:8px;padding:16px;margin:24px 0"><p style="margin:0;color:#1e40af"><strong>Code promo:</strong> {{promo_code}}</p></div><div style="text-align:center"><a href="{{portal_link}}" class="btn" style="color:#fff">Voir les forfaits →</a></div></td></tr><tr><td class="footer"><p>Nivra Communications Inc. | <a href="{{unsubscribe_link}}">Se désabonner</a></p></td></tr></table></div></body></html>',
  'Forfaits spéciaux pour la rentrée',
  'promotional',
  '["client_name", "plan_price", "plan_features", "promo_code", "portal_link", "unsubscribe_link"]',
  true
) ON CONFLICT (slug) DO NOTHING;