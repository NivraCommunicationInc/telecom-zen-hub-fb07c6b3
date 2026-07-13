# Plan — Nivra Core / Nouvelle commande — travaux restants

Découpage par phase après le refactor "Équipements attendus" (Phase 1 livrée).

## ✅ Phase 1 — Équipement attendu (LIVRÉ)
- Panneau `ExpectedEquipmentPanel` en haut de l'étape Équipement.
- Une ligne par unité de la commande (Borne WiFi, Terminal TV × N, …).
- Saisie S/N + MAC par ligne, sauvegarde par ligne.
- Mirror `equipment_inventory` (visible portail client) + `orders.equipment_details`.
- Effacement/mise à jour idempotents.

## ⏭ Phase 2 — Installation professionnelle (édition)
- Sur la fiche commande Core : afficher la date + plage sélectionnée.
- Bouton "Modifier la date" (repicker via `useInstallationSlots`).
- Bouton "Changer en auto-installation" avec calcul du delta de frais :
  - Si facture non payée → recalcul du total à charger.
  - Si facture payée → différence versée en **crédit compte** avec note automatique
    ("Passage installation pro → auto — remboursement du frais X$").
- Bouton "Confirmer la date" (verrouille + notifie client).
- Bouton "Attribuer un technicien" (dropdown `technicians` + écrit `technician_assignments`).
- Bouton "Rendez-vous forcé" — datepicker + plage horaire libre → insère `appointments`
  avec `forced=true` (hors calendrier public).

## ⏭ Phase 3 — Auto-installation (gate + expédition)
- Bloc "Vérification préalable" obligatoire :
  - Checklist "Réseau confirmé à l'adresse" + "Fils disponibles et fonctionnels".
  - Doit être signé par l'agent Core avant de pouvoir avancer.
- Après confirmation → panneau expédition :
  - N° suivi, transporteur, lien tracking, date estimée.
  - Enregistrement Ship24 (`shipping-register-tracker`) + statut `shipped`.
  - Génération/téléchargement bon de livraison (`clientDeliverySlip.ts`).
  - Trigger email client "Commande expédiée" via `email_queue`.

## ⏭ Phase 4 — Suivi live Ship24
- Webhook Ship24 déjà connecté (à valider) : mise à jour `tracking_status`,
  `tracking_last_update_at`, événements timeline commande.
- Email transitionnel "En route / Livré" via `order-status-sms` + template email.

## Notes techniques
- Toutes les écritures crédit compte doivent passer par `account_adjustments`
  avec `reason` détaillée et référence `order_id`.
- Frais installation pro vs auto : lire depuis `field_sales_config`
  (`installation_fee`) — pas de valeur hardcodée dans le composant.
- Rendez-vous forcés → `appointments` avec `metadata->>'forced'='true'`
  pour bypass des `appointment_slot_rules`.
