-- Create partner program terms table
CREATE TABLE public.partner_program_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'Programme Partenaires Nivra',
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.partner_program_terms ENABLE ROW LEVEL SECURITY;

-- Everyone can read active terms
CREATE POLICY "Anyone can read active terms"
ON public.partner_program_terms
FOR SELECT
USING (is_active = true);

-- Only admins can manage terms (via edge function or service role)
CREATE POLICY "Admins can manage terms"
ON public.partner_program_terms
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- Insert initial terms content
INSERT INTO public.partner_program_terms (version, title, content, is_active, published_at)
VALUES (
  '1.0',
  'Programme Partenaires Nivra',
  E'# Programme Partenaires Nivra

**Conditions, commissions et politiques du programme (v1.0)**

---

## 1) Structure des commissions

### 1.1 Commission par activation (commission variable – 50 % après rabais)

Pour chaque nouveau client activé avec votre code promo, vous recevez une commission équivalente à :

**50 % du montant des services hors taxes** facturé au client après application du rabais de référence, sur la première facture uniquement.

**Définition – "Montant des services"** : le montant des services télécom facturés (hors taxes), excluant notamment les frais non récurrents, frais administratifs, frais de livraison, pénalités, intérêts, ou tout autre montant non lié au service mensuel, sauf indication contraire dans le portail partenaire.

**Définition – "Activation complète"** : le service du client est activé et utilisable (ligne/SIM/eSIM provisionnée et service opérationnel selon les systèmes Nivra).

#### Exemples (commission 50 % après rabais)

| Service | Rabais référence 50% | Facturé | Commission (50%) |
|---------|---------------------|---------|------------------|
| 60 $ | 30 $ | 30 $ | **15 $** |
| 120 $ | 60 $ | 60 $ | **30 $** |
| 200 $ | 100 $ | 100 $ | **50 $** |

### 1.2 Bonus volume mensuel (activations admissibles)

Le bonus mensuel est déterminé selon le palier atteint sur le total d''activations admissibles du mois et s''applique à toutes les activations admissibles du mois.

| Palier | Bonus par activation |
|--------|---------------------|
| 5 à 9 activations | +2 $ / activation |
| 10 à 19 activations | +5 $ / activation |
| 20+ activations | +10 $ / activation |

#### Exemples (bonus volume)

- 8 activations : 8 × 2 $ = **16 $**
- 12 activations : 12 × 5 $ = **60 $**
- 21 activations : 21 × 10 $ = **210 $**

---

## 2) Conditions d''éligibilité

Une activation est admissible si **toutes** les conditions suivantes sont respectées :

- ✅ Le client doit être un **nouveau client Nivra** (non client existant).
- ✅ Le client doit activer son service dans les **7 jours** suivant l''inscription.
- ✅ Le client doit maintenir son service actif pendant au moins **7 jours**.
- ❌ **Auto-référencement interdit** : vous ne pouvez pas utiliser votre propre code (directement ou indirectement).

> Nivra se réserve le droit de déterminer, selon des contrôles raisonnables, si une référence respecte les conditions d''éligibilité (incluant la détection de doublons, comptes multiples, abus et fraude).

---

## 3) Modalités de paiement

### 3.1 Seuil minimal de retrait

**50 $ CAD** (minimum requis avant qu''un paiement puisse être émis).

### 3.2 Délai de paiement

- Les commissions sont payées dans les **48 heures** suivant l''activation complète du service.
- Une fois le paiement initié, le versement est traité dans un délai pouvant aller jusqu''à **24 heures** selon la méthode choisie.

### 3.3 Méthodes de paiement

Interac e-Transfer / PayPal / Crypto (si disponible dans votre portail partenaire).

### 3.4 Plafond de paiement rapide (période de lancement)

Afin d''assurer la stabilité opérationnelle et la prévention des abus, Nivra peut appliquer un plafond temporaire de paiements rapides par partenaire (ex. hebdomadaire) jusqu''à l''établissement d''un historique de performance et de conformité. Le plafond, s''il s''applique, sera communiqué dans le portail partenaire.

---

## 4) Période de validation et ajustements

Même si les commissions sont payées rapidement, chaque référence demeure sujette à une **période de validation de 30 jours** suivant l''activation.

Durant cette période, si le client annule/désactive son service, si la référence est jugée invalide, ou si une fraude/abus est détecté, la commission peut être annulée et faire l''objet d''un ajustement (voir section 5.5).

---

## 5) Politique de traitement des références

### 5.1 Attribution des références

Une référence est attribuée lorsqu''un nouveau client utilise votre code promo lors de son inscription.
L''attribution est définitive et ne peut être transférée à un autre partenaire.

### 5.2 Validation des références

Chaque référence passe par un processus de validation visant à confirmer :

- la légitimité du client,
- le respect des conditions d''éligibilité,
- l''absence d''abus/fraude.

Ce processus peut prendre jusqu''à **48 heures**.

### 5.3 Références invalides

Sont considérées invalides, notamment :

- les auto-références,
- les clients existants,
- les comptes frauduleux,
- les inscriptions multiples d''une même personne,
- les références provenant de méthodes promotionnelles interdites.

### 5.4 Annulation de commission

Nivra se réserve le droit d''annuler une commission si :

- le client annule ou désactive dans les 30 jours,
- une fraude/abus est détecté,
- les conditions du programme ne sont pas respectées.

### 5.5 Récupération de commissions

En cas de commissions payées par erreur ou liées à des références invalides, Nivra peut :

- déduire ces montants des commissions futures (solde partenaire), et/ou
- demander un remboursement lorsque nécessaire.

---

## 6) Conditions générales du programme

### 6.1 Éligibilité

Pour participer, vous devez :

- être âgé d''au moins **18 ans**,
- résider au **Canada**.

Nivra se réserve le droit de refuser ou de révoquer l''adhésion à tout moment.

### 6.2 Représentation de la marque

Vous vous engagez à représenter Nivra de manière professionnelle et honnête.
Toute déclaration fausse, trompeuse ou non autorisée concernant les services Nivra est interdite.

### 6.3 Méthodes promotionnelles

Sont interdits :

- le spam,
- les publicités mensongères,
- l''utilisation de marques déposées sans autorisation,
- le référencement payant sur les mots-clés de la marque (brand bidding),
- toute méthode contraire à l''éthique ou aux politiques des plateformes utilisées.

### 6.4 Confidentialité

Vous vous engagez à ne pas divulguer les informations confidentielles du programme, incluant les stratégies marketing internes et toute information non publique communiquée dans le cadre du programme.

### 6.5 Modifications du programme

Nivra peut modifier les termes du programme avec un préavis de **30 jours**.
La continuation de votre participation après ce délai constitue une acceptation des nouveaux termes.

### 6.6 Résiliation

- Vous pouvez quitter le programme à tout moment.
- Les commissions admissibles (après ajustements applicables) seront payées selon les modalités en vigueur.
- Nivra peut résilier un compte partenaire en cas de violation des termes.

### 6.7 Responsabilité fiscale

Vous êtes responsable de déclarer vos revenus de commission aux autorités fiscales.
Nivra émettra les feuillets fiscaux requis conformément aux obligations applicables.

### 6.8 Loi applicable

Le programme est régi par les lois du **Québec** et du **Canada**.
Tout litige sera résolu par les tribunaux compétents du Québec.',
  true,
  now()
);

-- Create trigger for updated_at
CREATE TRIGGER update_partner_program_terms_updated_at
BEFORE UPDATE ON public.partner_program_terms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();