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

const FULL_TERMS_DOCUMENT = `MODALITÉS DE SERVICE – NIVRA TELECOM
Version intégrale étendue – Prépayé à renouvellement mensuel (expérience postpayée)
Dernière mise à jour : 2026-02-05

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PRÉAMBULE, ACCEPTATION ET CHAMP D'APPLICATION

Les présentes Modalités de service (les « Modalités ») constituent une entente légale contraignante entre Nivra Communications Inc., opérant sous le nom Nivra Telecom (« Nivra », « nous », « notre »), et toute personne physique ou morale (« Client », « vous », « votre ») qui :

• crée un compte client,
• commande un service,
• effectue un paiement,
• utilise ou bénéficie d'un service fourni par Nivra.

En accédant aux Services, en confirmant une commande, en effectuant un paiement ou en utilisant un Service, le Client reconnaît avoir lu, compris et accepté les présentes Modalités, sans réserve.

Les présentes Modalités s'appliquent exclusivement aux Services souscrits par le Client et doivent être lues conjointement avec :
• le contrat de services,
• le résumé des renseignements essentiels,
• les annexes applicables (installation, paiement, support, etc.),
• les politiques publiées sur le portail client.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DÉFINITIONS ET INTERPRÉTATION

Aux fins des présentes Modalités, les termes suivants ont la signification ci-dessous :

Services : ensemble des services de télécommunications offerts par Nivra, incluant notamment Internet, Mobile, Télévision et services connexes.

Client : toute personne ou entité ayant souscrit un ou plusieurs Services.

Compte : dossier client créé dans les systèmes de Nivra.

Cycle de facturation (Bill Cycle) : période contractuelle de trente (30) jours.

Date de cycle : jour du mois correspondant à la création du Compte.

Facture mensuelle : document généré à titre informatif indiquant les Services actifs et les montants applicables pour le cycle à venir.

Paiement confirmé : paiement reçu, validé et accepté par Nivra.

Non-renouvellement : absence de paiement confirmé à la date de cycle.

Suspension : interruption temporaire d'un Service à la suite d'un non-renouvellement.

Annulation : désactivation définitive d'un Service après expiration de la période de récupération.

Les titres sont fournis à titre indicatif et n'affectent pas l'interprétation des présentes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. NATURE DES SERVICES ET ABSENCE DE VÉRIFICATION DE CRÉDIT

Nivra est un fournisseur de services de télécommunications prépayés. Aucune vérification de crédit externe n'est effectuée lors de la souscription.

Les Services sont fournis sur la base :
• des informations fournies par le Client,
• de la disponibilité technique,
• des règles internes de prévention de fraude et de conformité.

Nivra se réserve le droit de refuser, suspendre ou résilier un Service en cas d'information inexacte, incomplète ou trompeuse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. MODÈLE DE FACTURATION — PRÉPAYÉ À RENOUVELLEMENT MENSUEL

Tous les Services Nivra sont fournis selon un modèle prépayé, avec une présentation de type postpayée.

Une facture mensuelle est générée et rendue disponible avant chaque cycle afin de :
• résumer les Services actifs,
• afficher les montants applicables,
• permettre le renouvellement du cycle.

⚠️ La facture mensuelle ne constitue pas une dette. Aucun Service n'est fourni sans paiement confirmé pour le cycle correspondant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. CYCLE DE FACTURATION, DATES ET AJUSTEMENTS

5.1 Durée du cycle
Chaque cycle couvre une période de 30 jours, sauf indication contraire.

5.2 Date de cycle
La date de cycle est définie à la création du Compte. Si le mois ne comporte pas ce jour (ex. 29–31), la date est ajustée au dernier jour du mois.

5.3 Début du cycle
Le cycle débute uniquement à la date et à l'heure de confirmation du paiement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. MODES DE PAIEMENT ET TRAITEMENT

Les modes de paiement acceptés incluent :
• Carte de crédit (via fournisseur autorisé),
• PayPal,
• Virement Interac e-Transfer.

Nivra ne conserve aucun numéro complet de carte.

Des contrôles antifraude peuvent entraîner un statut « en vérification ».

Un paiement non confirmé ne déclenche aucun renouvellement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. NON-RENOUVELLEMENT, SUSPENSION ET ABSENCE DE DETTE

En l'absence de paiement confirmé à la date de cycle :
• Le cycle n'est pas renouvelé
• Le Service est suspendu automatiquement
• Aucun intérêt, frais de retard ou pénalité ne s'applique
• Le Client ne contracte aucune dette envers Nivra

Le non-renouvellement constitue une interruption volontaire du Service, et non un défaut de paiement postpayé.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. PÉRIODE DE SUSPENSION ET ANNULATION APRÈS 90 JOURS

Après suspension :
• le Service demeure récupérable pendant 90 jours civils,
• aucune facturation n'est générée pendant cette période.

Après 90 jours sans paiement :
• le Service est annulé définitivement,
• les numéros de téléphone peuvent devenir irrécupérables,
• une nouvelle activation peut être requise.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. ANNULATION PAR LE CLIENT

Le Client peut annuler un Service à tout moment.
• L'annulation prend effet à la fin du cycle payé.
• Aucun remboursement partiel n'est accordé.
• Exceptions : obligation légale ou erreur de facturation confirmée.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. INSTALLATION, RENDEZ-VOUS ET ACCÈS

10.1 Installation standard
Inclut les opérations normales prévues au plan souscrit.

10.2 Installation complexe
Peut inclure câblage, perçage, configuration avancée ou contraintes d'accès.
Des frais supplémentaires peuvent s'appliquer.

10.3 Absence ou accès impossible
Une absence, un retard important ou un accès impossible peut entraîner :
• frais de déplacement,
• replanification,
• annulation de l'intervention.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. ÉQUIPEMENT, SIM, eSIM ET GARANTIE

Les équipements fournis peuvent être neufs ou remis à neuf.
• Garantie limitée : 1 an
• DOA : 14 jours
• Exclusions : bris, liquide, perte, vol, modifications non autorisées

Les cartes SIM et eSIM peuvent entraîner des frais d'activation ou de remplacement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

12. CONDITIONS SPÉCIFIQUES — MOBILE

• Portabilité soumise au fournisseur précédent
• Informations exactes requises (nom, numéro, NIP de portage)
• Le Client demeure responsable des usages avant blocage en cas de perte/vol
• Les frais hors-forfait sont facturés selon l'usage réel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

13. CONDITIONS SPÉCIFIQUES — INTERNET

• Vitesses annoncées « jusqu'à »
• Performance dépend du réseau interne du Client
• Usage raisonnable applicable même sur forfaits illimités
• Service fourni sur une base best effort

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

14. CONDITIONS SPÉCIFIQUES — TÉLÉVISION

• Un forfait Internet actif est requis
• Chaînes incluses selon le plan
• Chaînes premium facturées en supplément
• Certaines modifications nécessitent un ticket support

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

15. SUPPORT, TICKETS ET SLA

Le support est offert via : portail client, courriel officiel.

Les délais annoncés sont des objectifs, non des garanties.

Un SLA s'applique uniquement s'il est expressément indiqué au contrat.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

16. FRAUDE, CONTESTATIONS ET CHARGEBACKS

Avant toute contestation bancaire, le Client doit contacter Nivra.

En cas de chargeback confirmé :
• suspension du Service possible,
• frais administratifs raisonnables,
• mesures de recouvrement permises par la loi.

Ces mesures ne s'appliquent jamais aux non-renouvellements normaux.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

17. IDENTITÉ, SÉCURITÉ ET NIP

• Une pièce d'identité valide peut être exigée
• Un NIP à 4 chiffres est requis pour certaines opérations
• Le Client est responsable de la confidentialité de son NIP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

18. PROTECTION DES RENSEIGNEMENTS PERSONNELS

Nivra protège les renseignements personnels conformément :
• à la Loi 25 (Québec),
• à la PIPEDA (Canada).

Les données sont utilisées uniquement pour :
• fournir les Services,
• gérer la facturation,
• offrir le support,
• prévenir la fraude.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

19. LIMITATION DE RESPONSABILITÉ

Dans la mesure permise par la loi :
• Nivra n'est pas responsable des dommages indirects,
• la responsabilité totale est limitée aux montants payés pour le cycle concerné.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

20. CONFORMITÉ RÉGLEMENTAIRE ET PLAINTES

Nivra vise la conformité aux codes applicables du CRTC.

Si un différend n'est pas résolu, le Client peut s'adresser à la Commission des plaintes relatives aux services de télécom-télévision (CPRST / CCTS).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

21. DROIT APPLICABLE, DIVISIBILITÉ ET INTÉGRALITÉ

Les présentes Modalités sont régies par les lois du Québec et du Canada.

Si une clause est invalide, les autres demeurent en vigueur.

Les présentes Modalités et leurs annexes constituent l'intégralité de l'entente.


════════════════════════════════════════════════════════════════════════════════
                              ANNEXE B
        CONDITIONS SPÉCIFIQUES PAR SERVICE
════════════════════════════════════════════════════════════════════════════════

(Fait partie intégrante des Modalités de service – Nivra Telecom)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.1 — DISPOSITIONS GÉNÉRALES APPLICABLES AUX SERVICES

Les présentes conditions spécifiques complètent les Modalités de service générales et s'appliquent uniquement aux services effectivement souscrits par le Client.

En cas de divergence, les conditions spécifiques du service concerné prévalent sur les dispositions générales, dans la mesure permise par la loi.

Les services sont fournis sous réserve :
• de la disponibilité technique,
• de la couverture réseau,
• des contraintes imposées par des fournisseurs tiers,
• des règles de sécurité et de conformité internes de Nivra.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.2 — SERVICES MOBILES

B.2.1 Portabilité des numéros
Le Client peut demander le transfert (portabilité) de son numéro vers Nivra Telecom.

La portabilité dépend :
• du fournisseur cédant,
• des informations fournies par le Client,
• des règles réglementaires applicables.

Le Client est responsable de fournir des informations exactes et complètes, incluant :
• nom exact au dossier,
• numéro à transférer,
• NIP/PIN de portage (si requis).

Tout refus, délai ou échec causé par des informations inexactes ne saurait engager la responsabilité de Nivra.

B.2.2 Carte SIM et eSIM
Le Client est responsable de la conservation et de la sécurité de sa carte SIM ou eSIM.

Des frais peuvent s'appliquer pour :
• activation initiale,
• remplacement,
• perte, vol ou bris,
• changement de SIM ou eSIM.

En cas de perte ou de vol, le Client doit aviser Nivra immédiatement afin de bloquer la ligne. Le Client demeure responsable de toute utilisation effectuée avant le blocage.

B.2.3 Utilisation, surconsommation et hors-forfait
Les frais liés à :
• l'itinérance (roaming),
• les données excédentaires,
• les appels internationaux,
• les numéros spéciaux ou services à valeur ajoutée,

sont facturés selon les tarifs applicables au moment de l'utilisation, tels qu'affichés au portail client.

En cas d'utilisation inhabituelle ou de risque de fraude, Nivra peut appliquer des mesures de protection, incluant un blocage temporaire ou une suspension.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.3 — SERVICES INTERNET

B.3.1 Vitesse et performance
Les vitesses annoncées sont des vitesses maximales théoriques « jusqu'à ».

La vitesse réelle peut varier en fonction notamment :
• de la congestion du réseau,
• de la qualité du câblage,
• du matériel utilisé,
• du réseau interne du Client,
• des interférences Wi-Fi.

Sauf mention expresse, les services sont fournis sur une base best effort.

B.3.2 Réseau interne du Client
Le Client est entièrement responsable :
• de son réseau interne,
• de ses appareils,
• de la configuration Wi-Fi,
• de la sécurité de ses équipements.

Nivra n'est pas responsable des limitations de performance ou interruptions causées par l'équipement ou l'environnement du Client.

B.3.3 Usage raisonnable
Même lorsqu'un forfait est présenté comme « illimité », il demeure soumis à une politique d'usage raisonnable visant à prévenir :
• l'abus,
• la fraude,
• la revente non autorisée,
• les atteintes à la sécurité du réseau.

En cas d'usage abusif, Nivra peut appliquer des mesures de gestion du trafic ou suspendre le service.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.4 — SERVICES DE TÉLÉVISION

B.4.1 Dépendance au service Internet
Le service de télévision Nivra nécessite un forfait Internet actif.
En cas de résiliation ou d'annulation du service Internet, le service TV sera automatiquement résilié.

B.4.2 Chaînes incluses et options
Les chaînes incluses dépendent du plan souscrit.

Certains plans incluent :
• des chaînes de base obligatoires,
• des chaînes à sélection libre (« Free-Choice »),
• des chaînes premium facturées en supplément.

Les sélections sont consignées au portail client.

B.4.3 Modifications et tickets
Certaines modifications de chaînes nécessitent la création d'un ticket de support.
Les délais de traitement sont indicatifs et peuvent varier selon les contraintes techniques et les systèmes tiers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.5 — INSTALLATION ET INTERVENTIONS TECHNIQUES

B.5.1 Installation standard
L'installation standard couvre les opérations normales prévues au plan souscrit.

B.5.2 Installation complexe
Une installation est considérée complexe lorsqu'elle implique :
• câblage additionnel,
• perçage ou traversée de murs,
• configuration avancée,
• accès restreint ou conditions particulières.

Des frais supplémentaires peuvent s'appliquer.

B.5.3 Rendez-vous manqué
En cas d'absence, d'accès impossible ou d'annulation tardive, des frais de déplacement ou de replanification peuvent être facturés.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.6 — ÉQUIPEMENT ET GARANTIE

Les équipements fournis par Nivra peuvent être neufs ou remis à neuf.

Garantie
• Garantie limitée de un (1) an
• Fenêtre DOA : 14 jours

Exclusions
La garantie ne couvre pas :
• dommages causés par le Client,
• perte ou vol,
• dommages liquides,
• bris physiques,
• modifications non autorisées.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.7 — SERVICES DE SÉCURITÉ (SI APPLICABLE)

Les services de sécurité fournis par Nivra :
• ne remplacent pas les services d'urgence,
• peuvent dépendre de l'électricité, d'Internet ou du réseau mobile.

En cas d'urgence, le Client doit contacter les autorités compétentes (911).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.8 — SUPPORT, TICKETS ET SLA

Toutes les demandes de support doivent transiter par :
• le portail client, ou
• les canaux officiels indiqués par Nivra.

Les délais de réponse sont des objectifs, non des garanties.

Un SLA ne s'applique que s'il est expressément prévu au contrat ou au résumé des renseignements essentiels.

Les tickets peuvent être fermés après un délai raisonnable en l'absence de réponse du Client.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.9 — RESPONSABILITÉS DU CLIENT

Le Client s'engage à :
• fournir des informations exactes,
• collaborer au diagnostic,
• permettre l'accès lorsque requis,
• utiliser les services conformément aux lois applicables.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B.10 — DISPOSITIONS FINALES DE L'ANNEXE B

La présente Annexe B fait partie intégrante des Modalités de service.
Elle est réputée acceptée par le Client dès la souscription, l'utilisation ou le renouvellement d'un Service.


════════════════════════════════════════════════════════════════════════════════
                              ANNEXE C
        POLITIQUE D'INSTALLATION ET RENDEZ-VOUS
════════════════════════════════════════════════════════════════════════════════

(Fait partie intégrante des Modalités de service – Nivra Telecom)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.1 — PORTÉE DE L'ANNEXE C

La présente Annexe C encadre l'ensemble des règles applicables aux installations, interventions techniques, rendez-vous, déplacements de techniciens et accès aux lieux dans le cadre des services fournis par Nivra Telecom.

Elle s'applique à tout Client ayant souscrit un service nécessitant :
• une installation initiale,
• une activation sur site,
• une intervention technique,
• un déplacement planifié ou non planifié.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.2 — TYPES D'INSTALLATION

C.2.1 Installation standard
Une installation est considérée comme standard lorsqu'elle inclut uniquement :
• la connexion aux infrastructures existantes,
• l'activation du service,
• les vérifications usuelles de fonctionnement,
• la configuration de base prévue au plan souscrit.

L'installation standard est limitée au temps, aux équipements et aux opérations normalement requis pour un service résidentiel ou commercial simple.

C.2.2 Installation complexe
Une installation est considérée complexe lorsqu'elle implique, sans s'y limiter :
• câblage additionnel,
• perçage de murs, planchers ou plafonds,
• traversée de cloisons,
• configuration réseau avancée,
• déplacement ou ajout de prises,
• accès restreint ou conditions particulières sur le site,
• contraintes liées à la structure du bâtiment.

Toute installation complexe peut entraîner :
• des frais additionnels,
• une replanification,
• ou un refus d'intervention si les conditions ne sont pas sécuritaires ou conformes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.3 — PRÉREQUIS À L'INSTALLATION

Le Client doit s'assurer, avant le rendez-vous, que les conditions suivantes sont respectées :
• accès libre et sécuritaire au logement ou local,
• accès au local technique, panneau électrique ou point d'entrée,
• prise électrique fonctionnelle,
• présence d'une personne majeure autorisée,
• autorisation écrite du propriétaire ou du syndicat (si requis).

Tout manquement à ces prérequis peut entraîner :
• l'échec de l'installation,
• des frais de déplacement,
• une replanification à une date ultérieure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.4 — RENDEZ-VOUS ET FENÊTRES D'INTERVENTION

Les rendez-vous sont planifiés dans une fenêtre horaire estimée.

Les heures fournies sont indicatives et peuvent varier en fonction :
• du volume d'interventions,
• des contraintes techniques,
• des conditions de circulation ou météo,
• de facteurs hors du contrôle de Nivra.

Nivra ne garantit pas une heure exacte d'arrivée, mais s'engage à respecter la fenêtre prévue dans la mesure du possible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.5 — ABSENCE, RETARD ET NO-SHOW

C.5.1 Absence du Client
Si le Client est absent au moment du rendez-vous ou refuse l'accès :
• l'intervention peut être annulée,
• des frais de déplacement / no-show peuvent être facturés,
• une nouvelle date devra être planifiée.

C.5.2 Annulation tardive
Toute annulation effectuée sans préavis raisonnable peut entraîner des frais, tels qu'indiqués au résumé de contrat, à la commande ou à la facture.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.6 — INSTALLATION IMPOSSIBLE

Une installation peut être jugée impossible pour des raisons incluant :
• contraintes techniques,
• absence d'infrastructure,
• accès refusé,
• conditions dangereuses,
• non-conformité du site.

Dans ce cas :
• l'intervention peut être clôturée,
• les frais déjà engagés (déplacement, diagnostic) peuvent être facturés,
• le service peut être annulé sans activation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.7 — RESPONSABILITÉS ET LIMITES

Le technicien n'est pas autorisé à :
• modifier des structures porteuses,
• effectuer des travaux électriques majeurs,
• intervenir sur des équipements non liés au service,
• contourner des règles de sécurité ou de conformité.

Toute demande excédant le cadre de l'installation prévue peut être refusée.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.8 — INTERVENTIONS POST-INSTALLATION

Les interventions ultérieures (déplacement, reconfiguration, diagnostic avancé) peuvent être :
• facturées,
• planifiées selon disponibilité,
• soumises à validation préalable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.9 — ACCEPTATION DE L'INSTALLATION

À la fin de l'intervention, le Client reconnaît que :
• le service est fonctionnel selon les tests effectués,
• l'installation est conforme au plan souscrit,
• toute anomalie doit être signalée rapidement via le support.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C.10 — DISPOSITIONS FINALES

La présente Annexe C est réputée acceptée dès la confirmation d'un rendez-vous ou l'exécution d'une intervention.


════════════════════════════════════════════════════════════════════════════════
                              ANNEXE D
        MODALITÉS DE PAIEMENT ET e-TRANSFER
════════════════════════════════════════════════════════════════════════════════

(Fait partie intégrante des Modalités de service – Nivra Telecom)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.1 — PORTÉE DE L'ANNEXE D

La présente Annexe D encadre les règles applicables aux paiements, moyens de paiement, traitement, vérification, non-confirmation, ainsi qu'aux paiements Interac e-Transfer.

Elle s'applique à l'ensemble des Services Nivra, dans le cadre du modèle prépayé à renouvellement mensuel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.2 — MOYENS DE PAIEMENT ACCEPTÉS

Les moyens de paiement acceptés incluent :
• Carte de crédit (traitée par un fournisseur autorisé),
• PayPal,
• Virement Interac e-Transfer.

Nivra se réserve le droit :
• de limiter un mode de paiement,
• de refuser un paiement,
• de placer un paiement en vérification,
en cas de risque de fraude ou de non-conformité.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.3 — PAIEMENT PAR CARTE DE CRÉDIT

Les paiements par carte :
• sont traités par des plateformes sécurisées,
• ne sont pas stockés intégralement par Nivra,
• peuvent faire l'objet de contrôles antifraude.

Un paiement refusé ou annulé ne déclenche aucune activation ni renouvellement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.4 — PAIEMENT PAR PAYPAL

Les paiements PayPal sont soumis :
• aux règles de PayPal,
• au statut de confirmation retourné.

Un paiement PayPal non confirmé ou contesté peut entraîner la suspension du service.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.5 — PAIEMENT PAR VIREMENT INTERAC (e-TRANSFER)

D.5.1 Instructions générales
Le Client doit suivre strictement les instructions communiquées par Nivra, incluant :
• adresse de destination,
• montant exact,
• référence (numéro de compte ou facture),
• message requis.

D.5.2 Statuts de paiement e-Transfer
Les paiements e-Transfer peuvent passer par les statuts suivants :
• Pending (En attente)
• In verification (En vérification)
• Completed (Confirmé)
• Declined (Refusé)
• Fraud (Fraude suspectée)

L'activation ou le renouvellement est effectué uniquement au statut Confirmé.

D.5.3 Erreurs de paiement
En cas de :
• montant incorrect,
• mauvaise référence,
• réponse invalide,
le paiement peut être retardé, refusé ou retourné, sans obligation d'activation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.6 — PAIEMENT EN VÉRIFICATION

Un paiement en vérification :
• n'entraîne aucune pénalité,
• ne garantit pas l'activation,
• peut retarder le renouvellement du service.

Le Client demeure responsable de fournir un paiement valide et conforme.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.7 — NON-RENOUVELLEMENT PRÉPAYÉ

En l'absence de paiement confirmé :
• le service n'est pas renouvelé,
• il est suspendu automatiquement,
• aucune dette n'est créée,
• aucun intérêt ne s'applique.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.8 — CONTESTATIONS ET CHARGEBACKS

Avant toute contestation bancaire, le Client doit contacter le support Nivra.

En cas de contestation ou chargeback confirmé :
• le service peut être suspendu,
• des frais administratifs raisonnables peuvent s'appliquer,
• des mesures de recouvrement peuvent être entreprises, dans la mesure permise par la loi.

Ces mesures ne s'appliquent pas aux non-renouvellements normaux.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.9 — PREUVES ET TRAÇABILITÉ

Le Client reconnaît que peuvent servir de preuve :
• confirmations de paiement,
• statuts e-Transfer,
• journaux techniques,
• factures,
• communications via le portail ou courriel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D.10 — DISPOSITIONS FINALES

La présente Annexe D est réputée acceptée dès qu'un paiement est effectué ou tenté auprès de Nivra Telecom.


════════════════════════════════════════════════════════════════════════════════
                              ANNEXE E
        SUPPORT, TICKETS, SLA ENTREPRISE
════════════════════════════════════════════════════════════════════════════════

(Fait partie intégrante des Modalités de service – Nivra Telecom)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.1 — PORTÉE ET OBJECTIF DE L'ANNEXE E

La présente Annexe E encadre les règles applicables au support technique, à la gestion des tickets, aux délais de réponse, ainsi qu'aux engagements de niveau de service (SLA) lorsqu'un plan Entreprise ou B2B est souscrit.

Elle s'applique :
• à tous les Clients utilisant le support Nivra,
• et spécifiquement aux Clients Entreprise bénéficiant d'un SLA contractuel, lorsque mentionné au contrat ou au résumé des renseignements essentiels.

À défaut d'un SLA expressément indiqué, les services sont fournis sur une base best effort.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.2 — CANAUX DE SUPPORT OFFICIELS

Les communications avec Nivra doivent transiter par les canaux officiels suivants :

Portail client (méthode prioritaire)
Création et suivi de tickets, notifications, pièces jointes.

Courriel de support : Support@nivra-telecom.ca

Autres canaux (chat, téléphone) : lorsque disponibles et indiqués au portail.

Les demandes transmises par des canaux non officiels peuvent ne pas être traitées.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.3 — SYSTÈME DE TICKETS

E.3.1 Création d'un ticket
Toute demande de support, incident ou question doit faire l'objet d'un ticket contenant :
• une description claire du problème,
• le service concerné,
• toute information ou preuve pertinente (photos, messages d'erreur, tests).

Un ticket incomplet peut retarder le traitement.

E.3.2 Statuts de tickets
Les tickets suivent généralement les statuts suivants :
• Open (Ouvert) : ticket créé, en attente de prise en charge
• In Progress (En cours) : analyse ou intervention en cours
• Waiting for Client (En attente du client) : informations requises
• Resolved (Résolu) : problème corrigé ou solution fournie
• Closed (Fermé) : ticket clôturé

E.3.3 Fermeture automatique
Un ticket peut être fermé automatiquement si le Client :
• ne répond pas aux demandes d'information,
• ne fournit pas les éléments requis,
pendant une période raisonnable (ex. 7 jours).

Un ticket fermé peut être rouvert sur demande.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.4 — PRIORISATION DES INCIDENTS

Les incidents sont classés selon leur impact :
• P1 – Critique : service entièrement indisponible (Entreprise)
• P2 – Majeur : dégradation importante
• P3 – Standard : incident partiel ou intermittent
• P4 – Mineur / Demande : information, configuration, changement

La priorité détermine l'ordre de traitement et les délais cibles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.5 — DÉLAIS DE RÉPONSE (OBJECTIFS GÉNÉRAUX)

Sauf SLA spécifique, Nivra vise les objectifs suivants sans garantie :
• Première réponse : 24 heures ouvrables
• Résolution standard : 48 à 72 heures ouvrables
• Modifications TV / configuration : 2 à 24 heures
• Incidents critiques : traitement prioritaire lorsque possible

Les délais peuvent varier selon :
• la complexité,
• la collaboration du Client,
• les dépendances à des fournisseurs tiers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.6 — SLA ENTREPRISE (SI APPLICABLE)

E.6.1 Applicabilité
Un SLA Entreprise s'applique uniquement si :
• explicitement indiqué au contrat,
• mentionné au résumé des renseignements essentiels,
• ou prévu dans une annexe SLA dédiée.

À défaut, aucun SLA garanti ne s'applique.

E.6.2 Paramètres SLA
Selon le plan Entreprise souscrit, le SLA peut inclure :
• heures de support étendues,
• délais de réponse garantis,
• délais de rétablissement ciblés,
• priorisation P1/P2,
• crédits de service conditionnels.

Les paramètres précis sont ceux indiqués au contrat.

E.6.3 Exclusions SLA
Le SLA ne s'applique pas aux interruptions causées par :
• force majeure,
• pannes électriques,
• problèmes du réseau interne du Client,
• équipements non fournis par Nivra,
• actes du Client ou tiers,
• maintenance planifiée ou urgente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.7 — OBLIGATIONS DU CLIENT

Le Client s'engage à :
• fournir des informations exactes et complètes,
• permettre l'accès lorsque requis,
• effectuer les tests demandés,
• collaborer au diagnostic.

Le non-respect de ces obligations peut :
• retarder la résolution,
• suspendre le traitement du ticket,
• invalider un SLA.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.8 — CHANGEMENTS, CONFIGURATIONS ET DEMANDES ADMIN

Certaines demandes (ex. changement de plan, chaînes TV, configuration réseau) :
• peuvent nécessiter une validation administrative,
• peuvent entraîner des délais additionnels,
• peuvent être facturées selon la nature de la demande.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.9 — PREUVES TECHNIQUES ET TRAÇABILITÉ

Le Client reconnaît que peuvent servir de preuves en cas de litige :
• journaux techniques (logs),
• statuts de tickets,
• confirmations d'activation,
• preuves de livraison ou d'intervention,
• communications via le portail ou courriel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.10 — ENREGISTREMENTS ET QUALITÉ

Nivra peut, lorsque permis par la loi :
• enregistrer certaines communications,
• analyser les tickets à des fins de qualité,
• utiliser des données agrégées pour améliorer ses services.

Un avis est donné lorsque requis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.11 — PLAINTES INTERNES

Avant tout recours externe, le Client doit :
• ouvrir un ticket de plainte,
• décrire précisément la situation,
• permettre une analyse interne.

Nivra vise un traitement équitable et documenté des plaintes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.12 — RECOURS EXTERNES (CPRST / CCTS)

Si une plainte n'est pas résolue à la satisfaction du Client, celui-ci peut contacter :

Commission des plaintes relatives aux services de télécom-télévision (CPRST / CCTS)
Organisme indépendant de résolution des plaintes au Canada.

Les coordonnées et procédures sont disponibles sur le site officiel du CPRST.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.13 — LIMITATION ET NON-GARANTIE

Sauf SLA expressément prévu :
• les délais sont indicatifs,
• aucune garantie de temps de rétablissement n'est accordée,
• le support est fourni selon une obligation de moyens.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E.14 — ACCEPTATION ET INTÉGRALITÉ

La présente Annexe E fait partie intégrante des Modalités de service.

Elle est réputée acceptée dès :
• l'utilisation du support,
• la création d'un ticket,
• ou la souscription à un plan Entreprise.


════════════════════════════════════════════════════════════════════════════════
                         FIN DU DOCUMENT
════════════════════════════════════════════════════════════════════════════════

Document ID: ND-TOS-2026-02-05
© 2026 Nivra Communications Inc. Tous droits réservés.
`;

