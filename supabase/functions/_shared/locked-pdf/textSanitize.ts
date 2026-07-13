const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  aacute: "á", agrave: "à", acirc: "â", auml: "ä",
  ccedil: "ç", iacute: "í", igrave: "ì", icirc: "î", iuml: "ï",
  oacute: "ó", ograve: "ò", ocirc: "ô", ouml: "ö",
  uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü",
};

export function cleanPdfText(value: unknown, fallback = "—"): string {
  let text = String(value ?? "").trim();
  if (!text) return fallback;

  const initialAmpCount = (text.match(/&/g) || []).length;
  if (initialAmpCount >= 3 && initialAmpCount / Math.max(text.length, 1) > 0.12) {
    text = text.replace(/&+/g, "");
  }

  // Strip Minecraft/legacy formatting codes (&1, &e, &r, etc.) when not character-corrupted.
  text = text.replace(/[&§][0-9a-fk-or]/gi, "");

  text = text
    .replace(/&([a-z]+);/gi, (_m, name) => HTML_ENTITIES[String(name).toLowerCase()] ?? _m)
    .replace(/&#(\d+);/g, (_m, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _m;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : _m;
    });

  const ampCount = (text.match(/&/g) || []).length;
  if (ampCount >= 3 && ampCount / Math.max(text.length, 1) > 0.12) {
    text = text.replace(/&+/g, "");
  }

  text = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}