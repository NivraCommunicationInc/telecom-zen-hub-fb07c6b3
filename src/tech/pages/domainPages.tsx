import { DomainInConstruction } from "./DomainInConstruction";

export const DayPage = () => <DomainInConstruction title="Ma journée" tour="Tour 3"
  lede="Timeline interactive, optimisation trajets, drag & drop, ETA temps réel, carte synchronisée."
  deliverables={["Timeline verticale des RDV du jour","Recalcul ETA + partage lien signé au client","Optimisation trajet auto","Vue semaine repliée"]} />;

export const TerrainPage = () => <DomainInConstruction title="Terrain" tour="Tour 4"
  lede="Carte Mapbox plein écran, techs live, RDV, incidents NOC, zones, GPS temps réel."
  deliverables={["Carte multi-techs live","Trafic + météo overlay","Navigation turn-by-turn","ETA partagé client"]} />;

export const CustomersPage = () => <DomainInConstruction title="Clients" tour="Tour 2"
  lede="Fiche client 360 sur UNE seule page scrollable. Identité, services, équipement, factures, tickets, notes, timeline, docs."
  deliverables={["Recherche instantanée nom/tél/adresse/S/N","Actions inline appel/SMS/ticket","Aucun changement de page","Historique consolidé unique"]} />;

export const InventoryPage = () => <DomainInConstruction title="Inventaire" tour="Tour 5"
  lede="Mon camion en poche : scan code-barre/QR/MAC/S/N, mouvements, retours, RMA, casse."
  deliverables={["Stock camion temps réel","Scan universel caméra","Réappro en 1 tap","RMA / Bris / Échange dédiés"]} />;

export const CommsPage = () => <DomainInConstruction title="Communication" tour="Tour 6"
  lede="Inbox unifié dispatch / NOC / chat client / SMS / appels avec escalade contextuelle."
  deliverables={["Chat live du site public routé au tech","Escalade NOC attachée à l'intervention","Historique appels","Pièces jointes"]} />;

export const ResourcesPage = () => <DomainInConstruction title="Ressources" tour="Tour 7"
  lede="Procédures interactives, fiches équipement, FAQ, vidéos, offline."
  deliverables={["Procédures pas-à-pas interactives","Fiches Borne Wi-Fi / Terminal TV / POD","Vidéos + tutoriels","Consultable offline"]} />;

export const PerformancePage = () => <DomainInConstruction title="Performance" tour="Tour 8"
  lede="Objectifs, commissions temps réel, temps moyens, NPS, classement."
  deliverables={["Objectifs jour/semaine/mois","Commissions temps réel","NPS client par intervention","Classement équipe"]} />;

export const SettingsPage = () => <DomainInConstruction title="Paramètres" tour="Tour 8"
  lede="Profil, véhicule, notifications, offline, biométrie."
  deliverables={["Profil technicien","Véhicule (plaque + capacité stock)","Préférences notifications","Gestion offline / cache"]} />;
