-- KYC OCR: ajoute colonnes pour résultats OCR sur identity_verification_sessions
-- et date_of_birth sur profiles si manquante

-- 1. Colonne metadata JSONB sur identity_verification_sessions (si absente)
ALTER TABLE identity_verification_sessions
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. date_of_birth sur profiles (si absente)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Index pour requêtes OCR admin
CREATE INDEX IF NOT EXISTS idx_ivs_metadata_ocr
  ON identity_verification_sessions
  USING gin (metadata)
  WHERE metadata ? 'ocr_result';

COMMENT ON COLUMN identity_verification_sessions.metadata IS
  'Données OCR extraites par kyc-ocr-extract (nom, date_naissance, confiance, modèle IA)';

COMMENT ON COLUMN profiles.date_of_birth IS
  'Date de naissance — peut être pré-remplie par OCR KYC (marqué non-vérifié jusqu''à review admin)';
