-- Permettre l'accès public en lecture aux services actifs
-- Nécessaire pour le site public (non authentifié)

-- Supprimer les anciennes policies restrictives
DROP POLICY IF EXISTS "Authenticated users can view active services" ON public.services;
DROP POLICY IF EXISTS "Deny anonymous access to services" ON public.services;

-- Créer une politique qui permet à tous (anon + authenticated) de voir les services actifs
CREATE POLICY "Public can view active services"
ON public.services
FOR SELECT
USING (is_active = true);

-- Garder les policies admin existantes pour la gestion