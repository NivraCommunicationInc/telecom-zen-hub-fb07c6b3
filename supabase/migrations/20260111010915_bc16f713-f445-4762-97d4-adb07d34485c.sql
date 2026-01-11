
-- ================================================================
-- FIX P0: Contracts + Tickets invisibles pour les clients
-- Ajouter owner_user_id et corriger les RLS policies manquantes
-- ================================================================

-- 1) Ajouter owner_user_id sur support_tickets
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS owner_user_id UUID;

-- 2) Backfill owner_user_id depuis user_id (qui EST déjà l'auth.uid())
UPDATE public.support_tickets 
SET owner_user_id = user_id 
WHERE owner_user_id IS NULL;

-- 3) Ajouter owner_user_id sur contracts  
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS owner_user_id UUID;

-- 4) Backfill owner_user_id depuis user_id (qui EST déjà l'auth.uid())
UPDATE public.contracts 
SET owner_user_id = user_id 
WHERE owner_user_id IS NULL;

-- 5) Ajouter contrainte NOT NULL avec valeur par défaut pour nouveaux enregistrements
-- (On ne peut pas mettre NOT NULL directement car il faut d'abord backfill)
ALTER TABLE public.support_tickets 
ALTER COLUMN owner_user_id SET NOT NULL;

ALTER TABLE public.contracts 
ALTER COLUMN owner_user_id SET NOT NULL;

-- 6) Créer les index pour performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_owner_user_id_created 
ON public.support_tickets (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contracts_owner_user_id_created 
ON public.contracts (owner_user_id, created_at DESC);

-- 7) CRITICAL FIX: Ajouter les RLS policies MANQUANTES pour les clients
-- Support tickets - SELECT policy pour clients
DROP POLICY IF EXISTS "Clients can view their own tickets" ON public.support_tickets;
CREATE POLICY "Clients can view their own tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (auth.uid() = owner_user_id);

-- Contracts - SELECT policy pour clients (MANQUANTE!)
DROP POLICY IF EXISTS "Clients can view their own contracts" ON public.contracts;
CREATE POLICY "Clients can view their own contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (auth.uid() = owner_user_id);

-- Contracts - INSERT policy pour clients
DROP POLICY IF EXISTS "Clients can create their own contracts" ON public.contracts;
CREATE POLICY "Clients can create their own contracts"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_user_id);

-- Contracts - UPDATE policy pour clients (signature)
DROP POLICY IF EXISTS "Clients can update their own contracts" ON public.contracts;
CREATE POLICY "Clients can update their own contracts"
ON public.contracts
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);

-- 8) Mettre à jour les policies INSERT existantes pour inclure owner_user_id
DROP POLICY IF EXISTS "Users can create their own tickets" ON public.support_tickets;
CREATE POLICY "Users can create their own tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_user_id AND auth.uid() = user_id);

-- 9) Mettre à jour les policies UPDATE existantes
DROP POLICY IF EXISTS "Users can update their own tickets" ON public.support_tickets;
CREATE POLICY "Users can update their own tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);
