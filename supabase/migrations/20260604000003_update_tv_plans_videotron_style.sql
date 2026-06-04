-- Mise à jour des forfaits TV+Internet — structure style Vidéotron
-- 24 chaînes La Base + X choix = total. Prix inchangés. Prix à vie garanti.

-- Internet 100 + Télé La Base (was: Internet 100 + TV Basic)
UPDATE public.services SET
  name            = 'Internet 100 + Télé La Base',
  short_description = '24 chaînes La Base • Internet 100 Mbit/s illimité • Prix à vie',
  description     = '24 chaînes au total • 24 chaînes La Base • Internet 100 Mbit/s • Données illimitées • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "Internet 100 Mbit/s illimité", "Données incluses illimitées", "Aucun contrat", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE"]'::jsonb
WHERE plan_code = 'tv_basic' AND category = 'TV';

-- Internet 500 + Télé 5 choix (was: Internet 500 + TV 5 choix)
UPDATE public.services SET
  name            = 'Internet 500 + Télé 5 choix',
  short_description = '29 chaînes • 24 La Base + 5 choix Populaires • Internet 500 Mbit/s illimité',
  description     = '29 chaînes au total • 24 chaînes La Base + 5 choix parmi les chaînes Populaires • Internet 500 Mbit/s • Données illimitées • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "5 choix parmi les chaînes Populaires", "29 chaînes au total", "Internet 500 Mbit/s illimité", "Données incluses illimitées", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE"]'::jsonb
WHERE plan_code = 'tv_5choices' AND category = 'TV';

-- Internet 500 + Télé 10 choix (was: Internet 500 + TV 10 choix)
UPDATE public.services SET
  name            = 'Internet 500 + Télé 10 choix',
  short_description = '34 chaînes • 24 La Base + 10 choix Populaires et Sportives • Internet 500 Mbit/s illimité',
  description     = '34 chaînes au total • 24 chaînes La Base + 10 choix parmi les chaînes Populaires et Sportives • Internet 500 Mbit/s • Données illimitées • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "10 choix parmi les chaînes Populaires et Sportives", "34 chaînes au total", "Internet 500 Mbit/s illimité", "Données incluses illimitées", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE"]'::jsonb
WHERE plan_code = 'tv_10choices' AND category = 'TV';

-- Internet 500 + Télé 15 choix (was: Internet 500 + TV 15 choix)
UPDATE public.services SET
  name            = 'Internet 500 + Télé 15 choix',
  short_description = '39 chaînes • 24 La Base + 15 choix Populaires et Sportives • Internet 500 Mbit/s illimité',
  description     = '39 chaînes au total • 24 chaînes La Base + 15 choix parmi les chaînes Populaires et Sportives • Internet 500 Mbit/s • Données illimitées • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "15 choix parmi les chaînes Populaires et Sportives", "39 chaînes au total", "Internet 500 Mbit/s illimité", "Données incluses illimitées", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE"]'::jsonb
WHERE plan_code = 'tv_15choices' AND category = 'TV';

-- Internet 500 + Télé 25 choix (was: Internet 500 + TV 25 choix)
UPDATE public.services SET
  name            = 'Internet 500 + Télé 25 choix',
  short_description = '49 chaînes • 24 La Base + 25 choix Populaires et Sportives • Internet 500 Mbit/s illimité',
  description     = '49 chaînes au total • 24 chaînes La Base + 25 choix parmi les chaînes Populaires et Sportives • Internet 500 Mbit/s • Données illimitées • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "25 choix parmi les chaînes Populaires et Sportives", "49 chaînes au total", "Internet 500 Mbit/s illimité", "Données incluses illimitées", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE"]'::jsonb
WHERE plan_code = 'tv_25choices' AND category = 'TV';

-- Internet GIGA + Télé La Base (plan_code: giga_tv_basic — si existant)
UPDATE public.services SET
  name            = 'Internet GIGA + Télé La Base',
  short_description = '24 chaînes La Base • Internet GIGA 940 Mbit/s illimité • Prix à vie',
  description     = '24 chaînes au total • 24 chaînes La Base • Internet GIGA 940 Mbit/s • Données illimitées • Ultra-faible latence • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "Internet GIGA 940 Mbit/s illimité", "Données incluses illimitées", "Ultra-faible latence", "Aucun contrat", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE", "GIGA"]'::jsonb
WHERE plan_code = 'giga_tv_basic' AND category = 'TV';

-- Internet GIGA + Télé 5 choix (was: GIGA + TV 5 choix)
UPDATE public.services SET
  name            = 'Internet GIGA + Télé 5 choix',
  short_description = '29 chaînes • 24 La Base + 5 choix Populaires • Internet GIGA 940 Mbit/s illimité',
  description     = '29 chaînes au total • 24 chaînes La Base + 5 choix parmi les chaînes Populaires • Internet GIGA 940 Mbit/s • Données illimitées • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "5 choix parmi les chaînes Populaires", "29 chaînes au total", "Internet GIGA 940 Mbit/s illimité", "Données incluses illimitées", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE", "GIGA"]'::jsonb
WHERE plan_code = 'giga_tv_5choices' AND category = 'TV';

-- Internet GIGA + Télé 10 choix (was: GIGA + TV 10 choix)
UPDATE public.services SET
  name            = 'Internet GIGA + Télé 10 choix',
  short_description = '34 chaînes • 24 La Base + 10 choix Populaires et Sportives • Internet GIGA 940 Mbit/s illimité',
  description     = '34 chaînes au total • 24 chaînes La Base + 10 choix parmi les chaînes Populaires et Sportives • Internet GIGA 940 Mbit/s • Données illimitées • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "10 choix parmi les chaînes Populaires et Sportives", "34 chaînes au total", "Internet GIGA 940 Mbit/s illimité", "Données incluses illimitées", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE", "GIGA"]'::jsonb
WHERE plan_code = 'giga_tv_10choices' AND category = 'TV';

-- Internet GIGA + Télé 15 choix (was: GIGA + TV 15 choix)
UPDATE public.services SET
  name            = 'Internet GIGA + Télé 15 choix',
  short_description = '39 chaînes • 24 La Base + 15 choix Populaires et Sportives • Internet GIGA 940 Mbit/s illimité',
  description     = '39 chaînes au total • 24 chaînes La Base + 15 choix parmi les chaînes Populaires et Sportives • Internet GIGA 940 Mbit/s • Données illimitées • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "15 choix parmi les chaînes Populaires et Sportives", "39 chaînes au total", "Internet GIGA 940 Mbit/s illimité", "Données incluses illimitées", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE", "GIGA"]'::jsonb
WHERE plan_code = 'giga_tv_15choices' AND category = 'TV';

-- Internet GIGA + Télé 25 choix (was: GIGA + TV 25 choix)
UPDATE public.services SET
  name            = 'Internet GIGA + Télé 25 choix',
  short_description = '49 chaînes • 24 La Base + 25 choix Populaires et Sportives • Internet GIGA 940 Mbit/s illimité',
  description     = '49 chaînes au total • 24 chaînes La Base + 25 choix parmi les chaînes Populaires et Sportives • Internet GIGA 940 Mbit/s • Données illimitées • Prix à vie garanti',
  features_json   = '["24 chaînes La Base", "25 choix parmi les chaînes Populaires et Sportives", "49 chaînes au total", "Internet GIGA 940 Mbit/s illimité", "Données incluses illimitées", "Prix à vie garanti — peut seulement diminuer"]'::jsonb,
  badges          = '["PRIX À VIE", "GIGA"]'::jsonb
WHERE plan_code = 'giga_tv_25choices' AND category = 'TV';
