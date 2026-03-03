/**
 * Edge Function: process-id-ocr
 * Extracts data from ID documents using AWS Textract.
 * Compares extracted fields to checkout_fields and stores match_result.
 * Called internally after document submission (from submit-id-verification or admin trigger).
 * 
 * Supported documents: CA Driver License, CA Health Card, PR Card, CA Passport, Intl Passport.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedFields {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  document_number?: string;
  expiry_date?: string;
  document_type?: string;
  issuing_province?: string;
  issuing_country?: string;
  mrz_raw?: string;
}

interface MatchResult {
  match_score: number;
  status: "approved_candidate" | "partial_match" | "mismatch" | "extraction_failed";
  mismatch_fields: Record<string, { expected: string; extracted: string; severity: "strict" | "fuzzy" | "normalized" }>;
  extracted_fields: ExtractedFields;
  policy_notes: string[];
}

/** Normalize: lowercase, strip accents, remove non-alphanumeric */
function normalize(val: string | undefined | null): string {
  if (!val) return "";
  return val.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

/** Normalize document number: uppercase, strip dashes/spaces/dots */
function normalizeDocNum(val: string | undefined | null): string {
  if (!val) return "";
  return val.trim().toUpperCase().replace(/[\s\-\.]/g, "");
}

/** Normalize date to YYYY-MM-DD for strict comparison */
function normalizeDate(d: string): string {
  const parts = d.replace(/[\/\.\-]/g, "-").split("-");
  if (parts.length !== 3) return d;
  if (parts[0].length === 4) return parts.join("-");
  if (parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return parts.join("-");
}

function compareDatesStrict(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return normalizeDate(a) === normalizeDate(b);
}

/** Levenshtein distance for fuzzy name matching */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Fuzzy name match: normalize + allow Levenshtein ≤ 2 for OCR typos */
function fuzzyNameMatch(extracted: string | undefined, expected: string | undefined): boolean {
  if (!extracted || !expected) return false;
  const a = normalize(extracted);
  const b = normalize(expected);
  if (a === b) return true;
  // Allow up to 2 edit distance for OCR typos (e.g. TREMBLAI vs TREMBLAY)
  return levenshtein(a, b) <= 2;
}

/** Document number match: normalize (strip dashes/spaces) then compare */
function docNumMatch(extracted: string | undefined, expected: string | undefined): boolean {
  if (!extracted || !expected) return false;
  return normalizeDocNum(extracted) === normalizeDocNum(expected);
}

/**
 * 3-tier matching policy:
 * - DOB + expiry: STRICT match (mandatory, blocks on fail)
 * - Names: FUZZY tolerance (accents/case + Levenshtein ≤ 2)
 * - Document number: NORMALIZED (strip dashes/spaces) + limited tolerance
 * 
 * Result statuses:
 *   approved_candidate: all fields match → ready for admin approval
 *   partial_match: names fuzzy mismatch but dates OK → urgent admin review
 *   mismatch: strict field (DOB/expiry) fails → block + urgent notification
 */
function computeMatch(extracted: ExtractedFields, checkout: Record<string, unknown>): MatchResult {
  const mismatches: Record<string, { expected: string; extracted: string; severity: "strict" | "fuzzy" | "normalized" }> = {};
  const notes: string[] = [];
  let hasStrictFail = false;
  let hasFuzzyFail = false;

  // STRICT: date_of_birth (mandatory)
  const expectedDob = checkout.date_of_birth as string;
  if (expectedDob) {
    if (!compareDatesStrict(extracted.date_of_birth, expectedDob)) {
      mismatches.date_of_birth = { expected: expectedDob, extracted: extracted.date_of_birth || "", severity: "strict" };
      hasStrictFail = true;
      notes.push("DOB mismatch (strict) — BLOQUANT");
    }
  }

  // STRICT: expiry_date (mandatory if provided)
  const expectedExpiry = checkout.expiry_date as string;
  if (expectedExpiry) {
    if (!compareDatesStrict(extracted.expiry_date, expectedExpiry)) {
      mismatches.expiry_date = { expected: expectedExpiry, extracted: extracted.expiry_date || "", severity: "strict" };
      hasStrictFail = true;
      notes.push("Expiry mismatch (strict) — BLOQUANT");
    }
  }

  // FUZZY: first_name
  const expectedFirst = checkout.first_name as string;
  if (expectedFirst) {
    if (!fuzzyNameMatch(extracted.first_name, expectedFirst)) {
      mismatches.first_name = { expected: expectedFirst, extracted: extracted.first_name || "", severity: "fuzzy" };
      hasFuzzyFail = true;
      notes.push(`Prénom fuzzy mismatch (Levenshtein > 2): "${extracted.first_name}" vs "${expectedFirst}"`);
    }
  }

  // FUZZY: last_name
  const expectedLast = checkout.last_name as string;
  if (expectedLast) {
    if (!fuzzyNameMatch(extracted.last_name, expectedLast)) {
      mismatches.last_name = { expected: expectedLast, extracted: extracted.last_name || "", severity: "fuzzy" };
      hasFuzzyFail = true;
      notes.push(`Nom fuzzy mismatch (Levenshtein > 2): "${extracted.last_name}" vs "${expectedLast}"`);
    }
  }

  // NORMALIZED: document_number
  const expectedDocNum = checkout.document_number as string;
  if (expectedDocNum) {
    if (!docNumMatch(extracted.document_number, expectedDocNum)) {
      mismatches.document_number = { expected: expectedDocNum, extracted: extracted.document_number || "", severity: "normalized" };
      hasFuzzyFail = true;
      notes.push(`Numéro document mismatch après normalisation: "${normalizeDocNum(extracted.document_number)}" vs "${normalizeDocNum(expectedDocNum)}"`);
    }
  }

  const totalChecked = Object.keys(mismatches).length + 
    (expectedDob && !mismatches.date_of_birth ? 1 : 0) +
    (expectedExpiry && !mismatches.expiry_date ? 1 : 0) +
    (expectedFirst && !mismatches.first_name ? 1 : 0) +
    (expectedLast && !mismatches.last_name ? 1 : 0) +
    (expectedDocNum && !mismatches.document_number ? 1 : 0);

  const matchedCount = totalChecked - Object.keys(mismatches).length;
  const score = totalChecked > 0 ? Math.round((matchedCount / totalChecked) * 100) : 0;

  let status: MatchResult["status"];
  if (totalChecked === 0) {
    status = "extraction_failed";
    notes.push("Aucun champ extrait pour comparaison");
  } else if (hasStrictFail) {
    status = "mismatch";
    notes.push("BLOQUÉ: champ strict (DOB/expiry) ne correspond pas");
  } else if (hasFuzzyFail) {
    status = "partial_match";
    notes.push("Révision urgente: champs fuzzy ne correspondent pas");
  } else {
    status = "approved_candidate";
    notes.push("Tous les champs correspondent — candidat à l'approbation admin");
  }

  return {
    match_score: score,
    status,
    mismatch_fields: mismatches,
    extracted_fields: extracted,
    policy_notes: notes,
  };
}

/** Parse MRZ lines from passport (Type 3, 2 lines of 44 chars) */
function parseMRZ(text: string): ExtractedFields | null {
  // Find MRZ-like lines (uppercase + < + digits)
  const lines = text.split("\n")
    .map(l => l.trim())
    .filter(l => /^[A-Z0-9<]{30,}$/.test(l.replace(/\s/g, "")));

  if (lines.length < 2) return null;

  const line1 = lines[lines.length - 2].replace(/\s/g, "");
  const line2 = lines[lines.length - 1].replace(/\s/g, "");

  try {
    // Line 1: P<COUNTRY<<LAST_NAME<<FIRST_NAME<<...
    const namePart = line1.substring(5);
    const [lastRaw, ...firstParts] = namePart.split("<<");
    const last_name = lastRaw.replace(/</g, " ").trim();
    const first_name = firstParts.join(" ").replace(/</g, " ").trim();

    // Line 2: PASSPORT_NUM<CHECK DOB CHECK SEX EXPIRY CHECK ...
    const document_number = line2.substring(0, 9).replace(/</g, "").trim();
    const dobRaw = line2.substring(13, 19);
    const expiryRaw = line2.substring(21, 27);

    const parseDate = (raw: string) => {
      if (raw.length !== 6) return undefined;
      const yy = parseInt(raw.substring(0, 2));
      const mm = raw.substring(2, 4);
      const dd = raw.substring(4, 6);
      const year = yy > 30 ? 1900 + yy : 2000 + yy;
      return `${year}-${mm}-${dd}`;
    };

    const issuing_country = line1.substring(2, 5).replace(/</g, "").trim();

    return {
      first_name,
      last_name,
      date_of_birth: parseDate(dobRaw),
      document_number,
      expiry_date: parseDate(expiryRaw),
      document_type: "passport",
      issuing_country,
      mrz_raw: `${line1}\n${line2}`,
    };
  } catch {
    return null;
  }
}

async function callTextract(imageBytes: Uint8Array): Promise<{ blocks: any[] }> {
  const region = Deno.env.get("AWS_REGION") || "ca-central-1";
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!;
  const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;

  const payload = JSON.stringify({
    Document: { Bytes: btoa(String.fromCharCode(...imageBytes)) },
    FeatureTypes: ["FORMS"],
  });

  // AWS Signature V4 for Textract
  const endpoint = `https://textract.${region}.amazonaws.com`;
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").substring(0, 8);
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

  // Simplified HMAC-SHA256 signing
  const encoder = new TextEncoder();

  async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(msg));
  }

  async function sha256(msg: string): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", encoder.encode(msg));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  const service = "textract";
  const host = `textract.${region}.amazonaws.com`;
  const canonicalUri = "/";
  const canonicalQuerystring = "";
  const payloadHash = await sha256(payload);
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:Textract.AnalyzeDocument\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest = `POST\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const kDate = await hmac(encoder.encode("AWS4" + secretKey), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = Array.from(new Uint8Array(await hmac(kSigning, stringToSign))).map(b => b.toString(16).padStart(2, "0")).join("");

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Date": amzDate,
      "X-Amz-Target": "Textract.AnalyzeDocument",
      "Authorization": authHeader,
      "Host": host,
    },
    body: payload,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Textract API error ${response.status}: ${errText}`);
  }

  return await response.json();
}