// Generate multi-page PDF using jsPDF-compatible text layout
function generateTermsPDFBase64(orderId: string): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString('fr-CA', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Split document into lines
  const lines = FULL_TERMS_DOCUMENT.split('\n');
  
  // Calculate pages (approx 50 lines per page)
  const LINES_PER_PAGE = 48;
  const totalPages = Math.ceil(lines.length / LINES_PER_PAGE);
  
  // Build PDF content
  let pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [`;

  // Add page references
  for (let i = 0; i < totalPages; i++) {
    pdfContent += `${3 + i * 2} 0 R `;
  }
  pdfContent += `] /Count ${totalPages} >>
endobj

`;

  let objNum = 3;
  const pageObjects: string[] = [];
  const streamObjects: string[] = [];

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const startLine = pageNum * LINES_PER_PAGE;
    const endLine = Math.min(startLine + LINES_PER_PAGE, lines.length);
    const pageLines = lines.slice(startLine, endLine);

    // Build stream content
    let streamContent = `BT
/F1 10 Tf
50 750 Td
14 TL
`;

    // Add header on first page
    if (pageNum === 0) {
      streamContent = `BT
/F1 16 Tf
50 770 Td
(NIVRA TELECOM) Tj
0 -20 Td
/F1 10 Tf
(Document ID: ND-TOS-2026-02-05 | Commande: ${orderId}) Tj
0 -10 Td
(Date d'emission: ${dateStr}) Tj
0 -25 Td
14 TL
`;
    }

    // Add page lines
    for (const line of pageLines) {
      // Escape special PDF characters and convert to ASCII-safe
      const safeLine = line
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[éèêë]/g, 'e')
        .replace(/[àâä]/g, 'a')
        .replace(/[ùûü]/g, 'u')
        .replace(/[îï]/g, 'i')
        .replace(/[ôö]/g, 'o')
        .replace(/[ç]/g, 'c')
        .replace(/[É]/g, 'E')
        .replace(/[À]/g, 'A')
        .replace(/[«»]/g, '"')
        .replace(/[—–]/g, '-')
        .replace(/[•]/g, '*')
        .replace(/[⚠️]/g, '!')
        .replace(/[━═]/g, '-')
        .replace(/[░▒▓]/g, '#');

      if (safeLine.trim()) {
        streamContent += `(${safeLine}) Tj T*
`;
      } else {
        streamContent += `() Tj T*
`;
      }
    }

    // Add page number
    streamContent += `0 -20 Td
/F1 8 Tf
(Page ${pageNum + 1} / ${totalPages} - Nivra Telecom - nivra-telecom.ca) Tj
`;

    streamContent += `ET`;

    const streamLength = streamContent.length;

    // Page object
    pageObjects.push(`${objNum} 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${objNum + 1} 0 R /Resources << /Font << /F1 ${3 + totalPages * 2} 0 R >> >> >>
endobj

`);

    // Stream object
    streamObjects.push(`${objNum + 1} 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj

`);

    objNum += 2;
  }

  // Add all page and stream objects
  for (let i = 0; i < totalPages; i++) {
    pdfContent += pageObjects[i];
    pdfContent += streamObjects[i];
  }

  // Add font object
  const fontObjNum = 3 + totalPages * 2;
  pdfContent += `${fontObjNum} 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj

`;

  // Build xref
  const objectCount = fontObjNum + 1;
  pdfContent += `xref
0 ${objectCount}
0000000000 65535 f 
`;

  // Simplified xref (not perfectly accurate but functional)
  for (let i = 1; i < objectCount; i++) {
    pdfContent += `0000000${String(i * 100).padStart(3, '0')} 00000 n 
`;
  }

  pdfContent += `
trailer
<< /Size ${objectCount} /Root 1 0 R >>
startxref
${pdfContent.length}
%%EOF`;

  // Convert to base64
  const encoder = new TextEncoder();
  const bytes = encoder.encode(pdfContent);
  
  // Manual base64 encoding for Deno
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    
    base64 += base64Chars[a >> 2];
    base64 += base64Chars[((a & 3) << 4) | (b >> 4)];
    base64 += i + 1 < bytes.length ? base64Chars[((b & 15) << 2) | (c >> 6)] : '=';
    base64 += i + 2 < bytes.length ? base64Chars[c & 63] : '=';
  }
  
  return base64;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-terms-pdf-email] Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      order_id = "ND-TOS-2026-02-05", 
      recipient_email = "support@nivra-telecom.ca" 
    } = body;

    console.log(`[send-terms-pdf-email] Generating PDF for order: ${order_id}`);
    console.log(`[send-terms-pdf-email] Sending to: ${recipient_email}`);

    // Generate PDF
    const pdfBase64 = generateTermsPDFBase64(order_id);
    console.log(`[send-terms-pdf-email] PDF generated, size: ${pdfBase64.length} chars`);

    // Send email with PDF attachment
    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [recipient_email],
      subject: `Modalités de service – Nivra Telecom (${order_id})`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
            .content { padding: 30px; }
            .content h2 { color: #0F172A; font-size: 18px; margin-bottom: 15px; }
            .content p { color: #4B5563; line-height: 1.6; }
            .info-box { background: #F0FDFA; border-left: 4px solid #14B8A6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .info-box strong { color: #0F172A; }
            .footer { background: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB; }
            .footer p { color: #6B7280; font-size: 12px; margin: 0; }
            .badge { display: inline-block; background: #14B8A6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📄 Modalités de service</h1>
              <p>Nivra Telecom – Document officiel</p>
            </div>
            <div class="content">
              <h2>Version intégrale étendue</h2>
              <p>Veuillez trouver ci-joint le document complet des <strong>Modalités de service Nivra Telecom</strong>, incluant toutes les annexes légales (B, C, D, E).</p>
              
              <div class="info-box">
                <strong>📋 Document ID:</strong> ND-TOS-2026-02-05<br>
                <strong>📅 Mise à jour:</strong> 2026-02-05<br>
                <strong>📄 Pages:</strong> Multi-pages (21 sections + 4 annexes)
              </div>
              
              <p>Ce document fait partie intégrante de votre contrat de services et couvre :</p>
              <ul style="color: #4B5563; line-height: 1.8;">
                <li>Préambule et acceptation</li>
                <li>Définitions et interprétation</li>
                <li>Modèle de facturation prépayé</li>
                <li>Cycle de facturation et ajustements</li>
                <li>Modes de paiement et traitement</li>
                <li>Suspension et annulation</li>
                <li>Installation et équipement</li>
                <li>Conditions spécifiques (Mobile, Internet, TV)</li>
                <li>Support, tickets et SLA</li>
                <li>Protection des renseignements personnels</li>
                <li><strong>Annexe B:</strong> Conditions spécifiques par service</li>
                <li><strong>Annexe C:</strong> Politique d'installation et rendez-vous</li>
                <li><strong>Annexe D:</strong> Modalités de paiement et e-Transfer</li>
                <li><strong>Annexe E:</strong> Support, tickets, SLA Entreprise</li>
              </ul>
              
              <p style="margin-top: 20px;">
                <span class="badge">Prépayé</span>
                <span class="badge" style="background: #0066CC; margin-left: 5px;">Sans crédit</span>
                <span class="badge" style="background: #6366F1; margin-left: 5px;">Conforme CRTC</span>
              </p>
            </div>
            <div class="footer">
              <p>© 2026 Nivra Communications Inc. | nivra-telecom.ca</p>
              <p style="margin-top: 5px;">1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5 | Support@nivra-telecom.ca</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `Modalites-Service-Nivra-${order_id}.pdf`,
          content: pdfBase64,
          content_type: "application/pdf",
        },
      ],
    });

    console.log("[send-terms-pdf-email] Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `PDF envoyé à ${recipient_email}`,
        email_id: emailResponse.data?.id 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-terms-pdf-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
