CREATE OR REPLACE FUNCTION public.generate_job_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base_text text;
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    BEGIN
      base_text := extensions.unaccent(coalesce(NEW.title, 'job'));
    EXCEPTION
      WHEN undefined_function THEN
        base_text := coalesce(NEW.title, 'job');
    END;

    base_slug := lower(regexp_replace(base_text, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);

    IF base_slug IS NULL OR base_slug = '' THEN
      base_slug := 'job';
    END IF;

    final_slug := base_slug;
    WHILE EXISTS (
      SELECT 1
      FROM public.jobs
      WHERE slug = final_slug
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;

    NEW.slug := final_slug;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.jobs
SET slug = NULL
WHERE slug IS NULL OR btrim(slug) = '';

UPDATE public.jobs
SET title = title
WHERE slug IS NULL OR btrim(slug) = '';