function extractFieldsFromTextract(blocks: any[], documentType?: string): ExtractedFields {
  const fields: ExtractedFields = {};

  // Collect all text
  const allText = blocks
    .filter((b: any) => b.BlockType === "LINE")
    .map((b: any) => b.Text)
    .join("\n");

  // Try MRZ parse for passports
  if (documentType?.includes("passport") || allText.includes("P<")) {
    const mrzResult = parseMRZ(allText);
    if (mrzResult) return mrzResult;
  }

  // Extract key-value pairs from FORMS
  const keyMap = new Map<string, string>();
  const keyBlocks = blocks.filter((b: any) => b.BlockType === "KEY_VALUE_SET" && b.EntityTypes?.includes("KEY"));

  for (const keyBlock of keyBlocks) {
    const keyText = (keyBlock.Relationships || [])
      .filter((r: any) => r.Type === "CHILD")
      .flatMap((r: any) => r.Ids)
      .map((id: string) => blocks.find((b: any) => b.Id === id))
      .filter(Boolean)
      .map((b: any) => b.Text || "")
      .join(" ");

    const valueIds = (keyBlock.Relationships || [])
      .filter((r: any) => r.Type === "VALUE")
      .flatMap((r: any) => r.Ids);

    for (const vid of valueIds) {
      const valueBlock = blocks.find((b: any) => b.Id === vid);
      if (valueBlock) {
        const valueText = (valueBlock.Relationships || [])
          .filter((r: any) => r.Type === "CHILD")
          .flatMap((r: any) => r.Ids)
          .map((id: string) => blocks.find((b: any) => b.Id === id))
          .filter(Boolean)
          .map((b: any) => b.Text || "")
          .join(" ");
        keyMap.set(keyText.toLowerCase().trim(), valueText.trim());
      }
    }
  }

  // Map common field names
  const nameAliases = ["name", "nom", "full name", "nom complet"];
  const firstNameAliases = ["first name", "prénom", "given name", "prenom"];
  const lastNameAliases = ["last name", "nom de famille", "surname", "family name"];
  const dobAliases = ["date of birth", "dob", "date de naissance", "birth date", "born", "né(e) le"];
  const docNumAliases = ["document number", "no.", "numéro", "licence", "license", "card number", "no"];
  const expiryAliases = ["expiry", "exp", "expires", "expiration", "date d'expiration", "valid until"];
  const provinceAliases = ["province", "prov", "issued in", "émis par"];

  for (const [key, value] of keyMap) {
    if (firstNameAliases.some(a => key.includes(a))) fields.first_name = value;
    else if (lastNameAliases.some(a => key.includes(a))) fields.last_name = value;
    else if (nameAliases.some(a => key === a)) {
      const parts = value.split(/\s+/);
      if (parts.length >= 2) {
        fields.first_name = parts[0];
        fields.last_name = parts.slice(1).join(" ");
      }
    }
    else if (dobAliases.some(a => key.includes(a))) fields.date_of_birth = value;
    else if (docNumAliases.some(a => key.includes(a))) fields.document_number = value;
    else if (expiryAliases.some(a => key.includes(a))) fields.expiry_date = value;
    else if (provinceAliases.some(a => key.includes(a))) fields.issuing_province = value;
  }

  fields.document_type = documentType || "unknown";
  return fields;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get session
    const { data: session, error: sessionErr } = await supabase
      .from("identity_verification_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download front document from storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from("id-documents")
      .download(session.document_front_path);

    if (dlError || !fileData) {
      console.error("Download error:", dlError);
      // Save extraction failure
      await supabase.from("identity_verification_sessions").update({
        extracted_fields: { error: "download_failed" },
        match_result: { status: "extraction_failed", match_score: 0, mismatch_fields: {} },
      }).eq("id", session_id);

      return new Response(JSON.stringify({ error: "Failed to download document" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageBytes = new Uint8Array(await fileData.arrayBuffer());

    // Check if AWS credentials are configured
    const hasAWS = Deno.env.get("AWS_ACCESS_KEY_ID") && Deno.env.get("AWS_SECRET_ACCESS_KEY");

    let extractedFields: ExtractedFields;

    if (hasAWS) {
      console.log("[OCR] Calling AWS Textract...");
      const textractResult = await callTextract(imageBytes);
      extractedFields = extractFieldsFromTextract(textractResult.blocks || [], session.document_type || session.id_type);
    } else {
      console.log("[OCR] AWS not configured, skipping extraction");
      extractedFields = { document_type: session.document_type || session.id_type || "unknown" };
    }

    // Compute match against checkout fields
    const checkoutFields = session.checkout_fields || {};
    const matchResult = computeMatch(extractedFields, checkoutFields);

    // Update session with OCR results AND transition to manual_review
    await supabase.from("identity_verification_sessions").update({
      extracted_fields: extractedFields,
      match_result: matchResult,
      status: "manual_review",
    }).eq("id", session_id);

    // Log OCR event
    await supabase.from("identity_verification_events").insert({
      session_id,
      event_type: "ocr_completed",
      actor_id: session.user_id,
      actor_role: "system",
      details: { match_score: matchResult.match_score, status: matchResult.status },
    });

    // Create admin notification for manual review (always required)
    await supabase.from("admin_notification_logs").insert({
      event_type: "kyc_manual_review_required",
      event_id: session_id,
      priority: "high",
    });

    // If mismatch, create ADDITIONAL urgent admin notification
    if (matchResult.status === "mismatch" || matchResult.status === "partial_match") {
      await supabase.from("admin_notification_logs").insert({
        event_type: "kyc_mismatch_detected",
        event_id: session_id,
        priority: matchResult.status === "mismatch" ? "urgent" : "high",
      });

      await supabase.from("identity_verification_events").insert({
        session_id,
        event_type: "mismatch_flagged",
        actor_id: session.user_id,
        actor_role: "system",
        details: { mismatch_fields: matchResult.mismatch_fields, score: matchResult.match_score },
      });
    }

    return new Response(JSON.stringify({
      match_score: matchResult.match_score,
      status: matchResult.status,
      mismatch_fields: matchResult.mismatch_fields,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("OCR processing error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
