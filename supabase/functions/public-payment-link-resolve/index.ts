// Resolve a public payment link (token) into a chargeable intent.
// verify_jwt = false by default (public endpoint).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: object, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string" || token.length < 16) {
      return json({ ok: false, error: "Lien invalide" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkError } = await supabase
      .from("public_payment_links")
      .select("id, token, nivra_reference, invoice_id, recipient_name, recipient_email, amount_due, description, expires_at, status, paid_at")
      .eq("token", token)
      .maybeSingle();

    if (linkError) return json({ ok: false, error: "Lien introuvable ou expiré" }, 404);
    if (link) {
      if (link.status === "paid" || link.status === "completed") {
        return json({ ok: false, error: "Cette facture a déjà été payée" }, 400);
      }
      if (link.status === "cancelled" || link.status === "canceled") {
        return json({ ok: false, error: "Ce lien de paiement a été annulé" }, 410);
      }
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return json({ ok: false, error: "Ce lien a expiré" }, 410);
      }

      const { data: intent } = await supabase
        .from("field_payment_intents")
        .select("id, amount, currency, status, customer_name, customer_email, description, expires_at, converted_invoice_id")
        .eq("public_token", token)
        .maybeSingle();

      if (!intent?.id) return json({ ok: false, error: "Intention de paiement introuvable" }, 404);
      if (intent?.status === "completed") return json({ ok: false, error: "Ce lien a déjà été payé" }, 400);

      let invoice_number: string | null = link.nivra_reference || null;
      if (link.invoice_id) {
        const { data: inv } = await supabase
          .from("billing_invoices")
          .select("invoice_number")
          .eq("id", link.invoice_id)
          .maybeSingle();
        invoice_number = inv?.invoice_number || link.nivra_reference || null;
      }

      return json({
        ok: true,
        intent: {
          id: intent.id,
          amount: Number(link.amount_due),
          currency: intent?.currency || "CAD",
          customer_name: link.recipient_name || intent?.customer_name || null,
          customer_email: link.recipient_email || intent?.customer_email || null,
          description: link.description || intent?.description || "Paiement Nivra Telecom",
          invoice_number,
        },
      });
    }

    const { data: intent, error } = await supabase
      .from("field_payment_intents")
      .select("id, amount, currency, status, customer_name, customer_email, description, expires_at, converted_invoice_id")
      .eq("public_token", token)
      .maybeSingle();

    if (error || !intent) return json({ ok: false, error: "Lien introuvable ou expiré" }, 404);
    if (intent.status === "completed") return json({ ok: false, error: "Ce lien a déjà été payé" }, 400);
    if (intent.expires_at && new Date(intent.expires_at) < new Date()) {
      return json({ ok: false, error: "Ce lien a expiré" }, 410);
    }

    let invoice_number: string | null = null;
    if (intent.converted_invoice_id) {
      const { data: inv } = await supabase
        .from("billing_invoices")
        .select("invoice_number")
        .eq("id", intent.converted_invoice_id)
        .maybeSingle();
      invoice_number = inv?.invoice_number || null;
    }

    return json({
      ok: true,
      intent: {
        id: intent.id,
        amount: Number(intent.amount),
        currency: intent.currency || "CAD",
        customer_name: intent.customer_name,
        customer_email: intent.customer_email,
        description: intent.description || "",
        invoice_number,
      },
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Erreur serveur" }, 500);
  }
});
