import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// MODALITÉS DE SERVICE — NIVRA TELECOM (TEXTE INTÉGRAL)
// Version intégrale étendue – Prépayé à renouvellement mensuel
// Dernière mise à jour : 2026-02-05
// ============================================================================

// Document structure for professional PDF generation
interface DocumentSection {
  type: 'title' | 'subtitle' | 'heading' | 'subheading' | 'paragraph' | 'bullet' | 'warning' | 'separator' | 'annexe';
  text: string;
  level?: number;
}

// Nivra Brand Colors
const COLORS = {
  navy: '#0F172A',
  teal: '#14B8A6',
  blue: '#0066CC',
  lightBlue: '#E0F2FE',
  white: '#FFFFFF',
  gray: '#64748B',
  lightGray: '#F8FAFC',
  darkGray: '#334155',
};

// Parse the document into structured sections
const parseDocument = (): DocumentSection[] => {
  const sections: DocumentSection[] = [];
  
  // Title page content
  sections.push({ type: 'title', text: 'MODALITÉS DE SERVICE' });
  sections.push({ type: 'subtitle', text: 'NIVRA TELECOM' });
  sections.push({ type: 'paragraph', text: 'Version intégrale étendue – Prépayé à renouvellement mensuel (expérience postpayée)' });
  sections.push({ type: 'paragraph', text: 'Dernière mise à jour : 2026-02-05' });
  sections.push({ type: 'paragraph', text: 'Document ID: ND-TOS-2026-02-05' });
  sections.push({ type: 'separator', text: '' });
  
  // Section 1
  sections.push({ type: 'heading', text: '1. PRÉAMBULE, ACCEPTATION ET CHAMP D\'APPLICATION', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les présentes Modalités de service (les « Modalités ») constituent une entente légale contraignante entre Nivra Communications Inc., opérant sous le nom Nivra Telecom (« Nivra », « nous », « notre »), et toute personne physique ou morale (« Client », « vous », « votre ») qui :' });
  sections.push({ type: 'bullet', text: 'crée un compte client' });
  sections.push({ type: 'bullet', text: 'commande un service' });
  sections.push({ type: 'bullet', text: 'effectue un paiement' });
  sections.push({ type: 'bullet', text: 'utilise ou bénéficie d\'un service fourni par Nivra' });
  sections.push({ type: 'paragraph', text: 'En accédant aux Services, en confirmant une commande, en effectuant un paiement ou en utilisant un Service, le Client reconnaît avoir lu, compris et accepté les présentes Modalités, sans réserve.' });
  sections.push({ type: 'paragraph', text: 'Les présentes Modalités s\'appliquent exclusivement aux Services souscrits par le Client et doivent être lues conjointement avec :' });
  sections.push({ type: 'bullet', text: 'le contrat de services' });
  sections.push({ type: 'bullet', text: 'le résumé des renseignements essentiels' });
  sections.push({ type: 'bullet', text: 'les annexes applicables (installation, paiement, support, etc.)' });
  sections.push({ type: 'bullet', text: 'les politiques publiées sur le portail client' });
  
  // Section 2
  sections.push({ type: 'heading', text: '2. DÉFINITIONS ET INTERPRÉTATION', level: 1 });
  sections.push({ type: 'paragraph', text: 'Aux fins des présentes Modalités, les termes suivants ont la signification ci-dessous :' });
  sections.push({ type: 'subheading', text: 'Services' });
  sections.push({ type: 'paragraph', text: 'Ensemble des services de télécommunications offerts par Nivra, incluant notamment Internet, Mobile, Télévision et services connexes.' });
  sections.push({ type: 'subheading', text: 'Client' });
  sections.push({ type: 'paragraph', text: 'Toute personne ou entité ayant souscrit un ou plusieurs Services.' });
  sections.push({ type: 'subheading', text: 'Compte' });
  sections.push({ type: 'paragraph', text: 'Dossier client créé dans les systèmes de Nivra.' });
  sections.push({ type: 'subheading', text: 'Cycle de facturation (Bill Cycle)' });
  sections.push({ type: 'paragraph', text: 'Période contractuelle de trente (30) jours.' });
  sections.push({ type: 'subheading', text: 'Date de cycle' });
  sections.push({ type: 'paragraph', text: 'Jour du mois correspondant à la création du Compte.' });
  sections.push({ type: 'subheading', text: 'Facture mensuelle' });
  sections.push({ type: 'paragraph', text: 'Document généré à titre informatif indiquant les Services actifs et les montants applicables pour le cycle à venir.' });
  sections.push({ type: 'subheading', text: 'Paiement confirmé' });
  sections.push({ type: 'paragraph', text: 'Paiement reçu, validé et accepté par Nivra.' });
  sections.push({ type: 'subheading', text: 'Non-renouvellement' });
  sections.push({ type: 'paragraph', text: 'Absence de paiement confirmé à la date de cycle.' });
  sections.push({ type: 'subheading', text: 'Suspension' });
  sections.push({ type: 'paragraph', text: 'Interruption temporaire d\'un Service à la suite d\'un non-renouvellement.' });
  sections.push({ type: 'subheading', text: 'Annulation' });
  sections.push({ type: 'paragraph', text: 'Désactivation définitive d\'un Service après expiration de la période de récupération.' });
  sections.push({ type: 'paragraph', text: 'Les titres sont fournis à titre indicatif et n\'affectent pas l\'interprétation des présentes.' });
  
  // Section 3
  sections.push({ type: 'heading', text: '3. NATURE DES SERVICES ET ABSENCE DE VÉRIFICATION DE CRÉDIT', level: 1 });
  sections.push({ type: 'paragraph', text: 'Nivra est un fournisseur de services de télécommunications prépayés. Aucune vérification de crédit externe n\'est effectuée lors de la souscription.' });
  sections.push({ type: 'paragraph', text: 'Les Services sont fournis sur la base :' });
  sections.push({ type: 'bullet', text: 'des informations fournies par le Client' });
  sections.push({ type: 'bullet', text: 'de la disponibilité technique' });
  sections.push({ type: 'bullet', text: 'des règles internes de prévention de fraude et de conformité' });
  sections.push({ type: 'paragraph', text: 'Nivra se réserve le droit de refuser, suspendre ou résilier un Service en cas d\'information inexacte, incomplète ou trompeuse.' });
  
  // Section 4
  sections.push({ type: 'heading', text: '4. MODÈLE DE FACTURATION — PRÉPAYÉ À RENOUVELLEMENT MENSUEL', level: 1 });
  sections.push({ type: 'paragraph', text: 'Tous les Services Nivra sont fournis selon un modèle prépayé, avec une présentation de type postpayée.' });
  sections.push({ type: 'paragraph', text: 'Une facture mensuelle est générée et rendue disponible avant chaque cycle afin de :' });
  sections.push({ type: 'bullet', text: 'résumer les Services actifs' });
  sections.push({ type: 'bullet', text: 'afficher les montants applicables' });
  sections.push({ type: 'bullet', text: 'permettre le renouvellement du cycle' });
  sections.push({ type: 'warning', text: 'La facture mensuelle ne constitue pas une dette. Aucun Service n\'est fourni sans paiement confirmé pour le cycle correspondant.' });
  
  // Section 5
  sections.push({ type: 'heading', text: '5. CYCLE DE FACTURATION, DATES ET AJUSTEMENTS', level: 1 });
  sections.push({ type: 'subheading', text: '5.1 Durée du cycle' });
  sections.push({ type: 'paragraph', text: 'Chaque cycle couvre une période de 30 jours, sauf indication contraire.' });
  sections.push({ type: 'subheading', text: '5.2 Date de cycle' });
  sections.push({ type: 'paragraph', text: 'La date de cycle est définie à la création du Compte. Si le mois ne comporte pas ce jour (ex. 29–31), la date est ajustée au dernier jour du mois.' });
  sections.push({ type: 'subheading', text: '5.3 Début du cycle' });
  sections.push({ type: 'paragraph', text: 'Le cycle débute uniquement à la date et à l\'heure de confirmation du paiement.' });
  
  // Section 6
  sections.push({ type: 'heading', text: '6. MODES DE PAIEMENT ET TRAITEMENT', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les modes de paiement acceptés incluent :' });
  sections.push({ type: 'bullet', text: 'Carte de crédit (via fournisseur autorisé)' });
  sections.push({ type: 'bullet', text: 'PayPal' });
  sections.push({ type: 'bullet', text: 'Virement Interac e-Transfer' });
  sections.push({ type: 'paragraph', text: 'Nivra ne conserve aucun numéro complet de carte.' });
  sections.push({ type: 'paragraph', text: 'Des contrôles antifraude peuvent entraîner un statut « en vérification ».' });
  sections.push({ type: 'paragraph', text: 'Un paiement non confirmé ne déclenche aucun renouvellement.' });
  
  // Section 7
  sections.push({ type: 'heading', text: '7. NON-RENOUVELLEMENT, SUSPENSION ET ABSENCE DE DETTE', level: 1 });
  sections.push({ type: 'paragraph', text: 'En l\'absence de paiement confirmé à la date de cycle :' });
  sections.push({ type: 'bullet', text: 'Le cycle n\'est pas renouvelé' });
  sections.push({ type: 'bullet', text: 'Le Service est suspendu automatiquement' });
  sections.push({ type: 'bullet', text: 'Aucun intérêt, frais de retard ou pénalité ne s\'applique' });
  sections.push({ type: 'bullet', text: 'Le Client ne contracte aucune dette envers Nivra' });
  sections.push({ type: 'paragraph', text: 'Le non-renouvellement constitue une interruption volontaire du Service, et non un défaut de paiement postpayé.' });
  
  // Section 8
  sections.push({ type: 'heading', text: '8. PÉRIODE DE SUSPENSION ET ANNULATION APRÈS 90 JOURS', level: 1 });
  sections.push({ type: 'paragraph', text: 'Après suspension :' });
  sections.push({ type: 'bullet', text: 'le Service demeure récupérable pendant 90 jours civils' });
  sections.push({ type: 'bullet', text: 'aucune facturation n\'est générée pendant cette période' });
  sections.push({ type: 'paragraph', text: 'Après 90 jours sans paiement :' });
  sections.push({ type: 'bullet', text: 'le Service est annulé définitivement' });
  sections.push({ type: 'bullet', text: 'les numéros de téléphone peuvent devenir irrécupérables' });
  sections.push({ type: 'bullet', text: 'une nouvelle activation peut être requise' });
  
  // Section 9
  sections.push({ type: 'heading', text: '9. ANNULATION PAR LE CLIENT', level: 1 });
  sections.push({ type: 'paragraph', text: 'Le Client peut annuler un Service à tout moment.' });
  sections.push({ type: 'bullet', text: 'L\'annulation prend effet à la fin du cycle payé' });
  sections.push({ type: 'bullet', text: 'Aucun remboursement partiel n\'est accordé' });
  sections.push({ type: 'bullet', text: 'Exceptions : obligation légale ou erreur de facturation confirmée' });
  
  // Section 10
  sections.push({ type: 'heading', text: '10. INSTALLATION, RENDEZ-VOUS ET ACCÈS', level: 1 });
  sections.push({ type: 'subheading', text: '10.1 Installation standard' });
  sections.push({ type: 'paragraph', text: 'Inclut les opérations normales prévues au plan souscrit.' });
  sections.push({ type: 'subheading', text: '10.2 Installation complexe' });
  sections.push({ type: 'paragraph', text: 'Peut inclure câblage, perçage, configuration avancée ou contraintes d\'accès. Des frais supplémentaires peuvent s\'appliquer.' });
  sections.push({ type: 'subheading', text: '10.3 Absence ou accès impossible' });
  sections.push({ type: 'paragraph', text: 'Une absence, un retard important ou un accès impossible peut entraîner :' });
  sections.push({ type: 'bullet', text: 'frais de déplacement' });
  sections.push({ type: 'bullet', text: 'replanification' });
  sections.push({ type: 'bullet', text: 'annulation de l\'intervention' });
  
  // Section 11
  sections.push({ type: 'heading', text: '11. ÉQUIPEMENT, SIM, eSIM ET GARANTIE', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les équipements fournis peuvent être neufs ou remis à neuf.' });
  sections.push({ type: 'bullet', text: 'Garantie limitée : 1 an' });
  sections.push({ type: 'bullet', text: 'DOA : 14 jours' });
  sections.push({ type: 'bullet', text: 'Exclusions : bris, liquide, perte, vol, modifications non autorisées' });
  sections.push({ type: 'paragraph', text: 'Les cartes SIM et eSIM peuvent entraîner des frais d\'activation ou de remplacement.' });
  
  // Section 12
  sections.push({ type: 'heading', text: '12. CONDITIONS SPÉCIFIQUES — MOBILE', level: 1 });
  sections.push({ type: 'bullet', text: 'Portabilité soumise au fournisseur précédent' });
  sections.push({ type: 'bullet', text: 'Informations exactes requises (nom, numéro, NIP de portage)' });
  sections.push({ type: 'bullet', text: 'Le Client demeure responsable des usages avant blocage en cas de perte/vol' });
  sections.push({ type: 'bullet', text: 'Les frais hors-forfait sont facturés selon l\'usage réel' });
  
  // Section 13
  sections.push({ type: 'heading', text: '13. CONDITIONS SPÉCIFIQUES — INTERNET', level: 1 });
  sections.push({ type: 'bullet', text: 'Vitesses annoncées « jusqu\'à »' });
  sections.push({ type: 'bullet', text: 'Performance dépend du réseau interne du Client' });
  sections.push({ type: 'bullet', text: 'Usage raisonnable applicable même sur forfaits illimités' });
  sections.push({ type: 'bullet', text: 'Service fourni sur une base best effort' });
  
  // Section 14
  sections.push({ type: 'heading', text: '14. CONDITIONS SPÉCIFIQUES — TÉLÉVISION', level: 1 });
  sections.push({ type: 'bullet', text: 'Un forfait Internet actif est requis' });
  sections.push({ type: 'bullet', text: 'Chaînes incluses selon le plan' });
  sections.push({ type: 'bullet', text: 'Chaînes premium facturées en supplément' });
  sections.push({ type: 'bullet', text: 'Certaines modifications nécessitent un ticket support' });
  
  // Section 15
  sections.push({ type: 'heading', text: '15. SUPPORT, TICKETS ET SLA', level: 1 });
  sections.push({ type: 'paragraph', text: 'Le support est offert via : portail client, courriel officiel.' });
  sections.push({ type: 'paragraph', text: 'Les délais annoncés sont des objectifs, non des garanties.' });
  sections.push({ type: 'paragraph', text: 'Un SLA s\'applique uniquement s\'il est expressément indiqué au contrat.' });
  
  // Section 16
  sections.push({ type: 'heading', text: '16. FRAUDE, CONTESTATIONS ET CHARGEBACKS', level: 1 });
  sections.push({ type: 'paragraph', text: 'Avant toute contestation bancaire, le Client doit contacter Nivra.' });
  sections.push({ type: 'paragraph', text: 'En cas de chargeback confirmé :' });
  sections.push({ type: 'bullet', text: 'suspension du Service possible' });
  sections.push({ type: 'bullet', text: 'frais administratifs raisonnables' });
  sections.push({ type: 'bullet', text: 'mesures de recouvrement permises par la loi' });
  sections.push({ type: 'paragraph', text: 'Ces mesures ne s\'appliquent jamais aux non-renouvellements normaux.' });
  
  // Section 17
  sections.push({ type: 'heading', text: '17. IDENTITÉ, SÉCURITÉ ET NIP', level: 1 });
  sections.push({ type: 'bullet', text: 'Une pièce d\'identité valide peut être exigée' });
  sections.push({ type: 'bullet', text: 'Un NIP à 4 chiffres est requis pour certaines opérations' });
  sections.push({ type: 'bullet', text: 'Le Client est responsable de la confidentialité de son NIP' });
  
  // Section 18
  sections.push({ type: 'heading', text: '18. PROTECTION DES RENSEIGNEMENTS PERSONNELS', level: 1 });
  sections.push({ type: 'paragraph', text: 'Nivra protège les renseignements personnels conformément :' });
  sections.push({ type: 'bullet', text: 'à la Loi 25 (Québec)' });
  sections.push({ type: 'bullet', text: 'à la PIPEDA (Canada)' });
  sections.push({ type: 'paragraph', text: 'Les données sont utilisées uniquement pour :' });
  sections.push({ type: 'bullet', text: 'fournir les Services' });
  sections.push({ type: 'bullet', text: 'gérer la facturation' });
  sections.push({ type: 'bullet', text: 'offrir le support' });
  sections.push({ type: 'bullet', text: 'prévenir la fraude' });
  
  // Section 19
  sections.push({ type: 'heading', text: '19. LIMITATION DE RESPONSABILITÉ', level: 1 });
  sections.push({ type: 'paragraph', text: 'Dans la mesure permise par la loi :' });
  sections.push({ type: 'bullet', text: 'Nivra n\'est pas responsable des dommages indirects' });
  sections.push({ type: 'bullet', text: 'la responsabilité totale est limitée aux montants payés pour le cycle concerné' });
  
  // Section 20
  sections.push({ type: 'heading', text: '20. CONFORMITÉ RÉGLEMENTAIRE ET PLAINTES', level: 1 });
  sections.push({ type: 'paragraph', text: 'Nivra vise la conformité aux codes applicables du CRTC.' });
  sections.push({ type: 'paragraph', text: 'Si un différend n\'est pas résolu, le Client peut s\'adresser à la Commission des plaintes relatives aux services de télécom-télévision (CPRST / CCTS).' });
  
  // Section 21
  sections.push({ type: 'heading', text: '21. DROIT APPLICABLE, DIVISIBILITÉ ET INTÉGRALITÉ', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les présentes Modalités sont régies par les lois du Québec et du Canada.' });
  sections.push({ type: 'paragraph', text: 'Si une clause est invalide, les autres demeurent en vigueur.' });
  sections.push({ type: 'paragraph', text: 'Les présentes Modalités et leurs annexes constituent l\'intégralité de l\'entente.' });
  
  // ===== ANNEXE B =====
  sections.push({ type: 'annexe', text: 'ANNEXE B — CONDITIONS SPÉCIFIQUES PAR SERVICE' });
  sections.push({ type: 'paragraph', text: '(Fait partie intégrante des Modalités de service – Nivra Telecom)' });
  
  sections.push({ type: 'heading', text: 'B.1 — DISPOSITIONS GÉNÉRALES APPLICABLES AUX SERVICES', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les présentes conditions spécifiques complètent les Modalités de service générales et s\'appliquent uniquement aux services effectivement souscrits par le Client.' });
  sections.push({ type: 'paragraph', text: 'En cas de divergence, les conditions spécifiques du service concerné prévalent sur les dispositions générales, dans la mesure permise par la loi.' });
  sections.push({ type: 'paragraph', text: 'Les services sont fournis sous réserve :' });
  sections.push({ type: 'bullet', text: 'de la disponibilité technique' });
  sections.push({ type: 'bullet', text: 'de la couverture réseau' });
  sections.push({ type: 'bullet', text: 'des contraintes imposées par des fournisseurs tiers' });
  sections.push({ type: 'bullet', text: 'des règles de sécurité et de conformité internes de Nivra' });
  
  sections.push({ type: 'heading', text: 'B.2 — SERVICES MOBILES', level: 1 });
  sections.push({ type: 'subheading', text: 'B.2.1 Portabilité des numéros' });
  sections.push({ type: 'paragraph', text: 'Le Client peut demander le transfert (portabilité) de son numéro vers Nivra Telecom.' });
  sections.push({ type: 'paragraph', text: 'La portabilité dépend :' });
  sections.push({ type: 'bullet', text: 'du fournisseur cédant' });
  sections.push({ type: 'bullet', text: 'des informations fournies par le Client' });
  sections.push({ type: 'bullet', text: 'des règles réglementaires applicables' });
  sections.push({ type: 'paragraph', text: 'Le Client est responsable de fournir des informations exactes et complètes, incluant :' });
  sections.push({ type: 'bullet', text: 'nom exact au dossier' });
  sections.push({ type: 'bullet', text: 'numéro à transférer' });
  sections.push({ type: 'bullet', text: 'NIP/PIN de portage (si requis)' });
  sections.push({ type: 'paragraph', text: 'Tout refus, délai ou échec causé par des informations inexactes ne saurait engager la responsabilité de Nivra.' });
  
  sections.push({ type: 'subheading', text: 'B.2.2 Carte SIM et eSIM' });
  sections.push({ type: 'paragraph', text: 'Le Client est responsable de la conservation et de la sécurité de sa carte SIM ou eSIM.' });
  sections.push({ type: 'paragraph', text: 'Des frais peuvent s\'appliquer pour :' });
  sections.push({ type: 'bullet', text: 'activation initiale' });
  sections.push({ type: 'bullet', text: 'remplacement' });
  sections.push({ type: 'bullet', text: 'perte, vol ou bris' });
  sections.push({ type: 'bullet', text: 'changement de SIM ou eSIM' });
  sections.push({ type: 'paragraph', text: 'En cas de perte ou de vol, le Client doit aviser Nivra immédiatement afin de bloquer la ligne. Le Client demeure responsable de toute utilisation effectuée avant le blocage.' });
  
  sections.push({ type: 'subheading', text: 'B.2.3 Utilisation, surconsommation et hors-forfait' });
  sections.push({ type: 'paragraph', text: 'Les frais liés à :' });
  sections.push({ type: 'bullet', text: 'l\'itinérance (roaming)' });
  sections.push({ type: 'bullet', text: 'les données excédentaires' });
  sections.push({ type: 'bullet', text: 'les appels internationaux' });
  sections.push({ type: 'bullet', text: 'les numéros spéciaux ou services à valeur ajoutée' });
  sections.push({ type: 'paragraph', text: 'sont facturés selon les tarifs applicables au moment de l\'utilisation, tels qu\'affichés au portail client.' });
  sections.push({ type: 'paragraph', text: 'En cas d\'utilisation inhabituelle ou de risque de fraude, Nivra peut appliquer des mesures de protection, incluant un blocage temporaire ou une suspension.' });
  
  sections.push({ type: 'heading', text: 'B.3 — SERVICES INTERNET', level: 1 });
  sections.push({ type: 'subheading', text: 'B.3.1 Vitesse et performance' });
  sections.push({ type: 'paragraph', text: 'Les vitesses annoncées sont des vitesses maximales théoriques « jusqu\'à ».' });
  sections.push({ type: 'paragraph', text: 'La vitesse réelle peut varier en fonction notamment :' });
  sections.push({ type: 'bullet', text: 'de la congestion du réseau' });
  sections.push({ type: 'bullet', text: 'de la qualité du câblage' });
  sections.push({ type: 'bullet', text: 'du matériel utilisé' });
  sections.push({ type: 'bullet', text: 'du réseau interne du Client' });
  sections.push({ type: 'bullet', text: 'des interférences Wi-Fi' });
  sections.push({ type: 'paragraph', text: 'Sauf mention expresse, les services sont fournis sur une base best effort.' });
  
  sections.push({ type: 'subheading', text: 'B.3.2 Réseau interne du Client' });
  sections.push({ type: 'paragraph', text: 'Le Client est entièrement responsable :' });
  sections.push({ type: 'bullet', text: 'de son réseau interne' });
  sections.push({ type: 'bullet', text: 'de ses appareils' });
  sections.push({ type: 'bullet', text: 'de la configuration Wi-Fi' });
  sections.push({ type: 'bullet', text: 'de la sécurité de ses équipements' });
  sections.push({ type: 'paragraph', text: 'Nivra n\'est pas responsable des limitations de performance ou interruptions causées par l\'équipement ou l\'environnement du Client.' });
  
  sections.push({ type: 'subheading', text: 'B.3.3 Usage raisonnable' });
  sections.push({ type: 'paragraph', text: 'Même lorsqu\'un forfait est présenté comme « illimité », il demeure soumis à une politique d\'usage raisonnable visant à prévenir :' });
  sections.push({ type: 'bullet', text: 'l\'abus' });
  sections.push({ type: 'bullet', text: 'la fraude' });
  sections.push({ type: 'bullet', text: 'la revente non autorisée' });
  sections.push({ type: 'bullet', text: 'les atteintes à la sécurité du réseau' });
  sections.push({ type: 'paragraph', text: 'En cas d\'usage abusif, Nivra peut appliquer des mesures de gestion du trafic ou suspendre le service.' });
  
  sections.push({ type: 'heading', text: 'B.4 — SERVICES DE TÉLÉVISION', level: 1 });
  sections.push({ type: 'subheading', text: 'B.4.1 Dépendance au service Internet' });
  sections.push({ type: 'paragraph', text: 'Le service de télévision Nivra nécessite un forfait Internet actif. En cas de résiliation ou d\'annulation du service Internet, le service TV sera automatiquement résilié.' });
  
  sections.push({ type: 'subheading', text: 'B.4.2 Chaînes incluses et options' });
  sections.push({ type: 'paragraph', text: 'Les chaînes incluses dépendent du plan souscrit. Certains plans incluent :' });
  sections.push({ type: 'bullet', text: 'des chaînes de base obligatoires' });
  sections.push({ type: 'bullet', text: 'des chaînes à sélection libre (« Free-Choice »)' });
  sections.push({ type: 'bullet', text: 'des chaînes premium facturées en supplément' });
  sections.push({ type: 'paragraph', text: 'Les sélections sont consignées au portail client.' });
  
  sections.push({ type: 'subheading', text: 'B.4.3 Modifications et tickets' });
  sections.push({ type: 'paragraph', text: 'Certaines modifications de chaînes nécessitent la création d\'un ticket de support. Les délais de traitement sont indicatifs et peuvent varier selon les contraintes techniques et les systèmes tiers.' });
  
  sections.push({ type: 'heading', text: 'B.5 — INSTALLATION ET INTERVENTIONS TECHNIQUES', level: 1 });
  sections.push({ type: 'subheading', text: 'B.5.1 Installation standard' });
  sections.push({ type: 'paragraph', text: 'L\'installation standard couvre les opérations normales prévues au plan souscrit.' });
  
  sections.push({ type: 'subheading', text: 'B.5.2 Installation complexe' });
  sections.push({ type: 'paragraph', text: 'Une installation est considérée complexe lorsqu\'elle implique :' });
  sections.push({ type: 'bullet', text: 'câblage additionnel' });
  sections.push({ type: 'bullet', text: 'perçage ou traversée de murs' });
  sections.push({ type: 'bullet', text: 'configuration avancée' });
  sections.push({ type: 'bullet', text: 'accès restreint ou conditions particulières' });
  sections.push({ type: 'paragraph', text: 'Des frais supplémentaires peuvent s\'appliquer.' });
  
  sections.push({ type: 'subheading', text: 'B.5.3 Rendez-vous manqué' });
  sections.push({ type: 'paragraph', text: 'En cas d\'absence, d\'accès impossible ou d\'annulation tardive, des frais de déplacement ou de replanification peuvent être facturés.' });
  
  sections.push({ type: 'heading', text: 'B.6 — ÉQUIPEMENT ET GARANTIE', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les équipements fournis par Nivra peuvent être neufs ou remis à neuf.' });
  sections.push({ type: 'subheading', text: 'Garantie' });
  sections.push({ type: 'bullet', text: 'Garantie limitée de un (1) an' });
  sections.push({ type: 'bullet', text: 'Fenêtre DOA : 14 jours' });
  sections.push({ type: 'subheading', text: 'Exclusions' });
  sections.push({ type: 'paragraph', text: 'La garantie ne couvre pas :' });
  sections.push({ type: 'bullet', text: 'dommages causés par le Client' });
  sections.push({ type: 'bullet', text: 'perte ou vol' });
  sections.push({ type: 'bullet', text: 'dommages liquides' });
  sections.push({ type: 'bullet', text: 'bris physiques' });
  sections.push({ type: 'bullet', text: 'modifications non autorisées' });
  
  sections.push({ type: 'heading', text: 'B.7 — SERVICES DE SÉCURITÉ (SI APPLICABLE)', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les services de sécurité fournis par Nivra :' });
  sections.push({ type: 'bullet', text: 'ne remplacent pas les services d\'urgence' });
  sections.push({ type: 'bullet', text: 'peuvent dépendre de l\'électricité, d\'Internet ou du réseau mobile' });
  sections.push({ type: 'paragraph', text: 'En cas d\'urgence, le Client doit contacter les autorités compétentes (911).' });
  
  sections.push({ type: 'heading', text: 'B.8 — SUPPORT, TICKETS ET SLA', level: 1 });
  sections.push({ type: 'paragraph', text: 'Toutes les demandes de support doivent transiter par :' });
  sections.push({ type: 'bullet', text: 'le portail client' });
  sections.push({ type: 'bullet', text: 'les canaux officiels indiqués par Nivra' });
  sections.push({ type: 'paragraph', text: 'Les délais de réponse sont des objectifs, non des garanties.' });
  sections.push({ type: 'paragraph', text: 'Un SLA ne s\'applique que s\'il est expressément prévu au contrat ou au résumé des renseignements essentiels.' });
  sections.push({ type: 'paragraph', text: 'Les tickets peuvent être fermés après un délai raisonnable en l\'absence de réponse du Client.' });
  
  sections.push({ type: 'heading', text: 'B.9 — RESPONSABILITÉS DU CLIENT', level: 1 });
  sections.push({ type: 'paragraph', text: 'Le Client s\'engage à :' });
  sections.push({ type: 'bullet', text: 'fournir des informations exactes' });
  sections.push({ type: 'bullet', text: 'collaborer au diagnostic' });
  sections.push({ type: 'bullet', text: 'permettre l\'accès lorsque requis' });
  sections.push({ type: 'bullet', text: 'utiliser les services conformément aux lois applicables' });
  
  sections.push({ type: 'heading', text: 'B.10 — DISPOSITIONS FINALES DE L\'ANNEXE B', level: 1 });
  sections.push({ type: 'paragraph', text: 'La présente Annexe B fait partie intégrante des Modalités de service.' });
  sections.push({ type: 'paragraph', text: 'Elle est réputée acceptée par le Client dès la souscription, l\'utilisation ou le renouvellement d\'un Service.' });
  
  // ===== ANNEXE C =====
  sections.push({ type: 'annexe', text: 'ANNEXE C — POLITIQUE D\'INSTALLATION ET RENDEZ-VOUS' });
  sections.push({ type: 'paragraph', text: '(Fait partie intégrante des Modalités de service – Nivra Telecom)' });
  
  sections.push({ type: 'heading', text: 'C.1 — PORTÉE DE L\'ANNEXE C', level: 1 });
  sections.push({ type: 'paragraph', text: 'La présente Annexe C encadre l\'ensemble des règles applicables aux installations, interventions techniques, rendez-vous, déplacements de techniciens et accès aux lieux dans le cadre des services fournis par Nivra Telecom.' });
  sections.push({ type: 'paragraph', text: 'Elle s\'applique à tout Client ayant souscrit un service nécessitant :' });
  sections.push({ type: 'bullet', text: 'une installation initiale' });
  sections.push({ type: 'bullet', text: 'une activation sur site' });
  sections.push({ type: 'bullet', text: 'une intervention technique' });
  sections.push({ type: 'bullet', text: 'un déplacement planifié ou non planifié' });
  
  sections.push({ type: 'heading', text: 'C.2 — TYPES D\'INSTALLATION', level: 1 });
  sections.push({ type: 'subheading', text: 'C.2.1 Installation standard' });
  sections.push({ type: 'paragraph', text: 'Une installation est considérée comme standard lorsqu\'elle inclut uniquement :' });
  sections.push({ type: 'bullet', text: 'la connexion aux infrastructures existantes' });
  sections.push({ type: 'bullet', text: 'l\'activation du service' });
  sections.push({ type: 'bullet', text: 'les vérifications usuelles de fonctionnement' });
  sections.push({ type: 'bullet', text: 'la configuration de base prévue au plan souscrit' });
  sections.push({ type: 'paragraph', text: 'L\'installation standard est limitée au temps, aux équipements et aux opérations normalement requis pour un service résidentiel ou commercial simple.' });
  
  sections.push({ type: 'subheading', text: 'C.2.2 Installation complexe' });
  sections.push({ type: 'paragraph', text: 'Une installation est considérée complexe lorsqu\'elle implique, sans s\'y limiter :' });
  sections.push({ type: 'bullet', text: 'câblage additionnel' });
  sections.push({ type: 'bullet', text: 'perçage de murs, planchers ou plafonds' });
  sections.push({ type: 'bullet', text: 'traversée de cloisons' });
  sections.push({ type: 'bullet', text: 'configuration réseau avancée' });
  sections.push({ type: 'bullet', text: 'déplacement ou ajout de prises' });
  sections.push({ type: 'bullet', text: 'accès restreint ou conditions particulières sur le site' });
  sections.push({ type: 'bullet', text: 'contraintes liées à la structure du bâtiment' });
  sections.push({ type: 'paragraph', text: 'Toute installation complexe peut entraîner :' });
  sections.push({ type: 'bullet', text: 'des frais additionnels' });
  sections.push({ type: 'bullet', text: 'une replanification' });
  sections.push({ type: 'bullet', text: 'un refus d\'intervention si les conditions ne sont pas sécuritaires ou conformes' });
  
  sections.push({ type: 'heading', text: 'C.3 — PRÉREQUIS À L\'INSTALLATION', level: 1 });
  sections.push({ type: 'paragraph', text: 'Le Client doit s\'assurer, avant le rendez-vous, que les conditions suivantes sont respectées :' });
  sections.push({ type: 'bullet', text: 'accès libre et sécuritaire au logement ou local' });
  sections.push({ type: 'bullet', text: 'accès au local technique, panneau électrique ou point d\'entrée' });
  sections.push({ type: 'bullet', text: 'prise électrique fonctionnelle' });
  sections.push({ type: 'bullet', text: 'présence d\'une personne majeure autorisée' });
  sections.push({ type: 'bullet', text: 'autorisation écrite du propriétaire ou du syndicat (si requis)' });
  sections.push({ type: 'paragraph', text: 'Tout manquement à ces prérequis peut entraîner :' });
  sections.push({ type: 'bullet', text: 'l\'échec de l\'installation' });
  sections.push({ type: 'bullet', text: 'des frais de déplacement' });
  sections.push({ type: 'bullet', text: 'une replanification à une date ultérieure' });
  
  sections.push({ type: 'heading', text: 'C.4 — RENDEZ-VOUS ET FENÊTRES D\'INTERVENTION', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les rendez-vous sont planifiés dans une fenêtre horaire estimée.' });
  sections.push({ type: 'paragraph', text: 'Les heures fournies sont indicatives et peuvent varier en fonction :' });
  sections.push({ type: 'bullet', text: 'du volume d\'interventions' });
  sections.push({ type: 'bullet', text: 'des contraintes techniques' });
  sections.push({ type: 'bullet', text: 'des conditions de circulation ou météo' });
  sections.push({ type: 'bullet', text: 'de facteurs hors du contrôle de Nivra' });
  sections.push({ type: 'paragraph', text: 'Nivra ne garantit pas une heure exacte d\'arrivée, mais s\'engage à respecter la fenêtre prévue dans la mesure du possible.' });
  
  sections.push({ type: 'heading', text: 'C.5 — ABSENCE, RETARD ET NO-SHOW', level: 1 });
  sections.push({ type: 'subheading', text: 'C.5.1 Absence du Client' });
  sections.push({ type: 'paragraph', text: 'Si le Client est absent au moment du rendez-vous ou refuse l\'accès :' });
  sections.push({ type: 'bullet', text: 'l\'intervention peut être annulée' });
  sections.push({ type: 'bullet', text: 'des frais de déplacement / no-show peuvent être facturés' });
  sections.push({ type: 'bullet', text: 'une nouvelle date devra être planifiée' });
  
  sections.push({ type: 'subheading', text: 'C.5.2 Annulation tardive' });
  sections.push({ type: 'paragraph', text: 'Toute annulation effectuée sans préavis raisonnable peut entraîner des frais, tels qu\'indiqués au résumé de contrat, à la commande ou à la facture.' });
  
  sections.push({ type: 'heading', text: 'C.6 — INSTALLATION IMPOSSIBLE', level: 1 });
  sections.push({ type: 'paragraph', text: 'Une installation peut être jugée impossible pour des raisons incluant :' });
  sections.push({ type: 'bullet', text: 'contraintes techniques' });
  sections.push({ type: 'bullet', text: 'absence d\'infrastructure' });
  sections.push({ type: 'bullet', text: 'accès refusé' });
  sections.push({ type: 'bullet', text: 'conditions dangereuses' });
  sections.push({ type: 'bullet', text: 'non-conformité du site' });
  sections.push({ type: 'paragraph', text: 'Dans ce cas :' });
  sections.push({ type: 'bullet', text: 'l\'intervention peut être clôturée' });
  sections.push({ type: 'bullet', text: 'les frais déjà engagés (déplacement, diagnostic) peuvent être facturés' });
  sections.push({ type: 'bullet', text: 'le service peut être annulé sans activation' });
  
  sections.push({ type: 'heading', text: 'C.7 — RESPONSABILITÉS ET LIMITES', level: 1 });
  sections.push({ type: 'paragraph', text: 'Le technicien n\'est pas autorisé à :' });
  sections.push({ type: 'bullet', text: 'modifier des structures porteuses' });
  sections.push({ type: 'bullet', text: 'effectuer des travaux électriques majeurs' });
  sections.push({ type: 'bullet', text: 'intervenir sur des équipements non liés au service' });
  sections.push({ type: 'bullet', text: 'contourner des règles de sécurité ou de conformité' });
  sections.push({ type: 'paragraph', text: 'Toute demande excédant le cadre de l\'installation prévue peut être refusée.' });
  
  sections.push({ type: 'heading', text: 'C.8 — INTERVENTIONS POST-INSTALLATION', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les interventions ultérieures (déplacement, reconfiguration, diagnostic avancé) peuvent être :' });
  sections.push({ type: 'bullet', text: 'facturées' });
  sections.push({ type: 'bullet', text: 'planifiées selon disponibilité' });
  sections.push({ type: 'bullet', text: 'soumises à validation préalable' });
  
  sections.push({ type: 'heading', text: 'C.9 — ACCEPTATION DE L\'INSTALLATION', level: 1 });
  sections.push({ type: 'paragraph', text: 'À la fin de l\'intervention, le Client reconnaît que :' });
  sections.push({ type: 'bullet', text: 'le service est fonctionnel selon les tests effectués' });
  sections.push({ type: 'bullet', text: 'l\'installation est conforme au plan souscrit' });
  sections.push({ type: 'bullet', text: 'toute anomalie doit être signalée rapidement via le support' });
  
  sections.push({ type: 'heading', text: 'C.10 — DISPOSITIONS FINALES', level: 1 });
  sections.push({ type: 'paragraph', text: 'La présente Annexe C est réputée acceptée dès la confirmation d\'un rendez-vous ou l\'exécution d\'une intervention.' });
  
  // ===== ANNEXE D =====
  sections.push({ type: 'annexe', text: 'ANNEXE D — MODALITÉS DE PAIEMENT ET e-TRANSFER' });
  sections.push({ type: 'paragraph', text: '(Fait partie intégrante des Modalités de service – Nivra Telecom)' });
  
  sections.push({ type: 'heading', text: 'D.1 — PORTÉE DE L\'ANNEXE D', level: 1 });
  sections.push({ type: 'paragraph', text: 'La présente Annexe D encadre les règles applicables aux paiements, moyens de paiement, traitement, vérification, non-confirmation, ainsi qu\'aux paiements Interac e-Transfer.' });
  sections.push({ type: 'paragraph', text: 'Elle s\'applique à l\'ensemble des Services Nivra, dans le cadre du modèle prépayé à renouvellement mensuel.' });
  
  sections.push({ type: 'heading', text: 'D.2 — MOYENS DE PAIEMENT ACCEPTÉS', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les moyens de paiement acceptés incluent :' });
  sections.push({ type: 'bullet', text: 'Carte de crédit (traitée par un fournisseur autorisé)' });
  sections.push({ type: 'bullet', text: 'PayPal' });
  sections.push({ type: 'bullet', text: 'Virement Interac e-Transfer' });
  sections.push({ type: 'paragraph', text: 'Nivra se réserve le droit :' });
  sections.push({ type: 'bullet', text: 'de limiter un mode de paiement' });
  sections.push({ type: 'bullet', text: 'de refuser un paiement' });
  sections.push({ type: 'bullet', text: 'de placer un paiement en vérification' });
  sections.push({ type: 'paragraph', text: 'en cas de risque de fraude ou de non-conformité.' });
  
  sections.push({ type: 'heading', text: 'D.3 — PAIEMENT PAR CARTE DE CRÉDIT', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les paiements par carte :' });
  sections.push({ type: 'bullet', text: 'sont traités par des plateformes sécurisées' });
  sections.push({ type: 'bullet', text: 'ne sont pas stockés intégralement par Nivra' });
  sections.push({ type: 'bullet', text: 'peuvent faire l\'objet de contrôles antifraude' });
  sections.push({ type: 'paragraph', text: 'Un paiement refusé ou annulé ne déclenche aucune activation ni renouvellement.' });
  
  sections.push({ type: 'heading', text: 'D.4 — PAIEMENT PAR PAYPAL', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les paiements PayPal sont soumis :' });
  sections.push({ type: 'bullet', text: 'aux règles de PayPal' });
  sections.push({ type: 'bullet', text: 'au statut de confirmation retourné' });
  sections.push({ type: 'paragraph', text: 'Un paiement PayPal non confirmé ou contesté peut entraîner la suspension du service.' });
  
  sections.push({ type: 'heading', text: 'D.5 — PAIEMENT PAR VIREMENT INTERAC (e-TRANSFER)', level: 1 });
  sections.push({ type: 'subheading', text: 'D.5.1 Instructions générales' });
  sections.push({ type: 'paragraph', text: 'Le Client doit suivre strictement les instructions communiquées par Nivra, incluant :' });
  sections.push({ type: 'bullet', text: 'adresse de destination' });
  sections.push({ type: 'bullet', text: 'montant exact' });
  sections.push({ type: 'bullet', text: 'référence (numéro de compte ou facture)' });
  sections.push({ type: 'bullet', text: 'message requis' });
  
  sections.push({ type: 'subheading', text: 'D.5.2 Statuts de paiement e-Transfer' });
  sections.push({ type: 'paragraph', text: 'Les paiements e-Transfer peuvent passer par les statuts suivants :' });
  sections.push({ type: 'bullet', text: 'Pending (En attente)' });
  sections.push({ type: 'bullet', text: 'In verification (En vérification)' });
  sections.push({ type: 'bullet', text: 'Completed (Confirmé)' });
  sections.push({ type: 'bullet', text: 'Declined (Refusé)' });
  sections.push({ type: 'bullet', text: 'Fraud (Fraude suspectée)' });
  sections.push({ type: 'paragraph', text: 'L\'activation ou le renouvellement est effectué uniquement au statut Confirmé.' });
  
  sections.push({ type: 'subheading', text: 'D.5.3 Erreurs de paiement' });
  sections.push({ type: 'paragraph', text: 'En cas de :' });
  sections.push({ type: 'bullet', text: 'montant incorrect' });
  sections.push({ type: 'bullet', text: 'mauvaise référence' });
  sections.push({ type: 'bullet', text: 'réponse invalide' });
  sections.push({ type: 'paragraph', text: 'le paiement peut être retardé, refusé ou retourné, sans obligation d\'activation.' });
  
  sections.push({ type: 'heading', text: 'D.6 — PAIEMENT EN VÉRIFICATION', level: 1 });
  sections.push({ type: 'paragraph', text: 'Un paiement en vérification :' });
  sections.push({ type: 'bullet', text: 'n\'entraîne aucune pénalité' });
  sections.push({ type: 'bullet', text: 'ne garantit pas l\'activation' });
  sections.push({ type: 'bullet', text: 'peut retarder le renouvellement du service' });
  sections.push({ type: 'paragraph', text: 'Le Client demeure responsable de fournir un paiement valide et conforme.' });
  
  sections.push({ type: 'heading', text: 'D.7 — NON-RENOUVELLEMENT PRÉPAYÉ', level: 1 });
  sections.push({ type: 'paragraph', text: 'En l\'absence de paiement confirmé :' });
  sections.push({ type: 'bullet', text: 'le service n\'est pas renouvelé' });
  sections.push({ type: 'bullet', text: 'il est suspendu automatiquement' });
  sections.push({ type: 'bullet', text: 'aucune dette n\'est créée' });
  sections.push({ type: 'bullet', text: 'aucun intérêt ne s\'applique' });
  
  sections.push({ type: 'heading', text: 'D.8 — CONTESTATIONS ET CHARGEBACKS', level: 1 });
  sections.push({ type: 'paragraph', text: 'Avant toute contestation bancaire, le Client doit contacter le support Nivra.' });
  sections.push({ type: 'paragraph', text: 'En cas de contestation ou chargeback confirmé :' });
  sections.push({ type: 'bullet', text: 'le service peut être suspendu' });
  sections.push({ type: 'bullet', text: 'des frais administratifs raisonnables peuvent s\'appliquer' });
  sections.push({ type: 'bullet', text: 'des mesures de recouvrement peuvent être entreprises, dans la mesure permise par la loi' });
  sections.push({ type: 'paragraph', text: 'Ces mesures ne s\'appliquent pas aux non-renouvellements normaux.' });
  
  sections.push({ type: 'heading', text: 'D.9 — PREUVES ET TRAÇABILITÉ', level: 1 });
  sections.push({ type: 'paragraph', text: 'Le Client reconnaît que peuvent servir de preuve :' });
  sections.push({ type: 'bullet', text: 'confirmations de paiement' });
  sections.push({ type: 'bullet', text: 'statuts e-Transfer' });
  sections.push({ type: 'bullet', text: 'journaux techniques' });
  sections.push({ type: 'bullet', text: 'factures' });
  sections.push({ type: 'bullet', text: 'communications via le portail ou courriel' });
  
  sections.push({ type: 'heading', text: 'D.10 — DISPOSITIONS FINALES', level: 1 });
  sections.push({ type: 'paragraph', text: 'La présente Annexe D est réputée acceptée dès qu\'un paiement est effectué ou tenté auprès de Nivra Telecom.' });
  
  // ===== ANNEXE E =====
  sections.push({ type: 'annexe', text: 'ANNEXE E — SUPPORT, TICKETS, SLA ENTREPRISE' });
  sections.push({ type: 'paragraph', text: '(Fait partie intégrante des Modalités de service – Nivra Telecom)' });
  
  sections.push({ type: 'heading', text: 'E.1 — PORTÉE ET OBJECTIF DE L\'ANNEXE E', level: 1 });
  sections.push({ type: 'paragraph', text: 'La présente Annexe E encadre les règles applicables au support technique, à la gestion des tickets, aux délais de réponse, ainsi qu\'aux engagements de niveau de service (SLA) lorsqu\'un plan Entreprise ou B2B est souscrit.' });
  sections.push({ type: 'paragraph', text: 'Elle s\'applique :' });
  sections.push({ type: 'bullet', text: 'à tous les Clients utilisant le support Nivra' });
  sections.push({ type: 'bullet', text: 'et spécifiquement aux Clients Entreprise bénéficiant d\'un SLA contractuel, lorsque mentionné au contrat ou au résumé des renseignements essentiels' });
  sections.push({ type: 'paragraph', text: 'À défaut d\'un SLA expressément indiqué, les services sont fournis sur une base best effort.' });
  
  sections.push({ type: 'heading', text: 'E.2 — CANAUX DE SUPPORT OFFICIELS', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les communications avec Nivra doivent transiter par les canaux officiels suivants :' });
  sections.push({ type: 'subheading', text: 'Portail client (méthode prioritaire)' });
  sections.push({ type: 'paragraph', text: 'Création et suivi de tickets, notifications, pièces jointes.' });
  sections.push({ type: 'subheading', text: 'Courriel de support' });
  sections.push({ type: 'paragraph', text: 'Support@nivra-telecom.ca' });
  sections.push({ type: 'subheading', text: 'Autres canaux (chat, téléphone)' });
  sections.push({ type: 'paragraph', text: 'Lorsque disponibles et indiqués au portail.' });
  sections.push({ type: 'paragraph', text: 'Les demandes transmises par des canaux non officiels peuvent ne pas être traitées.' });
  
  sections.push({ type: 'heading', text: 'E.3 — SYSTÈME DE TICKETS', level: 1 });
  sections.push({ type: 'subheading', text: 'E.3.1 Création d\'un ticket' });
  sections.push({ type: 'paragraph', text: 'Toute demande de support, incident ou question doit faire l\'objet d\'un ticket contenant :' });
  sections.push({ type: 'bullet', text: 'une description claire du problème' });
  sections.push({ type: 'bullet', text: 'le service concerné' });
  sections.push({ type: 'bullet', text: 'toute information ou preuve pertinente (photos, messages d\'erreur, tests)' });
  sections.push({ type: 'paragraph', text: 'Un ticket incomplet peut retarder le traitement.' });
  
  sections.push({ type: 'subheading', text: 'E.3.2 Statuts de tickets' });
  sections.push({ type: 'paragraph', text: 'Les tickets suivent généralement les statuts suivants :' });
  sections.push({ type: 'bullet', text: 'Open (Ouvert) : ticket créé, en attente de prise en charge' });
  sections.push({ type: 'bullet', text: 'In Progress (En cours) : analyse ou intervention en cours' });
  sections.push({ type: 'bullet', text: 'Waiting for Client (En attente du client) : informations requises' });
  sections.push({ type: 'bullet', text: 'Resolved (Résolu) : problème corrigé ou solution fournie' });
  sections.push({ type: 'bullet', text: 'Closed (Fermé) : ticket clôturé' });
  
  sections.push({ type: 'subheading', text: 'E.3.3 Fermeture automatique' });
  sections.push({ type: 'paragraph', text: 'Un ticket peut être fermé automatiquement si le Client :' });
  sections.push({ type: 'bullet', text: 'ne répond pas aux demandes d\'information' });
  sections.push({ type: 'bullet', text: 'ne fournit pas les éléments requis' });
  sections.push({ type: 'paragraph', text: 'pendant une période raisonnable (ex. 7 jours).' });
  sections.push({ type: 'paragraph', text: 'Un ticket fermé peut être rouvert sur demande.' });
  
  sections.push({ type: 'heading', text: 'E.4 — PRIORISATION DES INCIDENTS', level: 1 });
  sections.push({ type: 'paragraph', text: 'Les incidents sont classés selon leur impact :' });
  sections.push({ type: 'bullet', text: 'P1 – Critique : service entièrement indisponible (Entreprise)' });
  sections.push({ type: 'bullet', text: 'P2 – Majeur : dégradation importante' });
  sections.push({ type: 'bullet', text: 'P3 – Standard : incident partiel ou intermittent' });
  sections.push({ type: 'bullet', text: 'P4 – Mineur / Demande : information, configuration, changement' });
  sections.push({ type: 'paragraph', text: 'La priorité détermine l\'ordre de traitement et les délais cibles.' });
  
  sections.push({ type: 'heading', text: 'E.5 — DÉLAIS DE RÉPONSE (OBJECTIFS GÉNÉRAUX)', level: 1 });
  sections.push({ type: 'paragraph', text: 'Sauf SLA spécifique, Nivra vise les objectifs suivants sans garantie :' });
  sections.push({ type: 'bullet', text: 'Première réponse : 24 heures ouvrables' });
  sections.push({ type: 'bullet', text: 'Résolution standard : 48 à 72 heures ouvrables' });
  sections.push({ type: 'bullet', text: 'Modifications TV / configuration : 2 à 24 heures' });
  sections.push({ type: 'bullet', text: 'Incidents critiques : traitement prioritaire lorsque possible' });
  sections.push({ type: 'paragraph', text: 'Les délais peuvent varier selon :' });
  sections.push({ type: 'bullet', text: 'la complexité' });
  sections.push({ type: 'bullet', text: 'la collaboration du Client' });
  sections.push({ type: 'bullet', text: 'les dépendances à des fournisseurs tiers' });
  
  sections.push({ type: 'heading', text: 'E.6 — SLA ENTREPRISE (SI APPLICABLE)', level: 1 });
  sections.push({ type: 'subheading', text: 'E.6.1 Applicabilité' });
  sections.push({ type: 'paragraph', text: 'Un SLA Entreprise s\'applique uniquement si :' });
  sections.push({ type: 'bullet', text: 'explicitement indiqué au contrat' });
  sections.push({ type: 'bullet', text: 'mentionné au résumé des renseignements essentiels' });
  sections.push({ type: 'bullet', text: 'prévu dans une annexe SLA dédiée' });
  sections.push({ type: 'paragraph', text: 'À défaut, aucun SLA garanti ne s\'applique.' });
  
  sections.push({ type: 'subheading', text: 'E.6.2 Paramètres SLA' });
  sections.push({ type: 'paragraph', text: 'Selon le plan Entreprise souscrit, le SLA peut inclure :' });
  sections.push({ type: 'bullet', text: 'heures de support étendues' });
  sections.push({ type: 'bullet', text: 'délais de réponse garantis' });
  sections.push({ type: 'bullet', text: 'délais de rétablissement ciblés' });
  sections.push({ type: 'bullet', text: 'priorisation P1/P2' });
  sections.push({ type: 'bullet', text: 'crédits de service conditionnels' });
  sections.push({ type: 'paragraph', text: 'Les paramètres précis sont ceux indiqués au contrat.' });
  
  sections.push({ type: 'subheading', text: 'E.6.3 Exclusions SLA' });
  sections.push({ type: 'paragraph', text: 'Le SLA ne s\'applique pas aux interruptions causées par :' });
  sections.push({ type: 'bullet', text: 'force majeure' });
  sections.push({ type: 'bullet', text: 'pannes électriques' });
  sections.push({ type: 'bullet', text: 'problèmes du réseau interne du Client' });
  sections.push({ type: 'bullet', text: 'équipements non fournis par Nivra' });
  sections.push({ type: 'bullet', text: 'actes du Client ou tiers' });
  sections.push({ type: 'bullet', text: 'maintenance planifiée ou urgente' });
  
  sections.push({ type: 'heading', text: 'E.7 — OBLIGATIONS DU CLIENT', level: 1 });
  sections.push({ type: 'paragraph', text: 'Le Client s\'engage à :' });
  sections.push({ type: 'bullet', text: 'fournir des informations exactes et complètes' });
  sections.push({ type: 'bullet', text: 'permettre l\'accès lorsque requis' });
  sections.push({ type: 'bullet', text: 'effectuer les tests demandés' });
  sections.push({ type: 'bullet', text: 'collaborer au diagnostic' });
  sections.push({ type: 'paragraph', text: 'Le non-respect de ces obligations peut :' });
  sections.push({ type: 'bullet', text: 'retarder la résolution' });
  sections.push({ type: 'bullet', text: 'suspendre le traitement du ticket' });
  sections.push({ type: 'bullet', text: 'invalider un SLA' });
  
  sections.push({ type: 'heading', text: 'E.8 — CHANGEMENTS, CONFIGURATIONS ET DEMANDES ADMIN', level: 1 });
  sections.push({ type: 'paragraph', text: 'Certaines demandes (ex. changement de plan, chaînes TV, configuration réseau) :' });
  sections.push({ type: 'bullet', text: 'peuvent nécessiter une validation administrative' });
  sections.push({ type: 'bullet', text: 'peuvent entraîner des délais additionnels' });
  sections.push({ type: 'bullet', text: 'peuvent être facturées selon la nature de la demande' });
  
  sections.push({ type: 'heading', text: 'E.9 — PREUVES TECHNIQUES ET TRAÇABILITÉ', level: 1 });
  sections.push({ type: 'paragraph', text: 'Le Client reconnaît que peuvent servir de preuves en cas de litige :' });
  sections.push({ type: 'bullet', text: 'journaux techniques (logs)' });
  sections.push({ type: 'bullet', text: 'statuts de tickets' });
  sections.push({ type: 'bullet', text: 'confirmations d\'activation' });
  sections.push({ type: 'bullet', text: 'preuves de livraison ou d\'intervention' });
  sections.push({ type: 'bullet', text: 'communications via le portail ou courriel' });
  
  sections.push({ type: 'heading', text: 'E.10 — ENREGISTREMENTS ET QUALITÉ', level: 1 });
  sections.push({ type: 'paragraph', text: 'Nivra peut, lorsque permis par la loi :' });
  sections.push({ type: 'bullet', text: 'enregistrer certaines communications' });
  sections.push({ type: 'bullet', text: 'analyser les tickets à des fins de qualité' });
  sections.push({ type: 'bullet', text: 'utiliser des données agrégées pour améliorer ses services' });
  sections.push({ type: 'paragraph', text: 'Un avis est donné lorsque requis.' });
  
  sections.push({ type: 'heading', text: 'E.11 — PLAINTES INTERNES', level: 1 });
  sections.push({ type: 'paragraph', text: 'Avant tout recours externe, le Client doit :' });
  sections.push({ type: 'bullet', text: 'ouvrir un ticket de plainte' });
  sections.push({ type: 'bullet', text: 'décrire précisément la situation' });
  sections.push({ type: 'bullet', text: 'permettre une analyse interne' });
  sections.push({ type: 'paragraph', text: 'Nivra vise un traitement équitable et documenté des plaintes.' });
  
  sections.push({ type: 'heading', text: 'E.12 — RECOURS EXTERNES (CPRST / CCTS)', level: 1 });
  sections.push({ type: 'paragraph', text: 'Si une plainte n\'est pas résolue à la satisfaction du Client, celui-ci peut contacter :' });
  sections.push({ type: 'paragraph', text: 'Commission des plaintes relatives aux services de télécom-télévision (CPRST / CCTS)' });
  sections.push({ type: 'paragraph', text: 'Organisme indépendant de résolution des plaintes au Canada.' });
  sections.push({ type: 'paragraph', text: 'Les coordonnées et procédures sont disponibles sur le site officiel du CPRST.' });
  
  sections.push({ type: 'heading', text: 'E.13 — LIMITATION ET NON-GARANTIE', level: 1 });
  sections.push({ type: 'paragraph', text: 'Sauf SLA expressément prévu :' });
  sections.push({ type: 'bullet', text: 'les délais sont indicatifs' });
  sections.push({ type: 'bullet', text: 'aucune garantie de temps de rétablissement n\'est accordée' });
  sections.push({ type: 'bullet', text: 'le support est fourni selon une obligation de moyens' });
  
  sections.push({ type: 'heading', text: 'E.14 — ACCEPTATION ET INTÉGRALITÉ', level: 1 });
  sections.push({ type: 'paragraph', text: 'La présente Annexe E fait partie intégrante des Modalités de service.' });
  sections.push({ type: 'paragraph', text: 'Elle est réputée acceptée dès :' });
  sections.push({ type: 'bullet', text: 'l\'utilisation du support' });
  sections.push({ type: 'bullet', text: 'la création d\'un ticket' });
  sections.push({ type: 'bullet', text: 'la souscription à un plan Entreprise' });
  
  return sections;
};

// Generate professional PDF with Nivra branding
const generateProfessionalPDF = (orderId: string): string => {
  const sections = parseDocument();
  const date = new Date().toLocaleDateString('fr-CA');
  
  // PDF dimensions in points (Letter: 612x792)
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 50;
  const marginRight = 50;
  const marginTop = 80;
  const marginBottom = 60;
  const contentWidth = pageWidth - marginLeft - marginRight;
  
  // Font sizes
  const fontSizeTitle = 24;
  const fontSizeSubtitle = 18;
  const fontSizeHeading = 12;
  const fontSizeSubheading = 10;
  const fontSizeBody = 9;
  const fontSizeBullet = 9;
  const lineHeight = 14;
  
  // Track pages
  const pages: string[] = [];
  let currentY = pageHeight - marginTop;
  let currentPage = 1;
  let pageContent = '';
  
  // Helper to escape text for PDF
  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/'/g, "'")
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/"/g, '"')
      .replace(/–/g, '-')
      .replace(/—/g, '-')
      .replace(/«/g, '"')
      .replace(/»/g, '"')
      .replace(/…/g, '...');
  };
  
  // Word wrap function
  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    const avgCharWidth = fontSize * 0.5; // Approximate
    const maxChars = Math.floor(maxWidth / avgCharWidth);
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxChars) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };
  
  // Create header for each page
  const createHeader = (pageNum: number): string => {
    const headerY = pageHeight - 35;
    return `
      % Header background
      q
      0.058 0.090 0.165 rg
      0 ${headerY - 10} ${pageWidth} 50 re f
      Q
      
      % Header text
      BT
      /F2 10 Tf
      1 1 1 rg
      ${marginLeft} ${headerY} Td
      (NIVRA TELECOM) Tj
      ET
      
      BT
      /F1 8 Tf
      1 1 1 rg
      ${pageWidth - marginRight - 150} ${headerY} Td
      (Modalites de service | Page ${pageNum}) Tj
      ET
      
      % Teal accent line
      q
      0.078 0.722 0.651 rg
      0 ${headerY - 15} ${pageWidth} 3 re f
      Q
    `;
  };
  
  // Create footer for each page
  const createFooter = (pageNum: number, totalPages: number): string => {
    const footerY = 30;
    return `
      % Footer line
      q
      0.8 0.8 0.8 RG
      0.5 w
      ${marginLeft} ${footerY + 15} m
      ${pageWidth - marginRight} ${footerY + 15} l
      S
      Q
      
      % Footer text
      BT
      /F1 7 Tf
      0.4 0.4 0.4 rg
      ${marginLeft} ${footerY} Td
      (Document ID: ND-TOS-2026-02-05 | ${escapeText(date)} | Nivra Communications Inc.) Tj
      ET
      
      BT
      /F1 7 Tf
      0.4 0.4 0.4 rg
      ${pageWidth - marginRight - 50} ${footerY} Td
      (Page ${pageNum} / ${totalPages}) Tj
      ET
    `;
  };
  
  // Start new page
  const startNewPage = () => {
    if (pageContent) {
      pages.push(pageContent);
    }
    currentPage++;
    currentY = pageHeight - marginTop;
    pageContent = '';
  };
  
  // Check if we need a new page
  const checkNewPage = (neededHeight: number) => {
    if (currentY - neededHeight < marginBottom) {
      startNewPage();
    }
  };
  
  // Add text to current page
  const addText = (text: string, fontSize: number, x: number, y: number, color: string = '0 0 0', bold: boolean = false) => {
    const font = bold ? '/F2' : '/F1';
    pageContent += `
      BT
      ${font} ${fontSize} Tf
      ${color} rg
      ${x} ${y} Td
      (${escapeText(text)}) Tj
      ET
    `;
  };
  
  // Process each section
  for (const section of sections) {
    switch (section.type) {
      case 'title': {
        checkNewPage(80);
        // Title with blue background block
        pageContent += `
          q
          0 0.4 0.8 rg
          ${marginLeft - 10} ${currentY - 35} ${contentWidth + 20} 45 re f
          Q
        `;
        addText(section.text, fontSizeTitle, marginLeft, currentY - 20, '1 1 1', true);
        currentY -= 60;
        break;
      }
      
      case 'subtitle': {
        checkNewPage(40);
        addText(section.text, fontSizeSubtitle, marginLeft, currentY, '0.078 0.722 0.651', true);
        currentY -= 35;
        break;
      }
      
      case 'annexe': {
        // Always start annexe on new page
        startNewPage();
        // Annexe header with teal background
        pageContent += `
          q
          0.078 0.722 0.651 rg
          ${marginLeft - 10} ${currentY - 30} ${contentWidth + 20} 40 re f
          Q
        `;
        addText(section.text, 14, marginLeft, currentY - 15, '1 1 1', true);
        currentY -= 55;
        break;
      }
      
      case 'heading': {
        checkNewPage(35);
        // Add some space before heading
        currentY -= 10;
        // Heading with left teal bar
        pageContent += `
          q
          0.078 0.722 0.651 rg
          ${marginLeft - 8} ${currentY - 12} 4 18 re f
          Q
        `;
        addText(section.text, fontSizeHeading, marginLeft, currentY, '0.058 0.090 0.165', true);
        currentY -= 22;
        break;
      }
      
      case 'subheading': {
        checkNewPage(25);
        currentY -= 5;
        addText(section.text, fontSizeSubheading, marginLeft + 10, currentY, '0.2 0.26 0.34', true);
        currentY -= 18;
        break;
      }
      
      case 'paragraph': {
        const lines = wrapText(section.text, contentWidth - 10, fontSizeBody);
        checkNewPage(lines.length * lineHeight + 5);
        for (const line of lines) {
          addText(line, fontSizeBody, marginLeft, currentY, '0.2 0.26 0.34');
          currentY -= lineHeight;
        }
        currentY -= 5;
        break;
      }
      
      case 'bullet': {
        const bulletLines = wrapText(section.text, contentWidth - 25, fontSizeBullet);
        checkNewPage(bulletLines.length * lineHeight);
        // Teal bullet point
        pageContent += `
          q
          0.078 0.722 0.651 rg
          ${marginLeft + 5} ${currentY - 3} 4 4 re f
          Q
        `;
        for (let i = 0; i < bulletLines.length; i++) {
          addText(bulletLines[i], fontSizeBullet, marginLeft + 15, currentY, '0.2 0.26 0.34');
          currentY -= lineHeight;
        }
        break;
      }
      
      case 'warning': {
        const warningLines = wrapText(section.text, contentWidth - 30, fontSizeBody);
        checkNewPage(warningLines.length * lineHeight + 20);
        // Warning box with amber background
        const boxHeight = warningLines.length * lineHeight + 15;
        pageContent += `
          q
          0.996 0.949 0.890 rg
          ${marginLeft} ${currentY - boxHeight + 5} ${contentWidth} ${boxHeight} re f
          Q
          q
          0.92 0.58 0.03 rg
          ${marginLeft} ${currentY - boxHeight + 5} 4 ${boxHeight} re f
          Q
        `;
        currentY -= 10;
        for (const line of warningLines) {
          addText(line, fontSizeBody, marginLeft + 15, currentY, '0.458 0.290 0.015', true);
          currentY -= lineHeight;
        }
        currentY -= 10;
        break;
      }
      
      case 'separator': {
        checkNewPage(20);
        currentY -= 15;
        break;
      }
    }
  }
  
  // Push last page
  if (pageContent) {
    pages.push(pageContent);
  }
  
  const totalPages = pages.length;
  
  // Build complete PDF
  let pdf = `%PDF-1.4
%âãÏÒ

1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [`;

  // Reference all pages
  for (let i = 0; i < totalPages; i++) {
    pdf += `${3 + i * 2} 0 R `;
  }
  
  pdf += `]
/Count ${totalPages}
>>
endobj

`;

  let objNum = 3;
  const pageRefs: number[] = [];
  
  // Create page objects
  for (let i = 0; i < totalPages; i++) {
    const pageObjNum = objNum;
    pageRefs.push(pageObjNum);
    const contentObjNum = objNum + 1;
    
    pdf += `${pageObjNum} 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 ${pageWidth} ${pageHeight}]
/Resources <<
  /Font <<
    /F1 ${objNum + totalPages * 2} 0 R
    /F2 ${objNum + totalPages * 2 + 1} 0 R
  >>
>>
/Contents ${contentObjNum} 0 R
>>
endobj

`;

    const content = createHeader(i + 1) + pages[i] + createFooter(i + 1, totalPages);
    const contentBytes = new TextEncoder().encode(content);
    
    pdf += `${contentObjNum} 0 obj
<<
/Length ${contentBytes.length}
>>
stream
${content}
endstream
endobj

`;
    objNum += 2;
  }
  
  // Font objects
  const fontObjNum = objNum;
  pdf += `${fontObjNum} 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
/Encoding /WinAnsiEncoding
>>
endobj

${fontObjNum + 1} 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
/Encoding /WinAnsiEncoding
>>
endobj

`;

  // Cross-reference table
  const xrefStart = pdf.length;
  const totalObjs = fontObjNum + 2;
  
  pdf += `xref
0 ${totalObjs}
0000000000 65535 f 
`;

  // Calculate offsets (simplified)
  let offset = 15;
  for (let i = 1; i < totalObjs; i++) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    offset += 100;
  }
  
  pdf += `trailer
<<
/Size ${totalObjs}
/Root 1 0 R
>>
startxref
${xrefStart}
%%EOF`;
  
  return pdf;
};

// Convert to base64
const pdfToBase64 = (pdfString: string): string => {
  const bytes = new TextEncoder().encode(pdfString);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const handler = async (req: Request): Promise<Response> => {
  console.log("=== send-terms-pdf-email function invoked ===");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, order_id } = body;
    
    const targetEmail = email || "support@nivra-telecom.ca";
    const orderId = order_id || "TEST-DEMO-2026-02-06";
    
    console.log(`Generating professional PDF for order: ${orderId}`);
    console.log(`Target email: ${targetEmail}`);
    
    // Generate professional PDF
    const pdfContent = generateProfessionalPDF(orderId);
    const pdfBase64 = pdfToBase64(pdfContent);
    
    console.log("PDF generated, size:", pdfContent.length, "bytes");
    
    // Send email with PDF attachment
    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [targetEmail],
      subject: `Modalités de service Nivra Telecom - ${orderId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background: white; }
            .header { background: linear-gradient(135deg, #0F172A 0%, #1e293b 100%); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
            .header p { color: #14B8A6; margin: 10px 0 0 0; font-size: 14px; }
            .content { padding: 40px 30px; }
            .content h2 { color: #0F172A; font-size: 20px; margin-bottom: 20px; }
            .content p { color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 15px; }
            .badge { display: inline-block; background: #14B8A6; color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
            .footer { background: #f1f5f9; padding: 25px 30px; text-align: center; }
            .footer p { color: #64748b; font-size: 12px; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>NIVRA TELECOM</h1>
              <p>Services de télécommunications prépayés</p>
            </div>
            <div class="content">
              <h2>Modalités de service</h2>
              <p>Bonjour,</p>
              <p>Veuillez trouver ci-joint les <strong>Modalités de service Nivra Telecom</strong> (version intégrale) pour votre dossier.</p>
              <p><span class="badge">Document ID: ND-TOS-2026-02-05</span></p>
              <p>Ce document inclut :</p>
              <ul style="color: #334155; line-height: 2;">
                <li>Les 21 sections principales des Modalités de service</li>
                <li>Annexe B — Conditions spécifiques par service</li>
                <li>Annexe C — Politique d'installation et rendez-vous</li>
                <li>Annexe D — Modalités de paiement et e-Transfer</li>
                <li>Annexe E — Support, tickets et SLA Entreprise</li>
              </ul>
              <p style="margin-top: 25px;">Pour toute question, contactez notre équipe de support via le <a href="https://portal.nivra-telecom.ca" style="color: #0066CC;">portail client</a> ou à <a href="mailto:support@nivra-telecom.ca" style="color: #0066CC;">support@nivra-telecom.ca</a>.</p>
            </div>
            <div class="footer">
              <p><strong>Nivra Communications Inc.</strong></p>
              <p>nivra-telecom.ca | support@nivra-telecom.ca</p>
              <p>© 2026 Nivra Telecom. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `Modalites-Service-Nivra-${orderId}.pdf`,
          content: pdfBase64,
          content_type: "application/pdf",
        },
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Professional PDF sent to ${targetEmail}`,
        emailId: emailResponse.data?.id 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
