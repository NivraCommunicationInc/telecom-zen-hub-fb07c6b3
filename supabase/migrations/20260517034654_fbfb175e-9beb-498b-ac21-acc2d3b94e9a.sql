
-- Seed 5 onboarding training modules for Nivra Field
INSERT INTO public.hub_posts (section, title, content, rich_content, category, tags, visible_to, is_published, is_featured, published_at)
VALUES
('training',
'Bienvenue chez Nivra — Mission, valeurs et services',
E'Bienvenue dans l''équipe Nivra ! Nivra est une entreprise québécoise de télécommunications prépayées spécialisée dans des solutions simples, rapides et sans engagement.\n\nNotre mission : rendre les télécommunications accessibles à tous les Québécois avec une transparence totale et un service local.\n\nNos services principaux :\n- Téléphonie mobile prépayée (SIM, activation, recharges)\n- Internet résidentiel haute vitesse\n- Télévision (terminal TV requis)\n- Sécurité résidentielle\n\nNos valeurs : transparence, simplicité, service local, sans contrat inutile. Les prix sont clairs, l''activation est efficace, et le client garde toujours le contrôle.\n\nRègle clé : un seul service par adresse (Internet et TV sont mutuellement exclusifs en standalone). Maximum 1 borne WiFi et 1-4 terminaux TV par client.',
'[
  {"question":"Quelle est la spécialité principale de Nivra ?","options":["Téléphonie postpayée","Télécommunications prépayées","Internet par satellite","Réseau cellulaire 5G national"],"answer":1},
  {"question":"Combien de services peut-on installer par adresse ?","options":["Aucune limite","Un seul service par adresse","Deux services maximum","Trois services maximum"],"answer":1},
  {"question":"Combien de bornes WiFi maximum par client ?","options":["1","2","3","4"],"answer":0},
  {"question":"Quelle valeur n''est PAS une valeur Nivra ?","options":["Transparence","Service local","Engagement long terme obligatoire","Simplicité"],"answer":2}
]'::jsonb,
'Onboarding', ARRAY['onboarding','base'], ARRAY['field_sales','employee','admin','hr','technician'], true, true, now()),

('training',
'Catalogue d''équipement et tarification',
E'Maîtriser le catalogue est essentiel pour faire une vente claire et honnête.\n\nÉquipements et prix d''achat (TPS 5% + TVQ 9,975% en sus) :\n- Borne WiFi : 60$\n- Terminal TV : 50$ (1 à 4 unités)\n- Carte SIM : 30$\n\nRègle d''or : ne jamais dire « inclus ». Toujours indiquer « requis » avec le prix. L''équipement est facturé une seule fois (one-time), distinct du service mensuel récurrent.\n\nPromotion BIENVENUE2026 / NIVRA2026 : 100% de rabais sur le PREMIER MOIS de service uniquement. L''équipement reste facturé. Cumulable avec les parrainages.\n\nNe jamais inventer un prix, un forfait, un partenaire ou une statistique. Utiliser les valeurs exactes du catalogue Nivra Field.',
'[
  {"question":"Quel est le prix d''une borne WiFi ?","options":["50$","60$","75$","90$"],"answer":1},
  {"question":"Comment présenter l''équipement au client ?","options":["Inclus dans le forfait","Requis avec le prix indiqué","Optionnel et gratuit","Loué mensuellement"],"answer":1},
  {"question":"Que couvre la promo BIENVENUE2026 ?","options":["100% du premier mois de service","100% sur l''équipement","50% sur 6 mois","Les frais d''installation seulement"],"answer":0},
  {"question":"Combien de terminaux TV maximum par adresse ?","options":["1","2","3","4"],"answer":3}
]'::jsonb,
'Produits', ARRAY['catalogue','prix'], ARRAY['field_sales','employee','admin','hr','technician'], true, true, now()),

('training',
'Approche client à la porte — Script et premières secondes',
E'Vous avez 10 secondes pour capter l''attention. Voici la structure éprouvée :\n\n1. Salutation chaleureuse + identification claire : « Bonjour, je suis [prénom] de Nivra Télécom, votre fournisseur local au Québec. »\n2. Raison de la visite (courte) : « Je passe vous présenter notre Internet prépayé sans contrat. »\n3. Question d''engagement : « Connaissiez-vous Nivra ? »\n4. Écouter — ne pas couper la parole.\n\nRègles d''or :\n- Toujours porter votre badge officiel visible\n- Ne jamais entrer chez le client sans invitation\n- Respecter un « non » au premier refus, laisser une carte\n- Ne JAMAIS inventer de prix, de promo ou un partenariat\n- Heures permises : 9h-20h en semaine, 10h-19h les fins de semaine\n\nObjections fréquentes : « J''ai déjà un fournisseur » → comparer en avantages (sans contrat, prix fixe, support local), jamais en dénigrant les concurrents.',
'[
  {"question":"Combien de temps avez-vous pour capter l''attention ?","options":["3 secondes","10 secondes","30 secondes","Une minute"],"answer":1},
  {"question":"Que faire si le client refuse ?","options":["Insister poliment 3 fois","Respecter le refus et laisser une carte","Revenir le lendemain","Sonner chez le voisin et attendre"],"answer":1},
  {"question":"Jusqu''à quelle heure peut-on cogner en semaine ?","options":["18h","19h","20h","21h"],"answer":2},
  {"question":"Comment gérer une objection sur un concurrent ?","options":["Dénigrer le concurrent","Comparer en avantages factuels","Promettre un meilleur prix","Inventer une promo spéciale"],"answer":1}
]'::jsonb,
'Ventes', ARRAY['script','porte','objections'], ARRAY['field_sales','admin','hr'], true, false, now()),

