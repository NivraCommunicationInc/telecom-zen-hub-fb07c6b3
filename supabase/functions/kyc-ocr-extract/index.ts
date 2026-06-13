/**
 * kyc-ocr-extract
 *
 * Extrait automatiquement nom + date de naissance d'une pièce d'identité KYC
 * via Claude Vision (claude-haiku-4-5-20251001), et pré-remplit le profil client.
 *
 * Auth : service role uniquement (appelé après submit-id-verification ou par admin).
 *
 * POST body : {
 *   session_id: string;         // identity_verification_sessions.id
 *   storage_path?: string;      // path in id-documents bucket (override)
 *   user_id?: string;           // to pre-fill profiles (override)
 * }
 *
 * Returns : { success, extracted: { full_name, first_name, last_name, date_of_birth,
 *              expiry_date, id_number, document_type, confidence }, profile_updated }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;
const CLAUDE_MODEL     = "claude-haiku-4-5-20251001";

const BUCKET = "id-documents";

// ── Claude Vision OCR ──────────────────────────────────────────────────────
async function ocrIdentityDocument(imageBase64: string, mediaType: string): Promise<{
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  expiry_date: string | null;
  id_number: string | null;
  document_type: string | null;
  confidence: number;
}> {
  const prompt = `Analyse cette pièce d'identité et extrais les informations suivantes.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après.

Format de réponse:
{
  "full_name": "Prénom Nom complet tel qu'il apparaît",
  "first_name": "Prénom(s)",
  "last_name": "Nom de famille",
  "date_of_birth": "AAAA-MM-JJ ou null si illisible",
  "expiry_date": "AAAA-MM-JJ ou null si non visible",
  "id_number": "numéro du document ou null",
  "document_type": "permis_conduite | passeport | carte_identite | autre",
  "confidence": 0.0 à 1.0
}

Si un champ est illisible ou non visible, utilise null.
Ne fais aucune hypothèse. Ne complète pas les informations manquantes.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${err.slice(0, 200)}`);
  }

  const body = await resp.json();
  const text: string = body.content?.[0]?.text ?? "{}";

  // Parse JSON from response (handle potential markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Claude response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    full_name: parsed.full_name || null,
    first_name: parsed.first_name || null,
    last_name: parsed.last_name || null,
    date_of_birth: parsed.date_of_birth || null,
    expiry_date: parsed.expiry_date || null,
    id_number: parsed.id_number || null,
    document_type: parsed.document_type || null,
    confidence: Number(parsed.confidence) || 0,
  };
}

// ── Detect MIME type from file extension ───────────────────────────────────
function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" }[ext] ?? "image/jpeg";
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service role auth only — this function has privileged access
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.includes(SERVICE_ROLE_KEY)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: {
    session_id?: string;
    storage_path?: string;
    user_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { session_id, storage_path: overridePath, user_id: overrideUserId } = body;

  /* 1. Resolve storage paths + user_id from session if not overridden */
  let docPaths: string[] = [];
  let userId: string | null = overrideUserId ?? null;

  if (session_id) {
    const { data: session } = await admin
      .from("identity_verification_sessions")
      .select("document_paths, user_id, status")
      .eq("id", session_id)
      .maybeSingle();

    if (!session) {
      return new Response(JSON.stringify({ error: "Session introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paths = (session as any).document_paths;
    if (Array.isArray(paths) && paths.length > 0) {
      docPaths = paths.filter((p: any) => typeof p === "string");
    }
    if (!userId) userId = (session as any).user_id ?? null;
  }

  if (overridePath) docPaths = [overridePath, ...docPaths];
  if (docPaths.length === 0) {
    return new Response(JSON.stringify({ error: "Aucun document disponible pour l'OCR" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /* 2. Download the first document (front of ID) */
  const targetPath = docPaths[0];
  const mediaType = getMimeType(targetPath);

  // Only image files can be processed by Claude Vision
  if (mediaType === "application/pdf") {
    return new Response(JSON.stringify({ error: "Les fichiers PDF ne sont pas supportés pour l'OCR — envoyez une image (jpg/png)" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: fileData, error: dlErr } = await admin.storage
    .from(BUCKET)
    .download(targetPath);

  if (dlErr || !fileData) {
    return new Response(JSON.stringify({ error: `Fichier introuvable: ${dlErr?.message}` }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /* 3. Convert to base64 */
  const buf = await fileData.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  }
  const imageBase64 = btoa(binary);

  /* 4. Run OCR via Claude Vision */
  let extracted: Awaited<ReturnType<typeof ocrIdentityDocument>>;
  try {
    extracted = await ocrIdentityDocument(imageBase64, mediaType);
  } catch (e) {
    return new Response(JSON.stringify({ error: `OCR failed: ${(e as Error).message}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /* 5. Persist OCR result to identity_verification_sessions metadata */
  if (session_id) {
    await admin
      .from("identity_verification_sessions")
      .update({
        metadata: {
          ocr_result: extracted,
          ocr_completed_at: new Date().toISOString(),
          ocr_model: CLAUDE_MODEL,
        },
      } as any)
      .eq("id", session_id);
  }

  /* 6. Pre-fill profiles if confidence >= 0.70 and fields are empty */
  let profileUpdated = false;
  if (userId && extracted.confidence >= 0.70) {
    const { data: prof } = await admin
      .from("profiles")
      .select("first_name, last_name, full_name, date_of_birth")
      .eq("user_id", userId)
      .maybeSingle();

    const updates: Record<string, string> = {};

    // Only fill EMPTY fields — never overwrite existing data
    if (!((prof as any)?.first_name) && extracted.first_name) {
      updates.first_name = extracted.first_name;
    }
    if (!((prof as any)?.last_name) && extracted.last_name) {
      updates.last_name = extracted.last_name;
    }
    if (!((prof as any)?.full_name) && extracted.full_name) {
      updates.full_name = extracted.full_name;
    }
    if (!((prof as any)?.date_of_birth) && extracted.date_of_birth) {
      updates.date_of_birth = extracted.date_of_birth;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await admin
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);
      profileUpdated = !updErr;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      extracted,
      profile_updated: profileUpdated,
      doc_analyzed: targetPath,
      model: CLAUDE_MODEL,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
