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
    'hero.badge': 'Compagnie télécom indépendante au Québec',
    'hero.title1': 'Économisez sur vos',
    'hero.title2': 'télécommunications',
    'hero.subtitle': 'Nivra est une compagnie de télécommunications 100% indépendante. Nous sommes payés uniquement par nos clients — jamais par les fournisseurs. Conseils objectifs garantis.',
    'hero.cta.book': 'Consultation gratuite',
    'hero.cta.services': 'Découvrir nos services',
    'hero.trust.independent': 'Indépendant',
    'hero.trust.quebec': 'Basé au Québec',
    'hero.trust.nocommission': 'Client payeur',
    
    // Services
    'services.badge': 'Nos services',
    'services.title': 'Solutions télécom adaptées à vos besoins',
    'services.subtitle': 'Des conseils objectifs et indépendants pour optimiser vos services de télécommunications.',
    'services.mobile.title': 'Téléphonie mobile',
    'services.mobile.desc': 'Analyse objective des forfaits mobiles selon vos besoins réels.',
    'services.internet.title': 'Internet résidentiel',
    'services.internet.desc': 'Comparaison impartiale des offres Internet disponibles dans votre région.',
    'services.tv.title': 'Télévision',
    'services.tv.desc': 'Conseils personnalisés sur les options de divertissement.',
    'services.business.title': 'Solutions entreprises',
    'services.business.desc': 'Accompagnement complet pour optimiser les télécoms de votre entreprise.',
    'services.cta': 'Réserver une consultation',
    'services.mobile.feature1': 'Forfaits sur mesure',
    'services.mobile.feature2': 'Analyse des besoins',
    'services.mobile.feature3': 'Conseils objectifs',
    'services.internet.feature1': 'Haute vitesse',
    'services.internet.feature2': 'Fibre optique',
    'services.internet.feature3': 'Solutions affaires',
    'services.tv.feature1': 'Chaînes HD',
    'services.tv.feature2': 'Forfaits flexibles',
    'services.tv.feature3': 'Multi-écrans',
    'services.business.feature1': 'Audit complet',
    'services.business.feature2': 'Optimisation coûts',
    'services.business.feature3': 'Support dédié',
    
    // Benefits
    'benefits.badge': 'Pourquoi Nivra',
    'benefits.title': 'L\'avantage d\'une compagnie indépendante',
    'benefits.subtitle': 'Contrairement aux vendeurs de fournisseurs, nous travaillons exclusivement pour vous.',
    'benefits.independent.title': 'Totalement indépendant',
    'benefits.independent.desc': 'Aucune affiliation avec les fournisseurs de télécommunications. Conseils 100% objectifs, modèle client-payeur.',
    'benefits.savings.title': 'Économies garanties',
    'benefits.savings.desc': 'Nous identifions les meilleures options selon votre profil et vos besoins réels.',
    'benefits.simple.title': 'Processus simplifié',
    'benefits.simple.desc': 'Un seul interlocuteur pour analyser, comparer et vous accompagner.',
    'benefits.support.title': 'Accompagnement continu',
    'benefits.support.desc': 'Support dédié tout au long de votre parcours client.',
    'benefits.stat.clients': 'Clients satisfaits',
    'benefits.stat.savings': 'Économies moyennes',
    'benefits.stat.experience': 'Années d\'expertise',
    
    // How it works
    'howitworks.badge': 'Comment ça marche',
    'howitworks.title': 'Un processus simple en 4 étapes',
    'howitworks.subtitle': 'De l\'analyse à l\'accompagnement, nous simplifions vos télécommunications.',
    'howitworks.step1.title': 'Consultation gratuite',
    'howitworks.step1.desc': 'Échange de 30 minutes pour comprendre vos besoins et votre situation actuelle.',
    'howitworks.step2.title': 'Analyse personnalisée',
    'howitworks.step2.desc': 'Étude complète de vos besoins et comparaison objective des options disponibles.',
    'howitworks.step3.title': 'Recommandations',
    'howitworks.step3.desc': 'Présentation des meilleures options avec avantages et inconvénients détaillés.',
    'howitworks.step4.title': 'Accompagnement',
    'howitworks.step4.desc': 'Support continu pour la mise en place et le suivi de vos services.',
    
    // CTA
    'cta.badge': 'Prêt à commencer?',
    'cta.title': 'Optimisez vos télécommunications dès aujourd\'hui',
    'cta.subtitle': 'Réservez votre consultation gratuite de 30 minutes et découvrez comment économiser.',
    'cta.phone': 'Appelez-nous',
    'cta.book': 'Réserver en ligne',
    
    // Contact Form
    'contact.title': 'Contactez-nous',
    'contact.subtitle': 'Remplissez le formulaire et nous vous répondrons rapidement.',
    'contact.name': 'Nom complet',
    'contact.name.placeholder': 'Votre nom',
    'contact.email': 'Courriel',
    'contact.email.placeholder': 'votre@courriel.com',
    'contact.phone': 'Téléphone',
    'contact.phone.placeholder': '(514) 555-0123',
    'contact.submit': 'Envoyer',
    'contact.sending': 'Envoi en cours...',
    'contact.success.title': 'Merci pour votre message!',
    'contact.success.text': 'Nous vous répondrons dans les plus brefs délais.',
    
    // Footer
    'footer.description': 'Compagnie de télécommunications indépendante au Québec. Services Nivra internes, modèle client-payeur, aucune affiliation carrier.',
    'footer.services': 'Services',
    'footer.company': 'Entreprise',
    'footer.legal': 'Légal',
    'footer.privacy': 'Politique de confidentialité',
    'footer.terms': 'Conditions d\'utilisation',
    'footer.rights': 'Tous droits réservés.',
    
    // FAQ
    'faq.title': 'Foire aux',
    'faq.title2': 'questions',
    'faq.subtitle': 'Trouvez rapidement des réponses à vos questions les plus fréquentes sur nos services.',
    'faq.notfound.title': 'Vous n\'avez pas trouvé votre réponse?',
    'faq.notfound.text': 'Notre équipe est disponible pour répondre à toutes vos questions et vous accompagner dans vos démarches.',
    'faq.contact': 'Nous contacter',
    
    // FAQ Categories
    'faq.cat.about': 'À propos de Nivra',
    'faq.cat.consultations': 'Consultations et rendez-vous',
    'faq.cat.payments': 'Paiements et facturation',
    'faq.cat.security': 'Sécurité et confidentialité',
    
    // FAQ Questions - About
    'faq.about.q1': 'Qu\'est-ce que Nivra?',
    'faq.about.a1': 'Nivra est une compagnie de télécommunications entièrement indépendante basée au Québec. Nous vendons des services Nivra internes aux particuliers et entreprises. Aucune affiliation avec des carriers externes.',
    'faq.about.q2': 'Travaillez-vous avec des fournisseurs externes?',
    'faq.about.a2': 'Non. Nivra n\'a aucune affiliation, partenariat ou entente commerciale avec les compagnies de télécommunications externes. Nous vendons nos propres services Nivra, modèle client-payeur.',
    'faq.about.q3': 'Comment Nivra est-il rémunéré?',
    'faq.about.a3': 'Nivra est payé exclusivement par ses clients, soit par des frais de consultation ponctuels, soit par des abonnements mensuels. Modèle client-payeur à 100%, aucune commission carrier.',
    'faq.about.q4': 'Quelles régions desservez-vous?',
    'faq.about.a4': 'Pour le moment, Nivra offre ses services uniquement au Québec. Nous prévoyons élargir notre couverture dans le futur.',
    
    // FAQ Questions - Consultations
    'faq.consult.q1': 'Offrez-vous une consultation gratuite?',
    'faq.consult.a1': 'Oui! Nous offrons une première consultation téléphonique gratuite de 30 minutes pour évaluer vos besoins et vous expliquer comment nous pouvons vous aider.',
    'faq.consult.q2': 'Comment prendre rendez-vous?',
    'faq.consult.a2': 'Vous pouvez réserver directement via notre calendrier intégré sur la page de prise de rendez-vous. Tout se fait en ligne, sans quitter notre site.',
    'faq.consult.q3': 'Proposez-vous des rabais ou promotions?',
    'faq.consult.a3': 'Nivra identifie uniquement les avantages employeur auxquels vous pourriez avoir droit. Nous ne faisons pas la promotion d\'offres de fournisseurs et ne négocions pas de rabais de leur part.',
    
    // FAQ Questions - Payments
    'faq.pay.q1': 'Comment puis-je voir mes factures et paiements?',
    'faq.pay.a1': 'Toutes vos factures, paiements et crédits sont visibles en temps réel dans votre portail client. L\'administrateur voit également les mêmes informations de son côté.',
    'faq.pay.q2': 'Qu\'arrive-t-il si je paie en retard?',
    'faq.pay.a2': 'Des frais de retard de 5% sont automatiquement ajoutés aux factures en souffrance. Le montant total incluant les frais est clairement affiché avant de confirmer votre paiement.',
    'faq.pay.q3': 'Comment fonctionnent les crédits?',
    'faq.pay.a3': 'Les crédits sont appliqués automatiquement à vos prochaines factures. Votre solde de crédits est visible dans votre portail client et se met à jour instantanément.',
    
    // FAQ Questions - Security
    'faq.sec.q1': 'Mes données sont-elles protégées?',
    'faq.sec.a1': 'Absolument. Vos informations personnelles et de compte sont strictement privées. Aucun accès public n\'est possible et chaque client ne voit que ses propres données.',
    'faq.sec.q2': 'Comment accéder à mon compte client?',
    'faq.sec.a2': 'Connectez-vous via le portail client sécurisé. Votre compte affiche vos factures, commandes, abonnements, contrats et historique de paiements.',
    'faq.sec.q3': 'Qui peut voir mes informations?',
    'faq.sec.a3': 'Seuls vous et les administrateurs autorisés de Nivra peuvent accéder à vos données. Aucune information n\'est partagée avec des tiers ou des fournisseurs de télécommunications.',
    
    // About page
    'about.title': 'À propos de',
    'about.title2': 'Nivra',
    'about.subtitle': 'Une compagnie de télécommunications indépendante, vendant des services Nivra internes, dédiée aux clients du Québec. Modèle client-payeur.',
    'about.mission.title': 'Notre mission',
    'about.mission.text': 'Offrir des services télécom Nivra internes 100% indépendants aux Québécois, aucune affiliation carrier.',
    'about.values.title': 'Nos valeurs',
    'about.values.independence': 'Indépendance totale',
    'about.values.transparency': 'Transparence absolue',
    'about.values.clientfirst': 'Client d\'abord',
    
    // Booking
    'booking.title': 'Réservez votre',
    'booking.title2': 'consultation',
    'booking.subtitle': 'Choisissez un créneau qui vous convient pour votre consultation gratuite de 30 minutes.',
    
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
    'hero.badge': 'Independent Telecommunications Company in Quebec',
    'hero.title1': 'Save on your',
    'hero.title2': 'telecommunications',
    'hero.subtitle': 'Nivra is a 100% independent telecommunications company. We are paid only by our clients — never by carriers. Client-paid model guaranteed.',
    'hero.cta.book': 'Free Consultation',
    'hero.cta.services': 'Discover our services',
    'hero.trust.independent': 'Independent',
    'hero.trust.quebec': 'Based in Quebec',
    'hero.trust.nocommission': 'Client-Paid',
    
    // Services
    'services.badge': 'Our Services',
    'services.title': 'Telecom solutions tailored to your needs',
    'services.subtitle': 'Objective and independent advice to optimize your telecommunications services.',
    'services.mobile.title': 'Mobile Phone',
    'services.mobile.desc': 'Objective analysis of mobile plans based on your actual needs.',
    'services.internet.title': 'Residential Internet',
    'services.internet.desc': 'Impartial comparison of Internet offers available in your area.',
    'services.tv.title': 'Television',
    'services.tv.desc': 'Personalized advice on entertainment options.',
    'services.business.title': 'Business Solutions',
    'services.business.desc': 'Complete support to optimize your business telecommunications.',
    'services.cta': 'Book a consultation',
    'services.mobile.feature1': 'Custom plans',
    'services.mobile.feature2': 'Needs analysis',
    'services.mobile.feature3': 'Objective advice',
    'services.internet.feature1': 'High speed',
    'services.internet.feature2': 'Fiber optic',
    'services.internet.feature3': 'Business solutions',
    'services.tv.feature1': 'HD channels',
    'services.tv.feature2': 'Flexible packages',
    'services.tv.feature3': 'Multi-screen',
    'services.business.feature1': 'Complete audit',
    'services.business.feature2': 'Cost optimization',
    'services.business.feature3': 'Dedicated support',
    
    // Benefits
    'benefits.badge': 'Why Nivra',
    'benefits.title': 'The advantage of an independent company',
    'benefits.subtitle': 'Unlike carrier salespeople, we work exclusively for you.',
    'benefits.independent.title': 'Fully Independent',
    'benefits.independent.desc': 'No carrier affiliation. 100% objective advice, client-paid model.',
    'benefits.savings.title': 'Guaranteed Savings',
    'benefits.savings.desc': 'We identify the best options based on your profile and real needs.',
    'benefits.simple.title': 'Simplified Process',
    'benefits.simple.desc': 'One point of contact to analyze, compare and support you.',
    'benefits.support.title': 'Ongoing Support',
    'benefits.support.desc': 'Dedicated support throughout your customer journey.',
    'benefits.stat.clients': 'Satisfied Clients',
    'benefits.stat.savings': 'Average Savings',
    'benefits.stat.experience': 'Years of Expertise',
    
    // How it works
    'howitworks.badge': 'How It Works',
    'howitworks.title': 'A simple 4-step process',
    'howitworks.subtitle': 'From analysis to support, we simplify your telecommunications.',
    'howitworks.step1.title': 'Free Consultation',
    'howitworks.step1.desc': '30-minute call to understand your needs and current situation.',
    'howitworks.step2.title': 'Personalized Analysis',
    'howitworks.step2.desc': 'Complete study of your needs and objective comparison of available options.',
    'howitworks.step3.title': 'Recommendations',
    'howitworks.step3.desc': 'Presentation of the best options with detailed pros and cons.',
    'howitworks.step4.title': 'Support',
    'howitworks.step4.desc': 'Ongoing support for implementation and follow-up of your services.',
    
    // CTA
    'cta.badge': 'Ready to start?',
    'cta.title': 'Optimize your telecommunications today',
    'cta.subtitle': 'Book your free 30-minute consultation and discover how to save.',
    'cta.phone': 'Call Us',
    'cta.book': 'Book Online',
    
    // Contact Form
    'contact.title': 'Contact Us',
    'contact.subtitle': 'Fill out the form and we will get back to you quickly.',
    'contact.name': 'Full Name',
    'contact.name.placeholder': 'Your name',
    'contact.email': 'Email',
    'contact.email.placeholder': 'your@email.com',
    'contact.phone': 'Phone',
    'contact.phone.placeholder': '(514) 555-0123',
    'contact.submit': 'Submit',
    'contact.sending': 'Sending...',
    'contact.success.title': 'Thank you for your message!',
    'contact.success.text': 'We will get back to you as soon as possible.',
    
    // Footer
    'footer.description': 'Independent telecommunications company in Quebec. Internal Nivra services, client-paid model, no carrier affiliation.',
    'footer.services': 'Services',
    'footer.company': 'Company',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Use',
    'footer.rights': 'All rights reserved.',
    
    // FAQ
    'faq.title': 'Frequently Asked',
    'faq.title2': 'Questions',
    'faq.subtitle': 'Find quick answers to the most common questions about our services.',
    'faq.notfound.title': 'Didn\'t find your answer?',
    'faq.notfound.text': 'Our team is available to answer all your questions and guide you through the process.',
    'faq.contact': 'Contact Us',
    
    // FAQ Categories
    'faq.cat.about': 'About Nivra',
    'faq.cat.consultations': 'Consultations and Appointments',
    'faq.cat.payments': 'Payments and Billing',
    'faq.cat.security': 'Security and Privacy',
    
    // FAQ Questions - About
    'faq.about.q1': 'What is Nivra?',
    'faq.about.a1': 'Nivra is a fully independent telecommunications company based in Quebec. We sell internal Nivra services to individuals and businesses. No external carrier affiliation.',
    'faq.about.q2': 'Do you work with external carriers?',
    'faq.about.a2': 'No. Nivra has no affiliation, partnership or commercial agreement with external telecommunications companies. We sell our own Nivra services, client-paid model.',
    'faq.about.q3': 'How is Nivra compensated?',
    'faq.about.a3': 'Nivra is paid exclusively by its clients, either through one-time consultation fees or monthly subscriptions. 100% client-paid model, no carrier commission.',
    'faq.about.q4': 'Which regions do you serve?',
    'faq.about.a4': 'Currently, Nivra offers its services only in Quebec. We plan to expand our coverage in the future.',
    
    // FAQ Questions - Consultations
    'faq.consult.q1': 'Do you offer a free consultation?',
    'faq.consult.a1': 'Yes! We offer a free 30-minute phone consultation to assess your needs and explain how we can help you.',
    'faq.consult.q2': 'How do I book an appointment?',
    'faq.consult.a2': 'You can book directly through our integrated calendar on the booking page. Everything is done online, without leaving our site.',
    'faq.consult.q3': 'Do you offer discounts or promotions?',
    'faq.consult.a3': 'Nivra only identifies employer benefits you may be entitled to. We do not promote provider offers and do not negotiate discounts from them.',
    
    // FAQ Questions - Payments
    'faq.pay.q1': 'How can I see my invoices and payments?',
    'faq.pay.a1': 'All your invoices, payments and credits are visible in real-time in your client portal. The administrator also sees the same information on their end.',
    'faq.pay.q2': 'What happens if I pay late?',
    'faq.pay.a2': 'A 5% late fee is automatically added to overdue invoices. The total amount including fees is clearly displayed before confirming your payment.',
    'faq.pay.q3': 'How do credits work?',
    'faq.pay.a3': 'Credits are automatically applied to your next invoices. Your credit balance is visible in your client portal and updates instantly.',
    
    // FAQ Questions - Security
    'faq.sec.q1': 'Is my data protected?',
    'faq.sec.a1': 'Absolutely. Your personal and account information is strictly private. No public access is possible and each client only sees their own data.',
    'faq.sec.q2': 'How do I access my client account?',
    'faq.sec.a2': 'Log in through the secure client portal. Your account displays your invoices, orders, subscriptions, contracts and payment history.',
    'faq.sec.q3': 'Who can see my information?',
    'faq.sec.a3': 'Only you and authorized Nivra administrators can access your data. No information is shared with third parties or telecom providers.',
    
    // About page
    'about.title': 'About',
    'about.title2': 'Nivra',
    'about.subtitle': 'An independent telecommunications company, selling internal Nivra services, dedicated to Quebec clients. Client-paid model.',
    'about.mission.title': 'Our Mission',
    'about.mission.text': 'Provide 100% independent internal Nivra telecom services to Quebecers, no carrier affiliation.',
    'about.values.title': 'Our Values',
    'about.values.independence': 'Total Independence',
    'about.values.transparency': 'Absolute Transparency',
    'about.values.clientfirst': 'Client First',
    
    // Booking
    'booking.title': 'Book your',
    'booking.title2': 'consultation',
    'booking.subtitle': 'Choose a time slot that works for you for your free 30-minute consultation.',
    
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
    'hero.badge': 'Koutye Telekòm Endepandan nan Kebèk',
    'hero.title1': 'Ekonomize sou',
    'hero.title2': 'telekominikasyon ou',
    'hero.subtitle': 'Nivra se yon koutye telekòm 100% endepandan. Nou touche sèlman pa kliyan nou yo — jamè pa founisè yo. Konsèy objektif garanti.',
    'hero.cta.book': 'Konsiltasyon Gratis',
    'hero.cta.services': 'Dekouvri sèvis nou yo',
    'hero.trust.independent': 'Endepandan',
    'hero.trust.quebec': 'Baze nan Kebèk',
    'hero.trust.nocommission': 'San Komisyon',
    
    // Services
    'services.badge': 'Sèvis Nou yo',
    'services.title': 'Solisyon telekòm adapte ak bezwen ou',
    'services.subtitle': 'Konsèy objektif ak endepandan pou optimize sèvis telekominikasyon ou.',
    'services.mobile.title': 'Telefòn Mobil',
    'services.mobile.desc': 'Analiz objektif plan mobil selon bezwen reyèl ou.',
    'services.internet.title': 'Entènèt Rezidansyèl',
    'services.internet.desc': 'Konparezon enpasyal ofri Entènèt disponib nan zòn ou.',
    'services.tv.title': 'Televizyon',
    'services.tv.desc': 'Konsèy pèsonalize sou opsyon divètisman.',
    'services.business.title': 'Solisyon Biznis',
    'services.business.desc': 'Sipò konplè pou optimize telekòm biznis ou.',
    'services.cta': 'Rezève yon konsiltasyon',
    
    // Benefits
    'benefits.badge': 'Poukisa Nivra',
    'benefits.title': 'Avantaj yon koutye endepandan',
    'benefits.subtitle': 'Kontrèman ak vandè founisè yo, nou travay eksklizvman pou ou.',
    'benefits.independent.title': 'Totalman Endepandan',
    'benefits.independent.desc': 'Okenn afilyasyon ak founisè telekòm. Konsèy 100% objektif.',
    'benefits.savings.title': 'Ekonomi Garanti',
    'benefits.savings.desc': 'Nou idantifye pi bon opsyon yo selon pwofil ou ak bezwen reyèl ou.',
    'benefits.simple.title': 'Pwosesis Senp',
    'benefits.simple.desc': 'Yon sèl kontak pou analize, konpare ak sipòte ou.',
    'benefits.support.title': 'Sipò Kontinyèl',
    'benefits.support.desc': 'Sipò dedye pandan tout vwayaj kliyan ou.',
    'benefits.stat.clients': 'Kliyan Satisfè',
    'benefits.stat.savings': 'Ekonomi Mwayèn',
    'benefits.stat.experience': 'Ane Eksperyans',
    
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
    'footer.description': 'Koutye telekòm endepandan nan Kebèk. Konsèy objektif, peye sèlman pa kliyan nou yo.',
    'footer.services': 'Sèvis',
    'footer.company': 'Konpayi',
    'footer.legal': 'Legal',
    'footer.privacy': 'Politik Konfidansyalite',
    'footer.terms': 'Kondisyon Itilizasyon',
    'footer.rights': 'Tout dwa rezève.',
    
    // FAQ
    'faq.title': 'Kesyon yo Mande',
    'faq.title2': 'Souvan',
    'faq.subtitle': 'Jwenn repons rapid pou kesyon pi komen yo sou sèvis nou yo.',
    'faq.notfound.title': 'Ou pa jwenn repons ou?',
    'faq.notfound.text': 'Ekip nou disponib pou reponn tout kesyon ou yo epi gide ou nan pwosesis la.',
    'faq.contact': 'Kontakte Nou',
    
    // FAQ Categories
    'faq.cat.about': 'Konsènan Nivra',
    'faq.cat.consultations': 'Konsiltasyon ak Randevou',
    'faq.cat.payments': 'Peman ak Faktirasyon',
    'faq.cat.security': 'Sekirite ak Konfidansyalite',
    
    // FAQ Questions
    'faq.about.q1': 'Kisa Nivra ye?',
    'faq.about.a1': 'Nivra se yon koutye telekòm totalman endepandan ki baze nan Kebèk. Nou konseye moun ak biznis sou bezwen telekominikasyon yo san nou pa reprezante okenn founisè.',
    'faq.about.q2': 'Èske ou travay ak founisè telekòm?',
    'faq.about.a2': 'Non. Nivra pa gen okenn afilyasyon, patenarya oswa akò komèsyal ak konpayi telekòm tankou Bell, Rogers, TELUS oswa lòt. Nou pa resevwa okenn konpansasyon nan men yo.',
    'faq.about.q3': 'Kijan Nivra touche?',
    'faq.about.a3': 'Nivra touche eksklizvman pa kliyan li yo, swa atravè frè konsiltasyon yon fwa oswa abònman chak mwa. Endepandans total sa a garanti konsèy 100% objektif.',
    'faq.about.q4': 'Ki rejyon nou sèvi?',
    'faq.about.a4': 'Pou kounye a, Nivra ofri sèvis li yo sèlman nan Kebèk. Nou planifye elaji kouvèti nou nan lavni.',
    'faq.consult.q1': 'Èske nou ofri konsiltasyon gratis?',
    'faq.consult.a1': 'Wi! Nou ofri yon premye konsiltasyon telefòn gratis 30 minit pou evalye bezwen ou epi eksplike kijan nou ka ede ou.',
    'faq.consult.q2': 'Kijan mwen ka pran randevou?',
    'faq.consult.a2': 'Ou ka rezève dirèkteman atravè kalandriye entegre nou an sou paj rezèvasyon an. Tout bagay fèt anliy, san kite sit nou an.',
    'faq.consult.q3': 'Èske nou ofri rabè oswa pwomosyon?',
    'faq.consult.a3': 'Nivra sèlman idantifye avantaj anplwayè ou ka gen dwa. Nou pa fè piblisite ofri founisè epi nou pa negosye rabè nan men yo.',
    'faq.pay.q1': 'Kijan mwen ka wè fakti ak peman mwen yo?',
    'faq.pay.a1': 'Tout fakti, peman ak kredi ou yo vizib an tan reyèl nan pòtay kliyan ou. Administratè a wè menm enfòmasyon yo tou.',
    'faq.pay.q2': 'Kisa ki rive si mwen peye an reta?',
    'faq.pay.a2': 'Yon frè reta 5% ajoute otomatikman nan fakti an reta. Montan total la ak frè yo klèman afiche anvan konfime peman ou.',
    'faq.pay.q3': 'Kijan kredi yo fonksyone?',
    'faq.pay.a3': 'Kredi yo aplike otomatikman nan pwochen fakti ou yo. Balans kredi ou vizib nan pòtay kliyan ou epi li mete ajou imedyatman.',
    'faq.sec.q1': 'Èske done mwen yo pwoteje?',
    'faq.sec.a1': 'Absoliman. Enfòmasyon pèsonèl ak kont ou yo strik prive. Pa gen aksè piblik posib epi chak kliyan wè sèlman pwòp done li.',
    'faq.sec.q2': 'Kijan mwen aksede kont kliyan mwen?',
    'faq.sec.a2': 'Konekte atravè pòtay kliyan sekirize a. Kont ou afiche fakti, kòmand, abònman, kontra ak istwa peman ou.',
    'faq.sec.q3': 'Ki moun ki ka wè enfòmasyon mwen?',
    'faq.sec.a3': 'Sèlman ou ak administratè Nivra otorize ka aksede done ou. Pa gen enfòmasyon pataje ak tyès pati oswa founisè telekòm.',
    
    // About page
    'about.title': 'Konsènan',
    'about.title2': 'Nivra',
    'about.subtitle': 'Yon koutye telekòm endepandan, dedye pou sèvi eksklizvman enterè kliyan li yo nan Kebèk.',
    'about.mission.title': 'Misyon Nou',
    'about.mission.text': 'Bay konsèy telekòm 100% objektif pou Kebèkwa, san okenn enfliyans founisè.',
    'about.values.title': 'Valè Nou yo',
    'about.values.independence': 'Endepandans Total',
    'about.values.transparency': 'Transparans Absoli',
    'about.values.clientfirst': 'Kliyan Avan',
    
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
