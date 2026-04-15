import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'fr' | 'en' | 'ht' | 'es' | 'ar' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const languages: { code: Language; name: string; nativeName: string }[] = [
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
];

// Translations object
const translations: Record<Language, Record<string, string>> = {
  fr: {
    // Navigation
    'nav.home': 'Accueil',
    'nav.services': 'Services',
    'nav.about': 'À propos',
    'nav.faq': 'FAQ',
    'nav.careers': 'Carrières',
    'nav.contact': 'Contact',
    'nav.book': 'Prendre rendez-vous',
    'nav.login': 'Connexion',
    'nav.portal': 'Portail client',
    'nav.admin': 'Administration',
    'nav.logout': 'Déconnexion',
    
    // Hero
    'hero.badge': 'Fournisseur télécom au Québec',
    'hero.title1': 'Télécommunications fiables. Installation rapide.',
    'hero.title2': 'Support humain.',
    'hero.subtitle': 'Mobile, Internet, Télévision et Sécurité connectée. Une mise en service claire, une installation planifiée et un support réactif pour la maison et l\'entreprise.',
    'hero.cta.order': 'Demander un service',
    'hero.cta.services': 'Nous joindre',
    'hero.trust.activation': 'Activation et mise en service rapide',
    'hero.trust.installation': 'Installation sur rendez-vous',
    'hero.trust.support': 'Support technique réactif',
    'hero.trust.solutions': 'Résidentiel et entreprise',
    
    // Services
    'services.badge': 'Nos services',
    'services.title': 'Services télécom',
    'services.subtitle': 'Activation, installation et support pour tous vos besoins.',
    'services.mobile.title': 'Mobile',
    'services.mobile.desc': 'Activation de lignes, changements de forfait, configuration et support. Un service simple, rapide, encadré.',
    'services.internet.title': 'Internet',
    'services.internet.desc': 'Connexion stable et performante. Installation planifiée, optimisation Wi-Fi et assistance technique.',
    'services.tv.title': 'Télévision',
    'services.tv.desc': 'Mise en service, configuration et support. Des options claires, une expérience fluide.',
    'services.business.title': 'Sécurité',
    'services.business.desc': 'Solutions connectées pour protéger vos espaces. Installation, paramétrage et accompagnement.',
    'services.cta': 'Découvrir',
    'services.mobile.feature1': 'Activation et transfert de numéro',
    'services.mobile.feature2': 'Gestion multi-lignes',
    'services.mobile.feature3': 'Configuration eSIM et APN',
    'services.internet.feature1': 'Installation planifiée',
    'services.internet.feature2': 'Configuration routeur et Wi-Fi',
    'services.internet.feature3': 'Support technique',
    'services.tv.feature1': 'Mise en service',
    'services.tv.feature2': 'Configuration équipement',
    'services.tv.feature3': 'Assistance continue',
    'services.business.feature1': 'Évaluation des besoins',
    'services.business.feature2': 'Installation et configuration',
    'services.business.feature3': 'Support et maintenance',
    
    // Benefits (Pourquoi Nivra Telecom)
    'benefits.badge': 'Pourquoi Nivra Telecom',
    'benefits.title': 'Confiance + adoption + stabilité',
    'benefits.subtitle': 'Ce ne sont pas des chiffres marketing, ce sont des indicateurs d\'un service qui fonctionne dans la vraie vie.',
    'benefits.stat1.title': 'de satisfaction client',
    'benefits.stat1.desc': 'Un standard, pas une exception. Moins de 2 % d\'insatisfaction, parce que nos processus éliminent les erreurs, les oublis et les mauvaises installations.',
    'benefits.stat2.title': 'clients actifs au Québec',
    'benefits.stat2.desc': 'Et ça continue de croître. Chaque nouveau client rejoint un réseau de membres déjà pris en charge, activés et supportés localement.',
    'benefits.stat3.title': 'vérification de crédit',
    'benefits.stat3.desc': '100 % d\'accès équitable aux services essentiels. Parce qu\'un fournisseur télécom moderne doit connecter les gens, pas les bloquer.',
    'benefits.trust.local': 'Équipe télécom québécoise',
    'benefits.trust.secure': 'Données sécurisées',
    'benefits.trust.nocredit': 'Sans vérification de crédit',
    'benefits.trust.pricing': 'Prix compétitifs',
    'benefits.nocredit.audience': 'Idéal pour étudiants, nouveaux arrivants et historique de crédit difficile',
    
    // How it works (Comment ça marche)
    'howitworks.badge': 'Comment ça marche',
    'howitworks.title': 'Mise en service en 3 étapes',
    'howitworks.subtitle': 'Un processus simple pour activer vos services.',
    'howitworks.step1.title': 'Demande',
    'howitworks.step1.desc': 'Expliquez votre besoin via le formulaire ou par téléphone.',
    'howitworks.step2.title': 'Prise en charge',
    'howitworks.step2.desc': 'Notre équipe confirme et planifie l\'installation si nécessaire.',
    'howitworks.step3.title': 'Mise en service',
    'howitworks.step3.desc': 'Tout est configuré, vous êtes opérationnel.',
    
    // CTA
    'cta.badge': 'Prêt à démarrer?',
    'cta.title.order': 'Besoin d\'activer un service ou de corriger un problème?',
    'cta.subtitle.order': 'Expliquez votre besoin. Notre équipe vous guide, planifie l\'installation si nécessaire et assure le suivi.',
    'cta.phone': 'Contacter le support',
    
    // Contact Form
    'contact.title': 'Contact',
    'contact.subtitle': 'Pour une activation, une installation, un changement de service ou du support technique, écrivez-nous. Nous répondons rapidement.',
    'contact.name': 'Nom complet',
    'contact.name.placeholder': 'Votre nom',
    'contact.email': 'Courriel',
    'contact.email.placeholder': 'votre@courriel.com',
    'contact.phone': 'Téléphone',
    'contact.phone.placeholder': '(514) 555-0123',
    'contact.submit': 'Envoyer',
    'contact.sending': 'Envoi en cours...',
    'contact.success.title': 'Demande reçue!',
    'contact.success.text': 'Notre équipe vous contactera sous 1 jour ouvrable.',
    
    // Footer
    'footer.description': 'Fournisseur télécom au Québec. Activation, installation et support pour particuliers et entreprises.',
    'footer.services': 'Services',
    'footer.support': 'Support',
    'footer.company': 'Entreprise',
    'footer.legal': 'Légal',
    'footer.privacy': 'Politique de confidentialité',
    'footer.terms': 'Conditions d\'utilisation',
    'footer.refund': 'Remboursement',
    'footer.rights': 'Tous droits réservés.',
    'footer.contact': 'Nous joindre',
    'footer.tracking': 'Statut des demandes',
    
    // FAQ
    'faq.title': 'Foire aux',
    'faq.title2': 'questions',
    'faq.subtitle': 'Réponses aux questions fréquentes sur les services Nivra.',
    'faq.notfound.title': 'Vous n\'avez pas trouvé votre réponse?',
    'faq.notfound.text': 'Notre équipe est disponible pour vous aider.',
    'faq.contact': 'Nous contacter',
    
    // FAQ Categories
    'faq.cat.about': 'À propos de Nivra',
    'faq.cat.orders': 'Commandes et rendez-vous',
    'faq.cat.payments': 'Paiements et facturation',
    'faq.cat.security': 'Sécurité et accès',
    
    // FAQ Questions - About
    'faq.about.q1': 'Qu\'est-ce que Nivra?',
    'faq.about.a1': 'Nivra est un fournisseur télécom au Québec. Nous offrons l\'activation, l\'installation et le support de services télécoms.',
    'faq.about.q2': 'Comment fonctionne la mise en service?',
    'faq.about.a2': 'Vous envoyez une demande, on confirme vos besoins, puis on procède à l\'activation et l\'installation si nécessaire.',
    'faq.about.q3': 'Comment Nivra est-il rémunéré?',
    'faq.about.a3': 'Nivra est payé par ses clients (frais de service ou abonnements). Tarification claire et transparente.',
    'faq.about.q4': 'Quelles régions desservez-vous?',
    'faq.about.a4': 'Nivra offre ses services au Québec uniquement.',
    'faq.about.q5': 'C\'est quoi Nivra?',
    'faq.about.a5': 'Fournisseur télécom au Québec.',
    
    // FAQ Questions - Orders
    'faq.consult.q1': 'Comment demander un service Nivra?',
    'faq.consult.a1': 'Envoyez une demande en ligne ou appelez-nous. Pièce d\'identité gouvernementale requise.',
    'faq.consult.q2': 'Y a-t-il une vérification de crédit?',
    'faq:consult.a2': 'Non. Nivra ne fait aucune vérification de crédit. Seule une pièce d\'identité valide est requise.',
    'faq.consult.q3': 'Comment accéder à mon compte?',
    'faq.consult.a3': 'Connectez-vous via le portail client sur navigateur. Aucune application mobile disponible.',
    
    // FAQ Questions - Payments
    'faq.pay.q1': 'Comment voir mes factures?',
    'faq.pay.a1': 'Toutes vos factures et paiements sont visibles dans votre portail client (navigateur uniquement).',
    'faq.pay.q2': 'Qu\'arrive-t-il si je ne paie pas au Bill Cycle?',
    'faq.pay.a2': 'En prépayé, si non payé au Bill Cycle, le service n\'est pas renouvelé. Aucun frais de retard pour non-renouvellement normal. Après 90 jours, votre numéro peut devenir irrécupérable.',
    'faq.pay.q3': 'Comment fonctionnent les crédits?',
    'faq.pay.a3': 'Les crédits sont appliqués automatiquement à vos prochaines factures.',
    
    // FAQ Questions - Security
    'faq.sec.q1': 'Mes données sont-elles protégées?',
    'faq.sec.a1': 'Oui. Vos informations sont privées et accessibles uniquement par vous et les administrateurs Nivra.',
    'faq.sec.q2': 'Comment accéder à mon compte client?',
    'faq.sec.a2': 'Via le portail client sécurisé sur navigateur. Aucune app mobile.',
    'faq.sec.q3': 'Qui peut voir mes informations?',
    'faq.sec.a3': 'Seuls vous et les administrateurs Nivra. Aucune donnée partagée avec des tiers.',
    
    // About page
    'about.title': 'À propos de',
    'about.title2': 'Nivra',
    'about.subtitle': 'Fournisseur télécom indépendant au Québec. Service direct, tarification claire, support local.',
    'about.mission.title': 'Notre mission',
    'about.mission.text': 'Offrir des services télécom fiables — activation, installation et support — aux particuliers et entreprises du Québec.',
    'about.values.title': 'Nos valeurs',
    'about.values.independence': 'Service direct',
    'about.values.transparency': 'Tarification claire',
    'about.values.clientfirst': 'Client d\'abord',
    
    // Booking (now Demande de service)
    'booking.title': 'Demande de',
    'booking.title2': 'service',
    'booking.subtitle': 'Décrivez votre besoin — notre équipe vous répond rapidement.',
    
    // Auth
    'auth.login': 'Connexion',
    'auth.signup': 'Inscription',
    'auth.email': 'Courriel',
    'auth.password': 'Mot de passe',
    'auth.fullname': 'Nom complet',
    'auth.login.btn': 'Se connecter',
    'auth.signup.btn': 'S\'inscrire',
    'auth.forgot': 'Mot de passe oublié?',
    'auth.noaccount': 'Pas encore de compte?',
    'auth.hasaccount': 'Déjà un compte?',
    
    // Common
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.view': 'Voir',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.previous': 'Précédent',
    'common.search': 'Rechercher',
    'common.filter': 'Filtrer',
    'common.all': 'Tous',
    'common.none': 'Aucun',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.perMonth': '/ mois',
    'common.free': 'Gratuit',
    'common.included': 'Inclus',
    'common.confirm': 'Confirmer',
    'common.submit': 'Soumettre',
    'common.download': 'Télécharger',
    'common.upload': 'Téléverser',
    'common.export': 'Exporter',
    'common.close': 'Fermer',
    'common.or': 'ou',

    // Homepage — Hero (Xfinity-style)
    'xhero.eyebrow': 'Sans contrat. Résiliez à tout moment.',
    'xhero.title': 'Internet résidentiel fiable.',
    'xhero.titleAccent': 'Un prix. Simple.',
    'xhero.subtitle': 'Forfaits transparents • Activation rapide • Support local au Québec',
    'xhero.cta': 'Internet dès 39$/mois — Commencer',
    'xhero.ctaSecondary': 'Parler à un conseiller',
    'xhero.bullet1': 'Sans engagement',
    'xhero.bullet2': 'Installation rapide',
    'xhero.bullet3': 'Support québécois',

    // Homepage — Product Categories
    'categories.internet': 'Internet',
    'categories.internet.desc': 'Internet haute vitesse',
    'categories.mobile': 'Mobile',
    'categories.mobile.desc': 'Forfaits mobiles prépayés',
    'categories.tv': 'TV & Streaming',
    'categories.tv.desc': 'Télévision & divertissement',
    'categories.security': 'Sécurité',
    'categories.security.desc': 'Solutions de sécurité résidentielle',
    'categories.build': 'Créez votre forfait',
    'categories.build.desc': 'Personnalisez vos services',

    // Homepage — Pricing
    'pricing.title': 'Choisissez votre forfait',
    'pricing.subtitle': 'Internet illimité, sans contrat',
    'pricing.recommended': 'Recommandé',
    'pricing.choose': 'Choisir',
    'pricing.disclaimer': 'Taxes en sus • Équipement en option si applicable',

    // Homepage — Why Nivra
    'why.title': 'Pourquoi choisir Nivra',
    'why.nocontract': 'Sans contrat',
    'why.nocontract.desc': 'Aucun engagement à long terme. Vous gardez le contrôle.',
    'why.simple': 'Processus simple',
    'why.simple.desc': 'Commande en ligne, installation rapide, service actif.',
    'why.support': 'Support local',
    'why.support.desc': 'Équipe basée au Québec, disponible 7 jours sur 7.',
    'why.fast': 'Activation rapide',
    'why.fast.desc': 'Service activé en quelques jours, pas en semaines.',

    // Homepage — How it works
    'how.title': 'Comment ça fonctionne',
    'how.step1': 'Choisissez votre forfait',
    'how.step1.desc': 'Sélectionnez le plan Internet qui correspond à vos besoins.',
    'how.step2': 'Vérification de votre adresse',
    'how.step2.desc': 'Nous validons la disponibilité du service à votre adresse.',
    'how.step3': 'Installation ou activation',
    'how.step3.desc': 'Un technicien installe ou active votre service rapidement.',
    'how.step4': 'Service actif',
    'how.step4.desc': "Profitez de votre connexion Internet dès l'activation.",

    // Homepage — Final CTA
    'finalcta.title': 'Prêt à commencer ?',
    'finalcta.bullet1': 'Sans contrat',
    'finalcta.bullet2': 'Mise en service rapide',
    'finalcta.bullet3': 'Processus simple',
    'finalcta.cta': 'Commencer maintenant',

    // Errors
    'errors.generic': 'Une erreur est survenue. Veuillez réessayer.',
    'errors.network': 'Problème de connexion. Vérifiez votre réseau.',
    'errors.notFound': 'Page introuvable',
    'errors.unauthorized': 'Accès non autorisé',
    'errors.sessionExpired': 'Votre session a expiré. Reconnectez-vous.',

    // Portal
    'portal.welcome': 'Bienvenue',
    'portal.balance': 'Solde',
    'portal.nextPayment': 'Prochain paiement',
    'portal.currentPlan': 'Forfait actuel',
    'portal.usage': 'Utilisation',
    'portal.invoices': 'Factures',
    'portal.support': 'Support',
    'portal.settings': 'Paramètres',

    // Status page
    'status.title': 'État des services',
    'status.allOperational': 'Tous les systèmes fonctionnent normalement.',
    'status.issues': 'Certains services rencontrent des problèmes.',
  },
  
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.services': 'Services',
    'nav.about': 'About',
    'nav.faq': 'FAQ',
    'nav.careers': 'Careers',
    'nav.contact': 'Contact',
    'nav.book': 'Book Appointment',
    'nav.login': 'Login',
    'nav.portal': 'Client Portal',
    'nav.admin': 'Administration',
    'nav.logout': 'Logout',
    
    // Hero
    'hero.badge': 'Telecom Provider in Quebec',
    'hero.title1': 'Reliable telecommunications. Fast installation.',
    'hero.title2': 'Human support.',
    'hero.subtitle': 'Mobile, Internet, Television and Connected Security. Clear setup, scheduled installation and responsive support for home and business.',
    'hero.cta.order': 'Request service',
    'hero.cta.services': 'Contact us',
    'hero.trust.activation': 'Fast activation and setup',
    'hero.trust.installation': 'Scheduled installation',
    'hero.trust.support': 'Responsive technical support',
    'hero.trust.solutions': 'Home and business',
    
    // Services
    'services.badge': 'Our Services',
    'services.title': 'Telecom Services',
    'services.subtitle': 'Activation, installation and support for all your needs.',
    'services.mobile.title': 'Mobile',
    'services.mobile.desc': 'Line activation, plan changes, configuration and support. Simple, fast, structured service.',
    'services.internet.title': 'Internet',
    'services.internet.desc': 'Stable, high-performance connection. Scheduled installation, Wi-Fi optimization and technical support.',
    'services.tv.title': 'Television',
    'services.tv.desc': 'Setup, configuration and support. Clear options, smooth experience.',
    'services.business.title': 'Security',
    'services.business.desc': 'Connected solutions to protect your spaces. Installation, setup and guidance.',
    'services.cta': 'Learn more',
    'services.mobile.feature1': 'Activation and number transfer',
    'services.mobile.feature2': 'Multi-line management',
    'services.mobile.feature3': 'eSIM and APN configuration',
    'services.internet.feature1': 'Scheduled installation',
    'services.internet.feature2': 'Router and Wi-Fi setup',
    'services.internet.feature3': 'Technical support',
    'services.tv.feature1': 'Service setup',
    'services.tv.feature2': 'Equipment configuration',
    'services.tv.feature3': 'Ongoing assistance',
    'services.business.feature1': 'Needs assessment',
    'services.business.feature2': 'Installation and configuration',
    'services.business.feature3': 'Support and maintenance',
    
    // Benefits (Why Nivra Telecom)
    'benefits.badge': 'Why Nivra Telecom',
    'benefits.title': 'Trust + adoption + stability',
    'benefits.subtitle': 'These aren\'t marketing numbers, they\'re indicators of a service that works in real life.',
    'benefits.stat1.title': 'customer satisfaction',
    'benefits.stat1.desc': 'A standard, not an exception. Less than 2% dissatisfaction, because our processes eliminate errors, oversights and poor installations.',
    'benefits.stat2.title': 'active clients in Quebec',
    'benefits.stat2.desc': 'And still growing. Every new client joins a network of members already supported, activated and locally assisted.',
    'benefits.stat3.title': 'credit check',
    'benefits.stat3.desc': '100% equitable access to essential services. Because a modern telecom provider should connect people, not block them.',
    'benefits.trust.local': 'Quebec-based telecom team',
    'benefits.trust.secure': 'Secured data',
    'benefits.trust.nocredit': 'No credit check',
    'benefits.trust.pricing': 'Competitive pricing',
    'benefits.nocredit.audience': 'Ideal for students, newcomers, and challenging credit history',
    
    // How it works
    'howitworks.badge': 'How it works',
    'howitworks.title': 'Service setup in 3 steps',
    'howitworks.subtitle': 'A simple process to activate your services.',
    'howitworks.step1.title': 'Request',
    'howitworks.step1.desc': 'Explain your needs via the form or by phone.',
    'howitworks.step2.title': 'Processing',
    'howitworks.step2.desc': 'Our team confirms and schedules installation if needed.',
    'howitworks.step3.title': 'Setup',
    'howitworks.step3.desc': 'Everything is configured, you\'re operational.',
    
    // CTA
    'cta.badge': 'Ready to start?',
    'cta.title.order': 'Need to activate a service or fix an issue?',
    'cta.subtitle.order': 'Explain your needs. Our team guides you, schedules installation if needed and ensures follow-up.',
    'cta.phone': 'Contact support',
    
    // Contact Form
    'contact.title': 'Contact',
    'contact.subtitle': 'For activation, installation, service changes or technical support, write to us. We respond quickly.',
    'contact.name': 'Full Name',
    'contact.name.placeholder': 'Your name',
    'contact.email': 'Email',
    'contact.email.placeholder': 'your@email.com',
    'contact.phone': 'Phone',
    'contact.phone.placeholder': '(514) 555-0123',
    'contact.submit': 'Send',
    'contact.sending': 'Sending...',
    'contact.success.title': 'Request received!',
    'contact.success.text': 'Our team will contact you within 1 business day.',
    
    // Footer
    'footer.description': 'Telecom provider in Quebec. Activation, installation and support for home and business.',
    'footer.services': 'Services',
    'footer.support': 'Support',
    'footer.company': 'Company',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Use',
    'footer.refund': 'Refund',
    'footer.rights': 'All rights reserved.',
    'footer.contact': 'Contact us',
    'footer.tracking': 'Request status',
    
    // FAQ
    'faq.title': 'Frequently Asked',
    'faq.title2': 'Questions',
    'faq.subtitle': 'Answers to common questions about Nivra services.',
    'faq.notfound.title': 'Didn\'t find your answer?',
    'faq.notfound.text': 'Our team is here to help.',
    'faq.contact': 'Contact Us',
    
    // FAQ Categories
    'faq.cat.about': 'About Nivra',
    'faq.cat.orders': 'Orders and Appointments',
    'faq.cat.payments': 'Payments and Billing',
    'faq.cat.security': 'Security and Access',
    
    // FAQ Questions - About
    'faq.about.q1': 'What is Nivra?',
    'faq.about.a1': 'Nivra is a telecom provider in Quebec. We offer activation, installation and support for telecom services.',
    'faq.about.q2': 'How does the service setup work?',
    'faq.about.a2': 'You send a request, we confirm your needs, then proceed with activation and installation if needed.',
    'faq.about.q3': 'How is Nivra compensated?',
    'faq.about.a3': 'Nivra is paid by clients (service fees or subscriptions). Clear and transparent pricing.',
    'faq.about.q4': 'Which regions do you serve?',
    'faq.about.a4': 'Nivra offers services in Quebec only.',
    'faq.about.q5': 'What is Nivra?',
    'faq.about.a5': 'Telecom provider in Quebec.',
    
    // FAQ Questions - Orders
    'faq.consult.q1': 'How do I request a Nivra service?',
    'faq.consult.a1': 'Send a request online or call us. Government ID required.',
    'faq.consult.q2': 'Is there a credit check?',
    'faq.consult.a2': 'No. Nivra does not perform credit checks. Only valid ID is required.',
    'faq.consult.q3': 'How do I access my account?',
    'faq.consult.a3': 'Log in via the client portal on browser. No mobile app available.',
    
    // FAQ Questions - Payments
    'faq.pay.q1': 'How can I see my invoices?',
    'faq.pay.a1': 'All invoices and payments are visible in your client portal (browser only).',
    'faq.pay.q2': 'What happens if I don\'t pay by the Bill Cycle?',
    'faq.pay.a2': 'For prepaid services, if unpaid by Bill Cycle date, service is not renewed. No late fees for normal non-renewal. After 90 days, your number may be unrecoverable.',
    'faq.pay.q3': 'How do credits work?',
    'faq.pay.a3': 'Credits are automatically applied to your next invoices.',
    
    // FAQ Questions - Security
    'faq.sec.q1': 'Is my data protected?',
    'faq.sec.a1': 'Yes. Your information is private and accessible only by you and Nivra administrators.',
    'faq.sec.q2': 'How do I access my client account?',
    'faq.sec.a2': 'Via the secure client portal on browser. No mobile app.',
    'faq.sec.q3': 'Who can see my information?',
    'faq.sec.a3': 'Only you and Nivra administrators. No data shared with third parties.',
    
    // About page
    'about.title': 'About',
    'about.title2': 'Nivra',
    'about.subtitle': 'Independent telecom provider in Quebec. Internal Nivra services, client-paid model, no carrier affiliation.',
    'about.mission.title': 'Our Mission',
    'about.mission.text': 'Sell our own telecom services to Quebecers, without intermediary or carrier.',
    'about.values.title': 'Our Values',
    'about.values.independence': 'Total Independence',
    'about.values.transparency': 'Transparent Fees',
    'about.values.clientfirst': 'Client-Paid',
    
    // Booking (now Contact/Quote)
    'booking.title': 'Request a',
    'booking.title2': 'quote',
    'booking.subtitle': 'Describe your needs and we\'ll respond quickly.',
    
    // Auth
    'auth.login': 'Login',
    'auth.signup': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.fullname': 'Full Name',
    'auth.login.btn': 'Log In',
    'auth.signup.btn': 'Sign Up',
    'auth.forgot': 'Forgot password?',
    'auth.noaccount': 'Don\'t have an account?',
    'auth.hasaccount': 'Already have an account?',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.view': 'View',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.none': 'None',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.perMonth': '/ month',
    'common.free': 'Free',
    'common.included': 'Included',
    'common.confirm': 'Confirm',
    'common.submit': 'Submit',
    'common.download': 'Download',
    'common.upload': 'Upload',
    'common.export': 'Export',
    'common.close': 'Close',
    'common.or': 'or',

    // Homepage — Hero (Xfinity-style)
    'xhero.eyebrow': 'No contract. Cancel anytime.',
    'xhero.title': 'Reliable home Internet.',
    'xhero.titleAccent': 'One price. Simple.',
    'xhero.subtitle': 'Transparent plans • Fast activation • Local support in Quebec',
    'xhero.cta': 'Internet from $39/mo — Get Started',
    'xhero.ctaSecondary': 'Talk to an advisor',
    'xhero.bullet1': 'No commitment',
    'xhero.bullet2': 'Fast installation',
    'xhero.bullet3': 'Quebec-based support',

    // Homepage — Product Categories
    'categories.internet': 'Internet',
    'categories.internet.desc': 'High-speed Internet',
    'categories.mobile': 'Mobile',
    'categories.mobile.desc': 'Prepaid mobile plans',
    'categories.tv': 'TV & Streaming',
    'categories.tv.desc': 'Television & entertainment',
    'categories.security': 'Security',
    'categories.security.desc': 'Home security solutions',
    'categories.build': 'Build your plan',
    'categories.build.desc': 'Customize your services',

    // Homepage — Pricing
    'pricing.title': 'Choose your plan',
    'pricing.subtitle': 'Unlimited Internet, no contract',
    'pricing.recommended': 'Recommended',
    'pricing.choose': 'Choose',
    'pricing.disclaimer': 'Taxes extra • Equipment optional if applicable',

    // Homepage — Why Nivra
    'why.title': 'Why choose Nivra',
    'why.nocontract': 'No contract',
    'why.nocontract.desc': 'No long-term commitment. You stay in control.',
    'why.simple': 'Simple process',
    'why.simple.desc': 'Order online, fast installation, service active.',
    'why.support': 'Local support',
    'why.support.desc': 'Quebec-based team, available 7 days a week.',
    'why.fast': 'Fast activation',
    'why.fast.desc': 'Service activated in days, not weeks.',

    // Homepage — How it works
    'how.title': 'How it works',
    'how.step1': 'Choose your plan',
    'how.step1.desc': 'Select the Internet plan that fits your needs.',
    'how.step2': 'Address verification',
    'how.step2.desc': 'We confirm service availability at your address.',
    'how.step3': 'Installation or activation',
    'how.step3.desc': 'A technician installs or activates your service quickly.',
    'how.step4': 'Service active',
    'how.step4.desc': 'Enjoy your Internet connection as soon as it\'s activated.',

    // Homepage — Final CTA
    'finalcta.title': 'Ready to get started?',
    'finalcta.bullet1': 'No contract',
    'finalcta.bullet2': 'Fast setup',
    'finalcta.bullet3': 'Simple process',
    'finalcta.cta': 'Get started now',

    // Errors
    'errors.generic': 'An error occurred. Please try again.',
    'errors.network': 'Connection issue. Check your network.',
    'errors.notFound': 'Page not found',
    'errors.unauthorized': 'Unauthorized access',
    'errors.sessionExpired': 'Your session has expired. Please sign in again.',

    // Portal
    'portal.welcome': 'Welcome',
    'portal.balance': 'Balance',
    'portal.nextPayment': 'Next payment',
    'portal.currentPlan': 'Current plan',
    'portal.usage': 'Usage',
    'portal.invoices': 'Invoices',
    'portal.support': 'Support',
    'portal.settings': 'Settings',

    // Status page
    'status.title': 'System Status',
    'status.allOperational': 'All systems are operating normally.',
    'status.issues': 'Some services are experiencing issues.',
  },
  
  ht: {
    // Navigation - Haitian Creole
    'nav.home': 'Akèy',
    'nav.services': 'Sèvis',
    'nav.about': 'Konsènan',
    'nav.faq': 'FAQ',
    'nav.careers': 'Karyè',
    'nav.contact': 'Kontakte',
    'nav.book': 'Pran Randevou',
    'nav.login': 'Koneksyon',
    'nav.portal': 'Pòtay Kliyan',
    'nav.admin': 'Administrasyon',
    'nav.logout': 'Dekonekte',
    
    // Hero
    'hero.badge': 'Founisè Telekòm Endepandan nan Kebèk',
    'hero.title1': 'Sèvis telekòm ou',
    'hero.title2': 'senplifye',
    'hero.subtitle': 'Nivra vann pwòp sèvis telekòm li nan Kebèk. Modèl kliyan-peye, pa gen afilyasyon carrier, pa gen verifikasyon kredi. ID gouvènman obligatwa.',
    'hero.cta.book': 'Konsiltasyon Gratis',
    'hero.cta.services': 'Wè sèvis nou yo',
    'hero.trust.independent': 'Endepandan',
    'hero.trust.quebec': 'Baze nan Kebèk',
    'hero.trust.nocommission': 'Kliyan-Peye',
    
    // Services
    'services.badge': 'Sèvis Nivra',
    'services.title': 'Sèvis Telekòm Entèn Nivra',
    'services.subtitle': 'Sèvis vann dirèkteman pa Nivra, san entèmedyè oswa afilyasyon carrier.',
    'services.mobile.title': 'Telefòn Mobil',
    'services.mobile.desc': 'Fòfè mobil Nivra adapte ak bezwen ou.',
    'services.internet.title': 'Entènèt Rezidansyèl',
    'services.internet.desc': 'Koneksyon rapid Nivra pou kay ou.',
    'services.tv.title': 'Televizyon',
    'services.tv.desc': 'Fòfè TV Nivra ak chanèl ou chwazi.',
    'services.business.title': 'Solisyon Biznis',
    'services.business.desc': 'Sèvis telekòm Nivra pou biznis Kebèk.',
    'services.cta': 'Rezève yon konsiltasyon',
    
    // Benefits
    'benefits.badge': 'Poukisa Nivra',
    'benefits.title': 'Yon founisè telekòm endepandan',
    'benefits.subtitle': 'Nivra vann pwòp sèvis li. Pa gen afilyasyon carrier, pa gen komisyon ekstèn.',
    'benefits.independent.title': 'Sèvis Entèn',
    'benefits.independent.desc': 'Nivra vann pwòp sèvis telekòm li. Modèl kliyan-peye 100%.',
    'benefits.savings.title': 'Pri Klè',
    'benefits.savings.desc': 'Frè transparan, san sipriz oswa komisyon kache.',
    'benefits.simple.title': 'Pwosesis Senp',
    'benefits.simple.desc': 'Kòmand anliy, ID obligatwa, pa gen verifikasyon kredi.',
    'benefits.support.title': 'Sipò Navigatè',
    'benefits.support.desc': 'Aksè kliyan ak sipò atravè navigatè sèlman (pa gen app mobil).',
    'benefits.stat.clients': 'Kliyan Aktif',
    'benefits.stat.savings': 'Sèvis Nivra',
    'benefits.stat.experience': 'Nan Kebèk',
    
    // How it works
    'howitworks.badge': 'Kijan Li Mache',
    'howitworks.title': 'Yon pwosesis senp an 4 etap',
    'howitworks.subtitle': 'De analiz rive nan sipò, nou senplifye telekominikasyon ou.',
    'howitworks.step1.title': 'Konsiltasyon Gratis',
    'howitworks.step1.desc': 'Apèl 30 minit pou konprann bezwen ou ak sitiyasyon aktyèl ou.',
    'howitworks.step2.title': 'Analiz Pèsonalize',
    'howitworks.step2.desc': 'Etid konplè bezwen ou ak konparezon objektif opsyon disponib yo.',
    'howitworks.step3.title': 'Rekòmandasyon',
    'howitworks.step3.desc': 'Prezantasyon pi bon opsyon yo ak avantaj ak dezavantaj detaye.',
    'howitworks.step4.title': 'Sipò',
    'howitworks.step4.desc': 'Sipò kontinyèl pou aplikasyon ak swivi sèvis ou yo.',
    
    // CTA
    'cta.badge': 'Prè pou kòmanse?',
    'cta.title': 'Optimize telekominikasyon ou jodi a',
    'cta.subtitle': 'Rezève konsiltasyon gratis 30 minit ou epi dekouvri kijan pou ekonomize.',
    'cta.phone': 'Rele Nou',
    'cta.book': 'Rezève Anliy',
    
    // Contact Form
    'contact.title': 'Kontakte Nou',
    'contact.subtitle': 'Ranpli fòm nan epi nou pral reponn ou byen vit.',
    'contact.name': 'Non Konplè',
    'contact.name.placeholder': 'Non ou',
    'contact.email': 'Imèl',
    'contact.email.placeholder': 'ou@imèl.com',
    'contact.phone': 'Telefòn',
    'contact.phone.placeholder': '(514) 555-0123',
    'contact.submit': 'Soumèt',
    'contact.sending': 'Voye...',
    'contact.success.title': 'Mèsi pou mesaj ou!',
    'contact.success.text': 'Nou pral reponn ou pi vit posib.',
    
    // Footer
    'footer.description': 'Founisè telekòm endepandan nan Kebèk. Sèvis Nivra entèn, modèl kliyan-peye, pa gen afilyasyon carrier.',
    'footer.services': 'Sèvis',
    'footer.company': 'Konpayi',
    'footer.legal': 'Legal',
    'footer.privacy': 'Politik Konfidansyalite',
    'footer.terms': 'Kondisyon Itilizasyon',
    'footer.rights': 'Tout dwa rezève.',
    
    // FAQ
    'faq.title': 'Kesyon yo Mande',
    'faq.title2': 'Souvan',
    'faq.subtitle': 'Repons pou kesyon komen sou sèvis Nivra.',
    'faq.notfound.title': 'Ou pa jwenn repons ou?',
    'faq.notfound.text': 'Ekip nou la pou ede ou.',
    'faq.contact': 'Kontakte Nou',
    
    // FAQ Categories
    'faq.cat.about': 'Konsènan Nivra',
    'faq.cat.consultations': 'Kòmand ak Randevou',
    'faq.cat.payments': 'Peman ak Faktirasyon',
    'faq.cat.security': 'Sekirite ak Aksè',
    
    // FAQ Questions
    'faq.about.q1': 'Kisa Nivra ye?',
    'faq.about.a1': 'Nivra se yon founisè telekòm endepandan nan Kebèk. Nou vann pwòp sèvis entèn nou. Pa gen afilyasyon carrier.',
    'faq.about.q2': 'Èske ou travay ak carrier ekstèn?',
    'faq.about.a2': 'Non. Nivra pa gen okenn afilyasyon, patenarya oswa akò ak carrier. Modèl kliyan-peye sèlman.',
    'faq.about.q3': 'Kijan Nivra touche?',
    'faq.about.a3': 'Nivra touche pa kliyan (frè oswa abònman). Pa gen komisyon carrier, pa gen patenarya.',
    'faq.about.q4': 'Ki rejyon nou sèvi?',
    'faq.about.a4': 'Nivra ofri sèvis nan Kebèk sèlman.',
    'faq.consult.q1': 'Kijan mwen kòmande yon sèvis Nivra?',
    'faq.consult.a1': 'Rezève yon konsiltasyon gratis oswa kòmande anliy. ID gouvènman obligatwa.',
    'faq.consult.q2': 'Èske gen verifikasyon kredi?',
    'faq.consult.a2': 'Non. Nivra pa fè verifikasyon kredi. Sèlman ID valid obligatwa.',
    'faq.consult.q3': 'Kijan mwen aksede kont mwen?',
    'faq.consult.a3': 'Konekte atravè pòtay kliyan sou navigatè. Pa gen app mobil disponib.',
    'faq.pay.q1': 'Kijan mwen ka wè fakti mwen yo?',
    'faq.pay.a1': 'Tout fakti ak peman vizib nan pòtay kliyan ou (navigatè sèlman).',
    'faq.pay.q2': 'Kisa ki rive si mwen peye an reta?',
    'faq.pay.a2': 'Yon frè reta 5% aplike nan fakti an reta.',
    'faq.pay.q3': 'Kijan kredi yo fonksyone?',
    'faq.pay.a3': 'Kredi yo aplike otomatikman nan pwochen fakti ou yo.',
    'faq.sec.q1': 'Èske done mwen yo pwoteje?',
    'faq.sec.a1': 'Wi. Enfòmasyon ou prive epi aksesib sèlman pa ou ak administratè Nivra.',
    'faq.sec.q2': 'Kijan mwen aksede kont kliyan mwen?',
    'faq.sec.a2': 'Atravè pòtay kliyan sekirize sou navigatè. Pa gen app mobil.',
    'faq.sec.q3': 'Ki moun ki ka wè enfòmasyon mwen?',
    'faq.sec.a3': 'Sèlman ou ak administratè Nivra. Pa gen done pataje ak tyès pati.',
    
    // About page
    'about.title': 'Konsènan',
    'about.title2': 'Nivra',
    'about.subtitle': 'Founisè telekòm endepandan nan Kebèk. Sèvis Nivra entèn, modèl kliyan-peye, pa gen afilyasyon carrier.',
    'about.mission.title': 'Misyon Nou',
    'about.mission.text': 'Vann pwòp sèvis telekòm nou bay Kebèkwa, san entèmedyè oswa carrier.',
    'about.values.title': 'Valè Nou yo',
    'about.values.independence': 'Endepandans Total',
    'about.values.transparency': 'Frè Transparan',
    'about.values.clientfirst': 'Kliyan-Peye',
    
    // Booking
    'booking.title': 'Rezève',
    'booking.title2': 'konsiltasyon ou',
    'booking.subtitle': 'Chwazi yon lè ki mache pou ou pou konsiltasyon gratis 30 minit ou.',
    
    // Auth
    'auth.login': 'Koneksyon',
    'auth.signup': 'Enskri',
    'auth.email': 'Imèl',
    'auth.password': 'Modpas',
    'auth.fullname': 'Non Konplè',
    'auth.login.btn': 'Konekte',
    'auth.signup.btn': 'Enskri',
    'auth.forgot': 'Bliye modpas?',
    'auth.noaccount': 'Ou pa gen kont?',
    'auth.hasaccount': 'Ou gen deja yon kont?',
    
    // Common
    'common.loading': 'Chajman...',
    'common.error': 'Erè',
    'common.success': 'Siksè',
    'common.save': 'Anrejistre',
    'common.cancel': 'Anile',
    'common.delete': 'Efase',
    'common.edit': 'Modifye',
    'common.view': 'Wè',
    'common.back': 'Retounen',
    'common.next': 'Pwochen',
    'common.previous': 'Anvan',
    'common.search': 'Rechèch',
    'common.filter': 'Filtre',
    'common.all': 'Tout',
    'common.none': 'Okenn',
    'common.yes': 'Wi',
    'common.no': 'Non',
  },
  
  es: {
    // Navigation - Spanish
    'nav.home': 'Inicio',
    'nav.services': 'Servicios',
    'nav.about': 'Acerca de',
    'nav.faq': 'Preguntas Frecuentes',
    'nav.careers': 'Carreras',
    'nav.contact': 'Contacto',
    'nav.book': 'Reservar Cita',
    'nav.login': 'Iniciar Sesión',
    'nav.portal': 'Portal del Cliente',
    'nav.admin': 'Administración',
    'nav.logout': 'Cerrar Sesión',
    
    // Hero
    'hero.badge': 'Corredor de Telecomunicaciones Independiente en Quebec',
    'hero.title1': 'Ahorre en sus',
    'hero.title2': 'telecomunicaciones',
    'hero.subtitle': 'Nivra es un corredor de telecomunicaciones 100% independiente. Nos pagan solo nuestros clientes — nunca los proveedores. Asesoramiento objetivo garantizado.',
    'hero.cta.book': 'Consulta Gratuita',
    'hero.cta.services': 'Descubra nuestros servicios',
    'hero.trust.independent': 'Independiente',
    'hero.trust.quebec': 'Con sede en Quebec',
    'hero.trust.nocommission': 'Sin Comisión',
    
    // Services
    'services.badge': 'Nuestros Servicios',
    'services.title': 'Soluciones de telecomunicaciones adaptadas a sus necesidades',
    'services.subtitle': 'Asesoramiento objetivo e independiente para optimizar sus servicios de telecomunicaciones.',
    'services.mobile.title': 'Telefonía Móvil',
    'services.mobile.desc': 'Análisis objetivo de planes móviles según sus necesidades reales.',
    'services.internet.title': 'Internet Residencial',
    'services.internet.desc': 'Comparación imparcial de ofertas de Internet disponibles en su área.',
    'services.tv.title': 'Televisión',
    'services.tv.desc': 'Asesoramiento personalizado sobre opciones de entretenimiento.',
    'services.business.title': 'Soluciones Empresariales',
    'services.business.desc': 'Soporte completo para optimizar las telecomunicaciones de su empresa.',
    'services.cta': 'Reservar una consulta',
    
    // Benefits
    'benefits.badge': 'Por Qué Nivra',
    'benefits.title': 'La ventaja de un corredor independiente',
    'benefits.subtitle': 'A diferencia de los vendedores de proveedores, trabajamos exclusivamente para usted.',
    'benefits.independent.title': 'Totalmente Independiente',
    'benefits.independent.desc': 'Sin afiliación con proveedores de telecomunicaciones. Asesoramiento 100% objetivo.',
    'benefits.savings.title': 'Ahorros Garantizados',
    'benefits.savings.desc': 'Identificamos las mejores opciones según su perfil y necesidades reales.',
    'benefits.simple.title': 'Proceso Simplificado',
    'benefits.simple.desc': 'Un único punto de contacto para analizar, comparar y apoyarlo.',
    'benefits.support.title': 'Soporte Continuo',
    'benefits.support.desc': 'Soporte dedicado durante todo su recorrido como cliente.',
    'benefits.stat.clients': 'Clientes Satisfechos',
    'benefits.stat.savings': 'Ahorros Promedio',
    'benefits.stat.experience': 'Años de Experiencia',
    
    // How it works
    'howitworks.badge': 'Cómo Funciona',
    'howitworks.title': 'Un proceso simple en 4 pasos',
    'howitworks.subtitle': 'Del análisis al soporte, simplificamos sus telecomunicaciones.',
    'howitworks.step1.title': 'Consulta Gratuita',
    'howitworks.step1.desc': 'Llamada de 30 minutos para entender sus necesidades y situación actual.',
    'howitworks.step2.title': 'Análisis Personalizado',
    'howitworks.step2.desc': 'Estudio completo de sus necesidades y comparación objetiva de opciones disponibles.',
    'howitworks.step3.title': 'Recomendaciones',
    'howitworks.step3.desc': 'Presentación de las mejores opciones con pros y contras detallados.',
    'howitworks.step4.title': 'Soporte',
    'howitworks.step4.desc': 'Soporte continuo para la implementación y seguimiento de sus servicios.',
    
    // CTA
    'cta.badge': '¿Listo para comenzar?',
    'cta.title': 'Optimice sus telecomunicaciones hoy',
    'cta.subtitle': 'Reserve su consulta gratuita de 30 minutos y descubra cómo ahorrar.',
    'cta.phone': 'Llámenos',
    'cta.book': 'Reservar en Línea',
    
    // Contact Form
    'contact.title': 'Contáctenos',
    'contact.subtitle': 'Complete el formulario y le responderemos rápidamente.',
    'contact.name': 'Nombre Completo',
    'contact.name.placeholder': 'Su nombre',
    'contact.email': 'Correo Electrónico',
    'contact.email.placeholder': 'su@correo.com',
    'contact.phone': 'Teléfono',
    'contact.phone.placeholder': '(514) 555-0123',
    'contact.submit': 'Enviar',
    'contact.sending': 'Enviando...',
    'contact.success.title': '¡Gracias por su mensaje!',
    'contact.success.text': 'Le responderemos lo antes posible.',
    
    // Footer
    'footer.description': 'Corredor de telecomunicaciones independiente en Quebec. Asesoramiento objetivo, pagado solo por nuestros clientes.',
    'footer.services': 'Servicios',
    'footer.company': 'Empresa',
    'footer.legal': 'Legal',
    'footer.privacy': 'Política de Privacidad',
    'footer.terms': 'Términos de Uso',
    'footer.rights': 'Todos los derechos reservados.',
    
    // FAQ
    'faq.title': 'Preguntas',
    'faq.title2': 'Frecuentes',
    'faq.subtitle': 'Encuentre respuestas rápidas a las preguntas más comunes sobre nuestros servicios.',
    'faq.notfound.title': '¿No encontró su respuesta?',
    'faq.notfound.text': 'Nuestro equipo está disponible para responder todas sus preguntas y guiarlo en el proceso.',
    'faq.contact': 'Contáctenos',
    
    // FAQ Categories
    'faq.cat.about': 'Acerca de Nivra',
    'faq.cat.consultations': 'Consultas y Citas',
    'faq.cat.payments': 'Pagos y Facturación',
    'faq.cat.security': 'Seguridad y Privacidad',
    
    // FAQ Questions
    'faq.about.q1': '¿Qué es Nivra?',
    'faq.about.a1': 'Nivra es un corredor de telecomunicaciones totalmente independiente con sede en Quebec. Asesoramos a individuos y empresas sobre sus necesidades de telecomunicaciones sin representar a ningún proveedor.',
    'faq.about.q2': '¿Trabajan con proveedores de telecomunicaciones?',
    'faq.about.a2': 'No. Nivra no tiene afiliación, asociación ni acuerdo comercial con compañías de telecomunicaciones como Bell, Rogers, TELUS u otras. No recibimos compensación de ellos.',
    'faq.about.q3': '¿Cómo se compensa a Nivra?',
    'faq.about.a3': 'Nivra es pagado exclusivamente por sus clientes, ya sea a través de tarifas de consulta únicas o suscripciones mensuales. Esta total independencia garantiza asesoramiento 100% objetivo.',
    'faq.about.q4': '¿Qué regiones atienden?',
    'faq.about.a4': 'Actualmente, Nivra ofrece sus servicios solo en Quebec. Planeamos expandir nuestra cobertura en el futuro.',
    'faq.consult.q1': '¿Ofrecen una consulta gratuita?',
    'faq.consult.a1': '¡Sí! Ofrecemos una primera consulta telefónica gratuita de 30 minutos para evaluar sus necesidades y explicar cómo podemos ayudarle.',
    'faq.consult.q2': '¿Cómo reservo una cita?',
    'faq.consult.a2': 'Puede reservar directamente a través de nuestro calendario integrado en la página de reservas. Todo se hace en línea, sin salir de nuestro sitio.',
    'faq.consult.q3': '¿Ofrecen descuentos o promociones?',
    'faq.consult.a3': 'Nivra solo identifica beneficios de empleador a los que pueda tener derecho. No promocionamos ofertas de proveedores ni negociamos descuentos de ellos.',
    'faq.pay.q1': '¿Cómo puedo ver mis facturas y pagos?',
    'faq.pay.a1': 'Todas sus facturas, pagos y créditos son visibles en tiempo real en su portal de cliente. El administrador también ve la misma información.',
    'faq.pay.q2': '¿Qué pasa si pago tarde?',
    'faq.pay.a2': 'Se agrega automáticamente un cargo por mora del 5% a las facturas vencidas. El monto total incluyendo cargos se muestra claramente antes de confirmar su pago.',
    'faq.pay.q3': '¿Cómo funcionan los créditos?',
    'faq.pay.a3': 'Los créditos se aplican automáticamente a sus próximas facturas. Su saldo de crédito es visible en su portal de cliente y se actualiza instantáneamente.',
    'faq.sec.q1': '¿Están protegidos mis datos?',
    'faq.sec.a1': 'Absolutamente. Su información personal y de cuenta es estrictamente privada. No es posible el acceso público y cada cliente solo ve sus propios datos.',
    'faq.sec.q2': '¿Cómo accedo a mi cuenta de cliente?',
    'faq.sec.a2': 'Inicie sesión a través del portal de cliente seguro. Su cuenta muestra sus facturas, pedidos, suscripciones, contratos e historial de pagos.',
    'faq.sec.q3': '¿Quién puede ver mi información?',
    'faq.sec.a3': 'Solo usted y los administradores autorizados de Nivra pueden acceder a sus datos. No se comparte información con terceros ni proveedores de telecomunicaciones.',
    
    // About page
    'about.title': 'Acerca de',
    'about.title2': 'Nivra',
    'about.subtitle': 'Un corredor de telecomunicaciones independiente, dedicado a servir exclusivamente los intereses de sus clientes en Quebec.',
    'about.mission.title': 'Nuestra Misión',
    'about.mission.text': 'Proporcionar asesoramiento de telecomunicaciones 100% objetivo a los quebequenses, sin influencia de proveedores.',
    'about.values.title': 'Nuestros Valores',
    'about.values.independence': 'Independencia Total',
    'about.values.transparency': 'Transparencia Absoluta',
    'about.values.clientfirst': 'Cliente Primero',
    
    // Booking
    'booking.title': 'Reserve su',
    'booking.title2': 'consulta',
    'booking.subtitle': 'Elija un horario que le convenga para su consulta gratuita de 30 minutos.',
    
    // Auth
    'auth.login': 'Iniciar Sesión',
    'auth.signup': 'Registrarse',
    'auth.email': 'Correo Electrónico',
    'auth.password': 'Contraseña',
    'auth.fullname': 'Nombre Completo',
    'auth.login.btn': 'Iniciar Sesión',
    'auth.signup.btn': 'Registrarse',
    'auth.forgot': '¿Olvidó su contraseña?',
    'auth.noaccount': '¿No tiene cuenta?',
    'auth.hasaccount': '¿Ya tiene cuenta?',
    
    // Common
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.view': 'Ver',
    'common.back': 'Atrás',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.all': 'Todos',
    'common.none': 'Ninguno',
    'common.yes': 'Sí',
    'common.no': 'No',
  },
  
  ar: {
    // Navigation - Arabic
    'nav.home': 'الرئيسية',
    'nav.services': 'الخدمات',
    'nav.about': 'من نحن',
    'nav.faq': 'الأسئلة الشائعة',
    'nav.careers': 'الوظائف',
    'nav.contact': 'اتصل بنا',
    'nav.book': 'حجز موعد',
    'nav.login': 'تسجيل الدخول',
    'nav.portal': 'بوابة العميل',
    'nav.admin': 'الإدارة',
    'nav.logout': 'تسجيل الخروج',
    
    // Hero
    'hero.badge': 'وسيط اتصالات مستقل في كيبيك',
    'hero.title1': 'وفر في',
    'hero.title2': 'اتصالاتك',
    'hero.subtitle': 'نيفرا وسيط اتصالات مستقل 100%. نحن نتقاضى أجرنا فقط من عملائنا — وليس من مزودي الخدمة. استشارات موضوعية مضمونة.',
    'hero.cta.book': 'استشارة مجانية',
    'hero.cta.services': 'اكتشف خدماتنا',
    'hero.trust.independent': 'مستقل',
    'hero.trust.quebec': 'مقره في كيبيك',
    'hero.trust.nocommission': 'بدون عمولة',
    
    // Services
    'services.badge': 'خدماتنا',
    'services.title': 'حلول اتصالات مصممة لاحتياجاتك',
    'services.subtitle': 'استشارات موضوعية ومستقلة لتحسين خدمات الاتصالات الخاصة بك.',
    'services.mobile.title': 'الهاتف المحمول',
    'services.mobile.desc': 'تحليل موضوعي لخطط الهاتف المحمول بناءً على احتياجاتك الفعلية.',
    'services.internet.title': 'إنترنت المنزل',
    'services.internet.desc': 'مقارنة محايدة لعروض الإنترنت المتاحة في منطقتك.',
    'services.tv.title': 'التلفزيون',
    'services.tv.desc': 'نصائح مخصصة حول خيارات الترفيه.',
    'services.business.title': 'حلول الأعمال',
    'services.business.desc': 'دعم كامل لتحسين اتصالات عملك.',
    'services.cta': 'حجز استشارة',
    
    // Benefits
    'benefits.badge': 'لماذا نيفرا',
    'benefits.title': 'ميزة الوسيط المستقل',
    'benefits.subtitle': 'على عكس مندوبي مزودي الخدمة، نحن نعمل حصريًا من أجلك.',
    'benefits.independent.title': 'مستقل تمامًا',
    'benefits.independent.desc': 'لا انتماء لمزودي الاتصالات. استشارات موضوعية 100%.',
    'benefits.savings.title': 'توفير مضمون',
    'benefits.savings.desc': 'نحدد أفضل الخيارات بناءً على ملفك الشخصي واحتياجاتك الحقيقية.',
    'benefits.simple.title': 'عملية مبسطة',
    'benefits.simple.desc': 'نقطة اتصال واحدة للتحليل والمقارنة والدعم.',
    'benefits.support.title': 'دعم مستمر',
    'benefits.support.desc': 'دعم مخصص طوال رحلتك كعميل.',
    'benefits.stat.clients': 'عملاء راضون',
    'benefits.stat.savings': 'متوسط التوفير',
    'benefits.stat.experience': 'سنوات الخبرة',
    
    // How it works
    'howitworks.badge': 'كيف يعمل',
    'howitworks.title': 'عملية بسيطة من 4 خطوات',
    'howitworks.subtitle': 'من التحليل إلى الدعم، نبسط اتصالاتك.',
    'howitworks.step1.title': 'استشارة مجانية',
    'howitworks.step1.desc': 'مكالمة 30 دقيقة لفهم احتياجاتك ووضعك الحالي.',
    'howitworks.step2.title': 'تحليل مخصص',
    'howitworks.step2.desc': 'دراسة كاملة لاحتياجاتك ومقارنة موضوعية للخيارات المتاحة.',
    'howitworks.step3.title': 'التوصيات',
    'howitworks.step3.desc': 'عرض أفضل الخيارات مع الإيجابيات والسلبيات المفصلة.',
    'howitworks.step4.title': 'الدعم',
    'howitworks.step4.desc': 'دعم مستمر للتنفيذ ومتابعة خدماتك.',
    
    // CTA
    'cta.badge': 'مستعد للبدء؟',
    'cta.title': 'حسّن اتصالاتك اليوم',
    'cta.subtitle': 'احجز استشارتك المجانية لمدة 30 دقيقة واكتشف كيف توفر.',
    'cta.phone': 'اتصل بنا',
    'cta.book': 'احجز عبر الإنترنت',
    
    // Contact Form
    'contact.title': 'اتصل بنا',
    'contact.subtitle': 'املأ النموذج وسنرد عليك بسرعة.',
    'contact.name': 'الاسم الكامل',
    'contact.name.placeholder': 'اسمك',
    'contact.email': 'البريد الإلكتروني',
    'contact.email.placeholder': 'your@email.com',
    'contact.phone': 'الهاتف',
    'contact.phone.placeholder': '(514) 555-0123',
    'contact.submit': 'إرسال',
    'contact.sending': 'جارٍ الإرسال...',
    'contact.success.title': 'شكرًا لرسالتك!',
    'contact.success.text': 'سنرد عليك في أقرب وقت ممكن.',
    
    // Footer
    'footer.description': 'وسيط اتصالات مستقل في كيبيك. استشارات موضوعية، يدفعها عملاؤنا فقط.',
    'footer.services': 'الخدمات',
    'footer.company': 'الشركة',
    'footer.legal': 'قانوني',
    'footer.privacy': 'سياسة الخصوصية',
    'footer.terms': 'شروط الاستخدام',
    'footer.rights': 'جميع الحقوق محفوظة.',
    
    // FAQ
    'faq.title': 'الأسئلة',
    'faq.title2': 'الشائعة',
    'faq.subtitle': 'اعثر على إجابات سريعة لأكثر الأسئلة شيوعًا حول خدماتنا.',
    'faq.notfound.title': 'لم تجد إجابتك؟',
    'faq.notfound.text': 'فريقنا متاح للإجابة على جميع أسئلتك وإرشادك خلال العملية.',
    'faq.contact': 'اتصل بنا',
    
    // FAQ Categories
    'faq.cat.about': 'حول نيفرا',
    'faq.cat.consultations': 'الاستشارات والمواعيد',
    'faq.cat.payments': 'المدفوعات والفواتير',
    'faq.cat.security': 'الأمان والخصوصية',
    
    // FAQ Questions
    'faq.about.q1': 'ما هي نيفرا؟',
    'faq.about.a1': 'نيفرا هي وسيط اتصالات مستقل تمامًا مقره في كيبيك. نقدم المشورة للأفراد والشركات حول احتياجات الاتصالات دون تمثيل أي مزود.',
    'faq.about.q2': 'هل تعملون مع مزودي الاتصالات؟',
    'faq.about.a2': 'لا. ليس لدى نيفرا أي انتماء أو شراكة أو اتفاق تجاري مع شركات الاتصالات مثل Bell أو Rogers أو TELUS أو غيرها. لا نتلقى أي تعويض منهم.',
    'faq.about.q3': 'كيف يتم تعويض نيفرا؟',
    'faq.about.a3': 'يتم الدفع لنيفرا حصريًا من قبل عملائها، إما من خلال رسوم استشارة لمرة واحدة أو اشتراكات شهرية. هذا الاستقلال التام يضمن استشارات موضوعية 100%.',
    'faq.about.q4': 'ما هي المناطق التي تخدمونها؟',
    'faq.about.a4': 'حاليًا، تقدم نيفرا خدماتها فقط في كيبيك. نخطط لتوسيع تغطيتنا في المستقبل.',
    'faq.consult.q1': 'هل تقدمون استشارة مجانية؟',
    'faq.consult.a1': 'نعم! نقدم استشارة هاتفية مجانية أولى لمدة 30 دقيقة لتقييم احتياجاتك وشرح كيف يمكننا مساعدتك.',
    'faq.consult.q2': 'كيف أحجز موعدًا؟',
    'faq.consult.a2': 'يمكنك الحجز مباشرة من خلال التقويم المدمج في صفحة الحجز. كل شيء يتم عبر الإنترنت، دون مغادرة موقعنا.',
    'faq.consult.q3': 'هل تقدمون خصومات أو عروض؟',
    'faq.consult.a3': 'تحدد نيفرا فقط مزايا صاحب العمل التي قد تكون مؤهلاً لها. نحن لا نروج لعروض مزودي الخدمة ولا نتفاوض على خصومات منهم.',
    'faq.pay.q1': 'كيف يمكنني رؤية فواتيري ومدفوعاتي؟',
    'faq.pay.a1': 'جميع فواتيرك ومدفوعاتك وأرصدتك مرئية في الوقت الفعلي في بوابة العميل الخاصة بك. يرى المسؤول أيضًا نفس المعلومات.',
    'faq.pay.q2': 'ماذا يحدث إذا دفعت متأخرًا؟',
    'faq.pay.a2': 'يتم إضافة رسوم تأخير بنسبة 5% تلقائيًا إلى الفواتير المتأخرة. يتم عرض المبلغ الإجمالي بما في ذلك الرسوم بوضوح قبل تأكيد الدفع.',
    'faq.pay.q3': 'كيف تعمل الأرصدة؟',
    'faq.pay.a3': 'يتم تطبيق الأرصدة تلقائيًا على فواتيرك القادمة. رصيدك مرئي في بوابة العميل ويتم تحديثه فورًا.',
    'faq.sec.q1': 'هل بياناتي محمية؟',
    'faq.sec.a1': 'بالتأكيد. معلوماتك الشخصية وحسابك خاصة تمامًا. لا يمكن الوصول العام وكل عميل يرى بياناته فقط.',
    'faq.sec.q2': 'كيف أصل إلى حساب العميل الخاص بي؟',
    'faq.sec.a2': 'سجل الدخول من خلال بوابة العميل الآمنة. يعرض حسابك فواتيرك وطلباتك واشتراكاتك وعقودك وسجل المدفوعات.',
    'faq.sec.q3': 'من يمكنه رؤية معلوماتي؟',
    'faq.sec.a3': 'فقط أنت ومسؤولو نيفرا المعتمدون يمكنهم الوصول إلى بياناتك. لا تتم مشاركة أي معلومات مع أطراف ثالثة أو مزودي الاتصالات.',
    
    // About page
    'about.title': 'حول',
    'about.title2': 'نيفرا',
    'about.subtitle': 'وسيط اتصالات مستقل، مكرس لخدمة مصالح عملائه حصريًا في كيبيك.',
    'about.mission.title': 'مهمتنا',
    'about.mission.text': 'تقديم استشارات اتصالات موضوعية 100% لسكان كيبيك، دون أي تأثير من مزودي الخدمة.',
    'about.values.title': 'قيمنا',
    'about.values.independence': 'استقلال تام',
    'about.values.transparency': 'شفافية مطلقة',
    'about.values.clientfirst': 'العميل أولاً',
    
    // Booking
    'booking.title': 'احجز',
    'booking.title2': 'استشارتك',
    'booking.subtitle': 'اختر وقتًا يناسبك لاستشارتك المجانية لمدة 30 دقيقة.',
    
    // Auth
    'auth.login': 'تسجيل الدخول',
    'auth.signup': 'التسجيل',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.fullname': 'الاسم الكامل',
    'auth.login.btn': 'تسجيل الدخول',
    'auth.signup.btn': 'التسجيل',
    'auth.forgot': 'نسيت كلمة المرور؟',
    'auth.noaccount': 'ليس لديك حساب؟',
    'auth.hasaccount': 'لديك حساب بالفعل؟',
    
    // Common
    'common.loading': 'جارٍ التحميل...',
    'common.error': 'خطأ',
    'common.success': 'نجاح',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.view': 'عرض',
    'common.back': 'رجوع',
    'common.next': 'التالي',
    'common.previous': 'السابق',
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.all': 'الكل',
    'common.none': 'لا شيء',
    'common.yes': 'نعم',
    'common.no': 'لا',
  },
  
  pt: {
    // Navigation - Portuguese
    'nav.home': 'Início',
    'nav.services': 'Serviços',
    'nav.about': 'Sobre',
    'nav.faq': 'Perguntas Frequentes',
    'nav.careers': 'Carreiras',
    'nav.contact': 'Contato',
    'nav.book': 'Agendar Consulta',
    'nav.login': 'Entrar',
    'nav.portal': 'Portal do Cliente',
    'nav.admin': 'Administração',
    'nav.logout': 'Sair',
    
    // Hero
    'hero.badge': 'Corretor de Telecomunicações Independente em Quebec',
    'hero.title1': 'Economize em suas',
    'hero.title2': 'telecomunicações',
    'hero.subtitle': 'Nivra é um corretor de telecomunicações 100% independente. Somos pagos apenas pelos nossos clientes — nunca pelos provedores. Consultoria objetiva garantida.',
    'hero.cta.book': 'Consulta Gratuita',
    'hero.cta.services': 'Descubra nossos serviços',
    'hero.trust.independent': 'Independente',
    'hero.trust.quebec': 'Sediado em Quebec',
    'hero.trust.nocommission': 'Sem Comissão',
    
    // Services
    'services.badge': 'Nossos Serviços',
    'services.title': 'Soluções de telecomunicações adaptadas às suas necessidades',
    'services.subtitle': 'Consultoria objetiva e independente para otimizar seus serviços de telecomunicações.',
    'services.mobile.title': 'Telefonia Móvel',
    'services.mobile.desc': 'Análise objetiva de planos móveis com base em suas necessidades reais.',
    'services.internet.title': 'Internet Residencial',
    'services.internet.desc': 'Comparação imparcial de ofertas de Internet disponíveis em sua região.',
    'services.tv.title': 'Televisão',
    'services.tv.desc': 'Consultoria personalizada sobre opções de entretenimento.',
    'services.business.title': 'Soluções Empresariais',
    'services.business.desc': 'Suporte completo para otimizar as telecomunicações da sua empresa.',
    'services.cta': 'Agendar uma consulta',
    
    // Benefits
    'benefits.badge': 'Por Que Nivra',
    'benefits.title': 'A vantagem de um corretor independente',
    'benefits.subtitle': 'Diferente dos vendedores de provedores, trabalhamos exclusivamente para você.',
    'benefits.independent.title': 'Totalmente Independente',
    'benefits.independent.desc': 'Sem afiliação com provedores de telecomunicações. Consultoria 100% objetiva.',
    'benefits.savings.title': 'Economia Garantida',
    'benefits.savings.desc': 'Identificamos as melhores opções com base em seu perfil e necessidades reais.',
    'benefits.simple.title': 'Processo Simplificado',
    'benefits.simple.desc': 'Um único ponto de contato para analisar, comparar e apoiar você.',
    'benefits.support.title': 'Suporte Contínuo',
    'benefits.support.desc': 'Suporte dedicado durante toda a sua jornada como cliente.',
    'benefits.stat.clients': 'Clientes Satisfeitos',
    'benefits.stat.savings': 'Economia Média',
    'benefits.stat.experience': 'Anos de Experiência',
    
    // How it works
    'howitworks.badge': 'Como Funciona',
    'howitworks.title': 'Um processo simples em 4 etapas',
    'howitworks.subtitle': 'Da análise ao suporte, simplificamos suas telecomunicações.',
    'howitworks.step1.title': 'Consulta Gratuita',
    'howitworks.step1.desc': 'Ligação de 30 minutos para entender suas necessidades e situação atual.',
    'howitworks.step2.title': 'Análise Personalizada',
    'howitworks.step2.desc': 'Estudo completo de suas necessidades e comparação objetiva das opções disponíveis.',
    'howitworks.step3.title': 'Recomendações',
    'howitworks.step3.desc': 'Apresentação das melhores opções com prós e contras detalhados.',
    'howitworks.step4.title': 'Suporte',
    'howitworks.step4.desc': 'Suporte contínuo para implementação e acompanhamento de seus serviços.',
    
    // CTA
    'cta.badge': 'Pronto para começar?',
    'cta.title': 'Otimize suas telecomunicações hoje',
    'cta.subtitle': 'Agende sua consulta gratuita de 30 minutos e descubra como economizar.',
    'cta.phone': 'Ligue para Nós',
    'cta.book': 'Agendar Online',
    
    // Contact Form
    'contact.title': 'Entre em Contato',
    'contact.subtitle': 'Preencha o formulário e responderemos rapidamente.',
    'contact.name': 'Nome Completo',
    'contact.name.placeholder': 'Seu nome',
    'contact.email': 'E-mail',
    'contact.email.placeholder': 'seu@email.com',
    'contact.phone': 'Telefone',
    'contact.phone.placeholder': '(514) 555-0123',
    'contact.submit': 'Enviar',
    'contact.sending': 'Enviando...',
    'contact.success.title': 'Obrigado pela sua mensagem!',
    'contact.success.text': 'Responderemos o mais rápido possível.',
    
    // Footer
    'footer.description': 'Corretor de telecomunicações independente em Quebec. Consultoria objetiva, paga apenas por nossos clientes.',
    'footer.services': 'Serviços',
    'footer.company': 'Empresa',
    'footer.legal': 'Legal',
    'footer.privacy': 'Política de Privacidade',
    'footer.terms': 'Termos de Uso',
    'footer.rights': 'Todos os direitos reservados.',
    
    // FAQ
    'faq.title': 'Perguntas',
    'faq.title2': 'Frequentes',
    'faq.subtitle': 'Encontre respostas rápidas para as perguntas mais comuns sobre nossos serviços.',
    'faq.notfound.title': 'Não encontrou sua resposta?',
    'faq.notfound.text': 'Nossa equipe está disponível para responder todas as suas perguntas e orientá-lo no processo.',
    'faq.contact': 'Entre em Contato',
    
    // FAQ Categories
    'faq.cat.about': 'Sobre a Nivra',
    'faq.cat.consultations': 'Consultas e Agendamentos',
    'faq.cat.payments': 'Pagamentos e Faturamento',
    'faq.cat.security': 'Segurança e Privacidade',
    
    // FAQ Questions
    'faq.about.q1': 'O que é a Nivra?',
    'faq.about.a1': 'Nivra é uma corretora de telecomunicações totalmente independente sediada em Quebec. Assessoramos indivíduos e empresas sobre suas necessidades de telecomunicações sem representar nenhum provedor.',
    'faq.about.q2': 'Vocês trabalham com provedores de telecomunicações?',
    'faq.about.a2': 'Não. A Nivra não tem afiliação, parceria ou acordo comercial com empresas de telecomunicações como Bell, Rogers, TELUS ou outras. Não recebemos compensação deles.',
    'faq.about.q3': 'Como a Nivra é remunerada?',
    'faq.about.a3': 'A Nivra é paga exclusivamente por seus clientes, seja através de taxas de consulta únicas ou assinaturas mensais. Esta total independência garante consultoria 100% objetiva.',
    'faq.about.q4': 'Quais regiões vocês atendem?',
    'faq.about.a4': 'Atualmente, a Nivra oferece seus serviços apenas em Quebec. Planejamos expandir nossa cobertura no futuro.',
    'faq.consult.q1': 'Vocês oferecem consulta gratuita?',
    'faq.consult.a1': 'Sim! Oferecemos uma primeira consulta telefônica gratuita de 30 minutos para avaliar suas necessidades e explicar como podemos ajudá-lo.',
    'faq.consult.q2': 'Como faço para agendar uma consulta?',
    'faq.consult.a2': 'Você pode agendar diretamente através do nosso calendário integrado na página de agendamento. Tudo é feito online, sem sair do nosso site.',
    'faq.consult.q3': 'Vocês oferecem descontos ou promoções?',
    'faq.consult.a3': 'A Nivra apenas identifica benefícios de empregador aos quais você pode ter direito. Não promovemos ofertas de provedores e não negociamos descontos com eles.',
    'faq.pay.q1': 'Como posso ver minhas faturas e pagamentos?',
    'faq.pay.a1': 'Todas as suas faturas, pagamentos e créditos são visíveis em tempo real no seu portal do cliente. O administrador também vê as mesmas informações.',
    'faq.pay.q2': 'O que acontece se eu pagar com atraso?',
    'faq.pay.a2': 'Uma taxa de atraso de 5% é adicionada automaticamente às faturas vencidas. O valor total incluindo taxas é claramente exibido antes de confirmar seu pagamento.',
    'faq.pay.q3': 'Como funcionam os créditos?',
    'faq.pay.a3': 'Os créditos são aplicados automaticamente às suas próximas faturas. Seu saldo de crédito é visível no seu portal do cliente e atualiza instantaneamente.',
    'faq.sec.q1': 'Meus dados estão protegidos?',
    'faq.sec.a1': 'Absolutamente. Suas informações pessoais e de conta são estritamente privadas. Não é possível acesso público e cada cliente vê apenas seus próprios dados.',
    'faq.sec.q2': 'Como acesso minha conta de cliente?',
    'faq.sec.a2': 'Faça login através do portal do cliente seguro. Sua conta exibe suas faturas, pedidos, assinaturas, contratos e histórico de pagamentos.',
    'faq.sec.q3': 'Quem pode ver minhas informações?',
    'faq.sec.a3': 'Apenas você e os administradores autorizados da Nivra podem acessar seus dados. Nenhuma informação é compartilhada com terceiros ou provedores de telecomunicações.',
    
    // About page
    'about.title': 'Sobre a',
    'about.title2': 'Nivra',
    'about.subtitle': 'Uma corretora de telecomunicações independente, dedicada a servir exclusivamente os interesses de seus clientes em Quebec.',
    'about.mission.title': 'Nossa Missão',
    'about.mission.text': 'Fornecer consultoria de telecomunicações 100% objetiva aos quebequenses, sem influência de provedores.',
    'about.values.title': 'Nossos Valores',
    'about.values.independence': 'Independência Total',
    'about.values.transparency': 'Transparência Absoluta',
    'about.values.clientfirst': 'Cliente em Primeiro',
    
    // Booking
    'booking.title': 'Agende sua',
    'booking.title2': 'consulta',
    'booking.subtitle': 'Escolha um horário que funcione para você para sua consulta gratuita de 30 minutos.',
    
    // Auth
    'auth.login': 'Entrar',
    'auth.signup': 'Cadastrar',
    'auth.email': 'E-mail',
    'auth.password': 'Senha',
    'auth.fullname': 'Nome Completo',
    'auth.login.btn': 'Entrar',
    'auth.signup.btn': 'Cadastrar',
    'auth.forgot': 'Esqueceu a senha?',
    'auth.noaccount': 'Não tem conta?',
    'auth.hasaccount': 'Já tem conta?',
    
    // Common
    'common.loading': 'Carregando...',
    'common.error': 'Erro',
    'common.success': 'Sucesso',
    'common.save': 'Salvar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Excluir',
    'common.edit': 'Editar',
    'common.view': 'Ver',
    'common.back': 'Voltar',
    'common.next': 'Próximo',
    'common.previous': 'Anterior',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.all': 'Todos',
    'common.none': 'Nenhum',
    'common.yes': 'Sim',
    'common.no': 'Não',
  },
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('nivra-language');
    return (saved as Language) || 'fr';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('nivra-language', lang);
    // Set document direction for RTL languages
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key] || translations['fr'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
