/**
 * public-invoice-lookup — Recherche 2-facteurs pour /payer (page publique sans auth).
 *
 * Sécurité :
 * - Rate limit 3 tentatives/IP/heure (verrou 1h).
 * - Log toutes tentatives (succès + échec) dans activity_logs.
 * - Ne révèle jamais quel champ a échoué.
 * - Retourne uniquement la facture ciblée — jamais les autres factures / soldes.
 *
 * Champ 1 (reference) : invoice_number OU account_number OU profiles.client_number
 * Champ 2 (identity)  : email OU phone (E.164 ou 10 chiffres)
 *
 * Les deux doivent résoudre au MÊME customer_id/user_id.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 60 * 60 * 1000;

function getIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function normalizePhone(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(raw.trim());
  variants.add(digits);
  if (digits.length === 10) {
    variants.add(`+1${digits}`);
    variants.add(`1${digits}`);
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    variants.add(`+${digits}`);
    variants.add(digits.slice(1));
  }
  return [...variants].filter(Boolean);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const ip = getIp(req);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const rateKey = `public-pay-search:${ip}`;
  const userAgent = req.headers.get("user-agent") || "";

  // Log attempt helper
  const logAttempt = async (success: boolean, reference: string, extra?: Record<string, unknown>) => {
    const refHash = reference
      ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(reference))))
          .slice(0, 8)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      : "";
    try {
      await supabase.from("activity_logs").insert({
        action: success ? "public_pay_lookup_success" : "public_pay_lookup_failed",
        entity_type: "billing_invoice",
        details: { ip, user_agent: userAgent, reference_hash: refHash, ...extra },
      });
    } catch (e) {
      console.warn("[public-invoice-lookup] log failed:", e);
    }
  };

  try {
    // ── Rate limit check (via existing tables) ────────────────────────────
    const { data: lockout } = await supabase
      .from("rate_limit_lockouts")
      .select("locked_until")
      .eq("key", rateKey)
      .gt("locked_until", new Date().toISOString())
      .maybeSingle();

    if (lockout) {
      const secs = Math.max(1, Math.ceil((new Date(lockout.locked_until).getTime() - Date.now()) / 1000));
      return json({
        ok: false,
        error: `Trop de tentatives. Réessayez dans ${Math.ceil(secs / 60)} minutes.`,
        retry_after: secs,
      }, 429);
    }

    const { count: attempts } = await supabase
      .from("rate_limit_attempts")
      .select("*", { count: "exact", head: true })
      .eq("key", rateKey)
      .gte("created_at", new Date(Date.now() - WINDOW_MS).toISOString());

    if ((attempts || 0) >= MAX_ATTEMPTS) {
      // Create lockout
      await supabase.from("rate_limit_lockouts").upsert(
        { key: rateKey, locked_until: new Date(Date.now() + WINDOW_MS).toISOString() },
        { onConflict: "key" },
      );
      await logAttempt(false, "", { reason: "rate_limited" });
      return json({
        ok: false,
        error: "Trop de tentatives. Réessayez dans 60 minutes.",
        retry_after: 3600,
      }, 429);
    }

    // ── Parse input ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const reference = String(body?.reference || "").trim();
    const identity = String(body?.identity || "").trim();

    if (!reference || !identity) {
      return json({ ok: false, error: "Les deux champs sont requis." }, 400);
    }

    // Record attempt (fires whether success or fail)
    await supabase.from("rate_limit_attempts").insert({ key: rateKey });

    // ── Resolve reference → invoice ─────────────────────────────────────
    let invoice: any = null;
    const refNorm = reference.replace(/\s+/g, "").toUpperCase();
    const identityLower = identity.toLowerCase();
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // ── 0a. Already-paid check (block double payment) ──────────────────
    // If the NVR reference matches a completed payment → reply "already paid".
    if (refNorm.startsWith("NVR-")) {
      const { data: paid } = await supabase
        .from("billing_payments")
        .select("nivra_reference, amount, processed_at, created_at, status")
        .ilike("nivra_reference", refNorm)
        .in("status", ["succeeded", "completed", "captured", "paid"])
        .order("processed_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (paid) {
        await logAttempt(false, reference, { reason: "already_paid_nvr" });
        return json({
          ok: false,
          already_paid: true,
          error: `Cette facture a déjà été payée le ${new Date(paid.processed_at || paid.created_at).toLocaleDateString("fr-CA")} — montant : ${Number(paid.amount).toFixed(2)} $ CAD.`,
        }, 200);
      }
    }

    // ── 0b. NVR-XXXX or raw UUID token → redirect to /payer/lien/:token ─
    {
      const isUuid = UUID_RE.test(reference.trim());
      const isNvr = refNorm.startsWith("NVR-");
      if (isUuid || isNvr) {
        let q = supabase
          .from("public_payment_links")
          .select("public_token, recipient_email, status, amount, expires_at")
          .limit(1);
        q = isUuid ? q.eq("public_token", reference.trim()) : q.ilike("nivra_reference", refNorm);
        const { data: link } = await q.maybeSingle();
        if (link) {
          if (link.status === "paid" || link.status === "completed") {
            await logAttempt(false, reference, { reason: "already_paid_link" });
            return json({
              ok: false,
              already_paid: true,
              error: `Cette facture a déjà été payée — montant : ${Number(link.amount).toFixed(2)} $ CAD.`,
            }, 200);
          }
          if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
            await logAttempt(false, reference, { reason: "link_expired" });
            return json({
              ok: false,
              error: "Ce lien a expiré — contactez support@nivra-telecom.ca.",
            }, 410);
          }
          // Email match required (case-insensitive)
          const emailOk = link.recipient_email && link.recipient_email.toLowerCase() === identityLower;
          if (!emailOk) {
            await logAttempt(false, reference, { reason: "link_identity_mismatch" });
            return json({ ok: false, error: "Aucun dossier trouvé. Vérifiez les informations." }, 404);
          }
          await supabase.from("rate_limit_attempts").delete().eq("key", rateKey);
          await logAttempt(true, reference, { link_token: link.public_token });
          return json({
            ok: true,
            redirect_token: link.public_token,
          });
        }
      }
    }

    // Try invoice_number first
    {
      const { data } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, customer_id, total, balance_due, status, due_date, cycle_start_date, cycle_end_date")
        .ilike("invoice_number", refNorm)
        .maybeSingle();
      if (data) invoice = data;
    }

    // Try account_number → find most recent unpaid invoice for customer
    if (!invoice) {
      const { data: acc } = await supabase
        .from("accounts")
        .select("id, client_id")
        .ilike("account_number", refNorm)
        .maybeSingle();
      if (acc?.client_id) {
        const { data: bc } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("user_id", acc.client_id)
          .maybeSingle();
        if (bc?.id) {
          const { data: inv } = await supabase
            .from("billing_invoices")
            .select("id, invoice_number, customer_id, total, balance_due, status, due_date, cycle_start_date, cycle_end_date")
            .eq("customer_id", bc.id)
            .gt("balance_due", 0)
            .order("due_date", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (inv) invoice = inv;
        }
      }
    }

    // Try profiles.client_number → same logic
    if (!invoice) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .ilike("client_number", refNorm)
        .maybeSingle();
      if (prof?.id) {
        const { data: bc } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("user_id", prof.id)
          .maybeSingle();
        if (bc?.id) {
          const { data: inv } = await supabase
            .from("billing_invoices")
            .select("id, invoice_number, customer_id, total, balance_due, status, due_date, cycle_start_date, cycle_end_date")
            .eq("customer_id", bc.id)
            .gt("balance_due", 0)
            .order("due_date", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (inv) invoice = inv;
        }
      }
    }

    if (!invoice) {
      await logAttempt(false, reference, { reason: "reference_not_found" });
      return json({ ok: false, error: "Aucun dossier trouvé. Vérifiez les informations." }, 404);
    }

    if (Number(invoice.balance_due) <= 0) {
      await logAttempt(false, reference, { reason: "already_paid", invoice_id: invoice.id });
      return json({ ok: false, error: "Cette facture est déjà payée." }, 400);
    }

    // ── Resolve identity → must match invoice.customer_id ──────────────
    const { data: bcust } = await supabase
      .from("billing_customers")
      .select("id, user_id, email, phone, first_name, last_name")
      .eq("id", invoice.customer_id)
      .maybeSingle();

    if (!bcust) {
      await logAttempt(false, reference, { reason: "customer_missing", invoice_id: invoice.id });
      return json({ ok: false, error: "Aucun dossier trouvé. Vérifiez les informations." }, 404);
    }

    // Match on email OR phone (case-insensitive; phone normalized)
    const identityLower = identity.toLowerCase();
    const emailMatch = bcust.email && bcust.email.toLowerCase() === identityLower;
    let phoneMatch = false;
    if (bcust.phone) {
      const variants = normalizePhone(identity);
      const bcVariants = normalizePhone(bcust.phone);
      phoneMatch = variants.some((v) => bcVariants.includes(v));
    }

    // Also try profiles.email / profiles.phone for the same user
    let profileMatch = false;
    if (!emailMatch && !phoneMatch && bcust.user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("email, phone")
        .eq("id", bcust.user_id)
        .maybeSingle();
      if (prof) {
        if (prof.email && prof.email.toLowerCase() === identityLower) profileMatch = true;
        if (!profileMatch && prof.phone) {
          const v1 = normalizePhone(identity);
          const v2 = normalizePhone(prof.phone);
          profileMatch = v1.some((v) => v2.includes(v));
        }
      }
    }

    if (!emailMatch && !phoneMatch && !profileMatch) {
      await logAttempt(false, reference, { reason: "identity_mismatch", invoice_id: invoice.id });
      return json({ ok: false, error: "Aucun dossier trouvé. Vérifiez les informations." }, 404);
    }

    // ── Success: reset counter and return sanitized data ───────────────
    await supabase.from("rate_limit_attempts").delete().eq("key", rateKey);
    await logAttempt(true, reference, { invoice_id: invoice.id });

    return json({
      ok: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total: Number(invoice.total),
        balance_due: Number(invoice.balance_due),
        due_date: invoice.due_date,
        cycle_start_date: invoice.cycle_start_date,
        cycle_end_date: invoice.cycle_end_date,
        first_name: bcust.first_name || "Client",
        email: bcust.email || null,
      },
    });
  } catch (e: any) {
    console.error("[public-invoice-lookup] fatal:", e);
    return json({ ok: false, error: "Erreur temporaire. Réessayez." }, 500);
  }
});
