-- Créer l'enum pour les rôles du personnel Nivra
CREATE TYPE public.staff_role AS ENUM ('admin', 'employee', 'technician');

-- Table des rôles du personnel
CREATE TABLE public.staff_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role staff_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    deactivated_at TIMESTAMPTZ,
    deactivated_by UUID REFERENCES auth.users(id),
    notes TEXT,
    UNIQUE (user_id, role)
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_staff_roles_user_id ON public.staff_roles(user_id);
CREATE INDEX idx_staff_roles_role ON public.staff_roles(role);
CREATE INDEX idx_staff_roles_active ON public.staff_roles(is_active) WHERE is_active = true;

-- Activer RLS
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

-- Fonction SECURITY DEFINER pour vérifier les rôles (évite la récursion RLS)
CREATE OR REPLACE FUNCTION public.has_staff_role(_user_id UUID, _role staff_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
  )
$$;

-- Fonction pour obtenir tous les rôles actifs d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_staff_roles(_user_id UUID)
RETURNS staff_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::staff_role[])
  FROM public.staff_roles
  WHERE user_id = _user_id
    AND is_active = true
$$;

-- Fonction pour vérifier si un utilisateur a au moins un rôle staff
CREATE OR REPLACE FUNCTION public.is_staff_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_roles
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;

-- Policies RLS
-- Les admins peuvent tout voir/modifier
CREATE POLICY "Admins can manage all staff roles"
ON public.staff_roles
FOR ALL
TO authenticated
USING (public.has_staff_role(auth.uid(), 'admin'))
WITH CHECK (public.has_staff_role(auth.uid(), 'admin'));

-- Chaque utilisateur peut voir ses propres rôles
CREATE POLICY "Users can view their own roles"
ON public.staff_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Migrer les admins existants vers la nouvelle table
INSERT INTO public.staff_roles (user_id, role, is_active, created_at, notes)
SELECT 
    au.user_id,
    'admin'::staff_role,
    au.is_active,
    au.created_at,
    'Migré depuis admin_users'
FROM public.admin_users au
ON CONFLICT (user_id, role) DO NOTHING;