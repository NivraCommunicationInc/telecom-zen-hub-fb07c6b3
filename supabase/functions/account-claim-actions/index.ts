// account-claim-actions — Phase 21
// Permet à un utilisateur qui vient de créer un compte de revendiquer
// les commandes, soumissions et documents associés à son email,
// après vérification par code OTP envoyé par courriel.
//
// Actions:
//   - detect       : compte les enregistrements rattachables (auth requis)
//   - request_code : génère + envoie un code OTP 6 chiffres (rate limited)
//   - verify_code  : valide le code et applique le claim
//
// Sécurité: SECURITY DEFINER côté SQL pour `apply_email_claim`,
// rate limit 3 demandes/heure/email, expiration 10 min, max 5 tentatives.

import { createClient } from "npm:@supabase/supabase-js@2";
import { violetShell } from "../_shared/violetEmailShell.ts";
import { sendResendEmail } from "../_shared/resendGateway.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  action: "detect" | "request_code" | "verify_code";
  code?: string;
}

const FROM_EMAIL = "Nivra <noreply@nivra-telecom.ca>";
const BRAND_BLUE = "#0066CC";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildEmailHtml(code: string, email: string, counts: any): string {
  const parts: string[] = [];
  if (counts.orders > 0) parts.push(`<strong>${counts.orders} commande(s)</strong>`);
  if (counts.quotes > 0) parts.push(`<strong>${counts.quotes} soumission(s)</strong>`);
  if (counts.auto_docs > 0) parts.push(`<strong>${counts.auto_docs} document(s)</strong>`);
  const recordList = parts.length > 0 ? parts.join(", ") : "des enregistrements";

  return violetShell({
    badge: "VÉRIFICATION DE COMPTE",
    heroTitle: "Vérifiez votre adresse courriel",
    bodyHtml: `Nous avons détecté que l'adresse <strong>${email}</strong> est associée à ${recordList} que vous pouvez rattacher à votre compte Nivra. Pour confirmer que cette adresse vous appartient, entrez le code ci-dessous dans votre portail :`,
    extraBodyHtml: `
      <div style="text-align:center;padding:24px;background:#E6F0FA;border-radius:8px;margin:0 0 20px;">
        <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#0066CC;font-family:'Courier New',monospace;">${code}</div>
      </div>`,
    helpHtml: `⏱️ Ce code expire dans <strong>10 minutes</strong>.<br/>🔒 Si vous n'êtes pas à l'origine de cette demande, ignorez ce courriel.`,
    helpVariant: "warning",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const user = userData.user;
    const userEmail = (user.email || "").trim().toLowerCase();
    if (!userEmail) return json({ error: "no_email_on_account" }, 400);

    const body = (await req.json()) as Body;

    // ──────────────────────────────────────────────
    // DETECT — counts only, no data leak
    // ──────────────────────────────────────────────
    if (body.action === "detect") {
      const { data, error } = await admin.rpc("count_claimable_records", { _email: userEmail });
      if (error) throw error;
      return json({ ok: true, email: userEmail, counts: data ?? { total: 0 } });
    }

    // ──────────────────────────────────────────────
    // REQUEST CODE — rate limit + send email
    // ──────────────────────────────────────────────
    if (body.action === "request_code") {
      // Rate limit: max 3 requests / hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await admin
        .from("email_claim_challenges")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", oneHourAgo);

      if ((recentCount ?? 0) >= 3) {
        return json({ error: "rate_limited", message: "Trop de demandes. Réessayez dans 1 heure." }, 429);
      }

      // Check there's actually something to claim
      const { data: countsData } = await admin.rpc("count_claimable_records", { _email: userEmail });
      const counts = countsData ?? { total: 0, orders: 0, quotes: 0, auto_docs: 0 };
      if ((counts.total ?? 0) === 0) {
        return json({ error: "nothing_to_claim" }, 400);
      }

      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256Hex(code);

      const { error: insertErr } = await admin
        .from("email_claim_challenges")
        .insert({
          user_id: user.id,
          target_email: userEmail,
          code_hash: codeHash,
        });
      if (insertErr) throw insertErr;

      // Send email via Resend connector gateway
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        try {
          const html = buildEmailHtml(code, userEmail, counts);
          const r = await sendResendEmail({
            from: FROM_EMAIL,
            to: [userEmail],
            subject: "Code de vérification Nivra — Rattachement de vos commandes",
            html,
          });
          if (!r.ok) console.error("Resend gateway send failed", r.error);
        } catch (e) {
          console.error("Resend send failed", e);
        }
      } else {
        console.warn("RESEND_API_KEY not set — code generated but not emailed:", code);
      }


      // Audit
      await admin.from("admin_audit_log").insert({
        admin_user_id: user.id,
        admin_email: userEmail,
        action: "account_ops.claim_request",
        target_type: "user",
        target_id: user.id,
        target_email: userEmail,
        details: { counts },
      });

      return json({ ok: true, sent_to: userEmail, expires_in_minutes: 10 });
    }

    // ──────────────────────────────────────────────
    // VERIFY CODE
    // ──────────────────────────────────────────────
    if (body.action === "verify_code") {
      const code = (body.code || "").trim();
      if (!/^\d{6}$/.test(code)) return json({ error: "invalid_code_format" }, 400);

      const codeHash = await sha256Hex(code);

      // Find latest valid challenge for this user
      const { data: challenges } = await admin
        .from("email_claim_challenges")
        .select("id, code_hash, attempts, expires_at, verified_at")
        .eq("user_id", user.id)
        .eq("target_email", userEmail)
        .is("verified_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      const challenge = challenges?.[0];
      if (!challenge) return json({ error: "no_valid_challenge", message: "Aucun code actif. Demandez-en un nouveau." }, 400);

      if ((challenge.attempts ?? 0) >= 5) {
        return json({ error: "too_many_attempts", message: "Trop de tentatives. Demandez un nouveau code." }, 429);
      }

      if (challenge.code_hash !== codeHash) {
        await admin
          .from("email_claim_challenges")
          .update({ attempts: (challenge.attempts ?? 0) + 1 })
          .eq("id", challenge.id);
        const remaining = 5 - ((challenge.attempts ?? 0) + 1);
        return json({ error: "bad_code", remaining_attempts: Math.max(0, remaining) }, 400);
      }

      // Mark verified
      await admin
        .from("email_claim_challenges")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", challenge.id);

      // Apply claim
      const { data: applyResult, error: applyErr } = await admin.rpc("apply_email_claim", {
        _user_id: user.id,
        _email: userEmail,
      });
      if (applyErr) throw applyErr;

      return json({ ok: true, applied: applyResult });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("account-claim-actions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
