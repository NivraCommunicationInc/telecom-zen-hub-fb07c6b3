import { Home, CalendarDays, Map, Users, Wrench, Package, MessagesSquare, GraduationCap, TrendingUp, Settings } from "lucide-react";
import { PagePlaceholder } from "./PagePlaceholder";

export const FieldHomePage = () => (
  <PagePlaceholder eyebrow="Mission Control" title="Accueil" icon={Home} phase="P2"
    subtitle="Timeline verticale de la journée : prochain RDV, ETA live, urgences NOC, alertes stock, actions requises."
    capabilities={[
      "Bouton « Démarrer ma journée » (checklist camion + géoloc + statut dispatch)",
      "Prochain RDV en priorité visuelle avec ETA en direct",
      "Urgences NOC + alertes stock camion agrégées",
      "Actions requises (signatures manquantes, RMA à clore, retours en attente)",
      "KPI du jour : interventions, temps moyen, taux de première visite réussie",
    ]}
  />
);

export const FieldDayPage = () => (
  <PagePlaceholder eyebrow="Planning terrain" title="Ma journée" icon={CalendarDays} phase="P2"
    subtitle="Timeline + carte + optimisation trajet auto. Drag pour réordonner. Email « en route » envoyé automatiquement au client suivant."
    capabilities={[
      "Timeline chronologique + vue carte synchronisée",
      "Optimisation trajet auto (RPC fn_optimize_route)",
      "Recalcul ETA en direct + partage lien signé au client",
      "Drag & drop pour réordonner, verrouillage des créneaux client",
      "Vue semaine repliée pour préparation J+1",
    ]}
  />
);

export const FieldTerrainPage = () => (
  <PagePlaceholder eyebrow="Opérations terrain" title="Terrain" icon={Map} phase="P3"
    subtitle="Carte plein écran : RDV, techniciens actifs, zones de couverture, trafic, incidents NOC. Navigation turn-by-turn embarquée."
    capabilities={[
      "Carte plein écran Mapbox (RDV, techs actifs, couverture, trafic)",
      "GPS live technicien branché sur technician_locations",
      "Navigation turn-by-turn dans l'app",
      "ETA partagé au client via lien signé",
      "Incidents NOC affichés en overlay",
    ]}
  />
);

export const FieldCustomersPage = () => (
  <PagePlaceholder eyebrow="Client 360" title="Clients" icon={Users} phase="P2"
    subtitle="Recherche instantanée (nom, tél, adresse, compte, S/N). Un seul écran scrollable regroupant tout le client."
    capabilities={[
      "Recherche instantanée nom / téléphone / adresse / compte / S/N",
      "Client 360 unifié : identité + services + équipement + factures + notes + photos + contrats + timeline",
      "Actions inline : appeler, SMS, créer ticket, ouvrir intervention",
      "Historique complet consolidé (une seule source de vérité)",
    ]}
  />
);

export const FieldInterventionPage = () => (
  <PagePlaceholder eyebrow="Workflow guidé" title="Intervention" icon={Wrench} phase="P3"
    subtitle="Écran guidé pas-à-pas, une seule action à la fois. Chaque étape verrouille la précédente. Reprise offline."
    capabilities={[
      "Arrivée : geofence + photo façade",
      "Checklist contextuelle (Internet / TV / Mobile / SAV)",
      "Scan équipement (S/N + MAC obligatoires)",
      "Diagnostics intégrés (ping/débit, canaux Wi-Fi, signal TV, activation SIM)",
      "Configuration Wi-Fi (SSID + mot de passe) envoyée au client par email + PDF",
      "Signature électronique avancée + photos avant/après",
      "Rapport auto généré + email tech_completed",
    ]}
  />
);

export const FieldInventoryPage = () => (
  <PagePlaceholder eyebrow="Camion & stock" title="Inventaire" icon={Package} phase="P4"
    subtitle="Vue « mon camion » = stock physique en poche. Scan pour sortir/rentrer. Retour, bris, échange = workflows séparés."
    capabilities={[
      "Stock camion en temps réel",
      "Scan pour sortir/rentrer un équipement",
      "Alertes seuil bas + réappro en 1 tap",
      "Workflows Retour / Bris / Échange dédiés (pas des filtres)",
      "Journal complet des mouvements liés à une intervention",
    ]}
  />
);

export const FieldCommsPage = () => (
  <PagePlaceholder eyebrow="Communication" title="Inbox unifié" icon={MessagesSquare} phase="P4"
    subtitle="Un seul inbox : dispatch, NOC, chat client (live chat site inclus), SMS, appels. Escalade NOC contextuelle à une intervention."
    capabilities={[
      "Inbox unifié dispatch / NOC / chat client / SMS / appels",
      "Chat live du site public routé vers le tech en intervention",
      "Historique d'appels (enregistrement si consenti)",
      "Bouton « Escalade NOC » attaché à une intervention",
      "Réponses assistées par IA (P5)",
    ]}
  />
);

export const FieldResourcesPage = () => (
  <PagePlaceholder eyebrow="Savoir-faire" title="Ressources" icon={GraduationCap} phase="P5"
    subtitle="Procédures interactives (steps + vidéos), FAQ recherchable, fiches équipement. Consultable offline."
    capabilities={[
      "Procédures interactives pas-à-pas",
      "FAQ recherchable",
      "Fiches équipement (Borne Wi-Fi, Terminal TV, POD)",
      "Vidéos + tutoriels intégrés",
      "Consultation offline",
    ]}
  />
);

export const FieldPerformancePage = () => (
  <PagePlaceholder eyebrow="Performance" title="Objectifs & KPI" icon={TrendingUp} phase="P5"
    subtitle="Objectifs jour / semaine / mois, commissions en temps réel, temps moyen par type, NPS clients, classement équipe."
    capabilities={[
      "Objectifs jour / semaine / mois",
      "Commissions temps réel",
      "Temps moyen par type d'intervention",
      "NPS clients",
      "Classement équipe",
    ]}
  />
);

export const FieldSettingsPage = () => (
  <PagePlaceholder eyebrow="Compte" title="Paramètres" icon={Settings} phase="P5"
    subtitle="Profil, véhicule (plaque, capacité stock), préférences notifications, gestion offline, déconnexion."
    capabilities={[
      "Profil technicien",
      "Véhicule (plaque, capacité stock)",
      "Préférences notifications",
      "Gestion offline (taille cache, sync manuelle)",
      "Déconnexion",
    ]}
  />
);