('training',
'Processus de commande et checkout invité',
E'Tous les forfaits (Internet, TV, Mobile) passent par /commander en checkout invité. JAMAIS rediriger vers /portal/auth — le compte client est créé automatiquement après la commande.\n\nÉtapes obligatoires :\n1. Validation d''adresse (couverture + service unique par adresse)\n2. Sélection du forfait + équipement requis\n3. Coordonnées client (nom, courriel, téléphone)\n4. Consentement légal (case obligatoire — bloque la persistance sinon)\n5. Paiement via PayPal (système primaire) ou Interac/Visa/Mastercard\n\nKYC : vérification d''identité requise AVANT activation. L''état du dossier passe par : confirmed → processing → shipped → installed → activated.\n\nLes calculs de prix et de taxes sont gérés strictement par le backend (Nivra Core). Ne JAMAIS calculer un total au stylo — toujours utiliser le récapitulatif live du portail Field.\n\nRabais agent terrain : maximum 50$/mois pendant 24 mois.',
'[
  {"question":"Vers où redirige toujours un nouveau client ?","options":["/portal/auth","/commander","/login","/inscription"],"answer":1},
  {"question":"Quel est le système de paiement primaire ?","options":["Stripe","PayPal","Square","Virement bancaire seulement"],"answer":1},
  {"question":"Quand le KYC doit-il être complété ?","options":["Après l''activation","Avant l''activation","À l''installation","C''est optionnel"],"answer":1},
  {"question":"Quelle est la limite de rabais d''un agent terrain ?","options":["20$/mois sur 12 mois","50$/mois sur 24 mois","100$/mois sur 24 mois","Aucune limite"],"answer":1},
  {"question":"Qui calcule les taxes et le total final ?","options":["L''agent au stylo","Le backend Nivra Core","Le client lui-même","Excel personnel"],"answer":1}
]'::jsonb,
'Processus', ARRAY['commande','checkout','kyc'], ARRAY['field_sales','employee','admin'], true, true, now()),

('training',
'Conformité, sécurité et confidentialité (Loi 25)',
E'La Loi 25 du Québec encadre la protection des renseignements personnels. En tant qu''agent Nivra, vous êtes responsable :\n\n- Ne JAMAIS noter un mot de passe, un NIP client ou un numéro de carte sur papier\n- Toujours utiliser le portail Field pour saisir les données — pas de SMS personnel, pas de courriel privé\n- Verrouiller votre téléphone/tablette quand vous le laissez sans surveillance\n- Le NIP client à 4 chiffres permet de contourner certaines vérifications : un motif est OBLIGATOIRE pour tout bypass par le personnel\n- Toute modification financière (rabais, remboursement) doit être escaladée à Nivra Core — les techniciens et agents n''ont PAS l''autorisation de traiter un paiement\n\nMFA (authentification à deux facteurs) : obligatoire pour accéder au portail Field. Ne jamais partager votre code TOTP.\n\nEn cas de doute sur une demande client suspecte : escalader immédiatement à un superviseur via le hub.',
'[
  {"question":"Peut-on noter un NIP client sur papier ?","options":["Oui, dans un carnet sécurisé","Non, jamais","Oui si on le détruit après","Seulement avec accord verbal"],"answer":1},
  {"question":"Qui peut traiter un paiement client ?","options":["Tout agent terrain","Les techniciens uniquement","Nivra Core (escalade requise)","N''importe quel employé"],"answer":2},
  {"question":"Quelle loi encadre les renseignements personnels au Québec ?","options":["Loi 101","Loi 25","RGPD","Loi C-11"],"answer":1},
  {"question":"Que faire pour bypasser le NIP d''un client ?","options":["Rien, c''est interdit","Indiquer un motif obligatoire","Demander au client par téléphone","Utiliser le NIP par défaut 0000"],"answer":1},
  {"question":"Le MFA est-il obligatoire pour le portail Field ?","options":["Optionnel","Obligatoire","Seulement pour les admins","Seulement le premier mois"],"answer":1}
]'::jsonb,
'Sécurité', ARRAY['loi25','mfa','conformite'], ARRAY['field_sales','employee','admin','hr','technician'], true, true, now());

-- Leaderboard RPC: top 20 par score moyen (formation seulement)
CREATE OR REPLACE FUNCTION public.get_training_leaderboard(_limit integer DEFAULT 20)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  completed_count integer,
  avg_score numeric,
  certificate_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tp.user_id,
    COALESCE(
      NULLIF(split_part(COALESCE(p.full_name, ''), ' ', 1), '') ||
        CASE WHEN split_part(COALESCE(p.full_name, ''), ' ', 2) <> ''
             THEN ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
             ELSE '' END,
      'Agent'
    ) AS display_name,
    COUNT(*) FILTER (WHERE tp.completed)::int AS completed_count,
    ROUND(AVG(tp.score) FILTER (WHERE tp.score IS NOT NULL)::numeric, 1) AS avg_score,
    (SELECT COUNT(*)::int FROM public.hub_certificates c WHERE c.user_id = tp.user_id) AS certificate_count
  FROM public.hub_training_progress tp
  LEFT JOIN public.profiles p ON p.user_id = tp.user_id
  WHERE tp.completed
  GROUP BY tp.user_id, p.full_name
  HAVING COUNT(*) FILTER (WHERE tp.score IS NOT NULL) > 0
  ORDER BY avg_score DESC NULLS LAST, completed_count DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_training_leaderboard(integer) TO authenticated;
