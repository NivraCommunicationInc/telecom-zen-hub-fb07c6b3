// communication-account-actions — Phase 13
// Staff-only: send a custom or template-based email to a client account.
// Logged in admin_audit_log under account_ops.communication_*.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

interface Body {
  action: "send_email" | "list_templates";
  client_user_id: string;
  client_email?: string | null;
  client_name?: string | null;
  account_id?: string | null;
  template_key?: string;
  subject?: string;
  body_text?: string; // plain text body, paragraphs separated by blank lines
  reason?: string;
}

const TEMPLATES: Record<string, { label: string; subject: string; body: string; badge?: string; heroTitle?: string }> = {
  custom: {
    label: "Message personnalisé",
    subject: "",
    body: "",
    badge: "Communication",
    heroTitle: "Message de l'équipe Nivra",
  },
  payment_reminder: {
    label: "Rappel de paiement",
    subject: "Rappel : facture en attente",
    badge: "Facturation",
    heroTitle: "Rappel de paiement",
    body:
      "Bonjour {{name}},\n\n" +
      "Nous avons remarqué qu'une facture demeure en attente sur votre compte. " +
      "Afin d'éviter toute interruption de service, nous vous invitons à régulariser le paiement dans les meilleurs délais.\n\n" +
      "Vous pouvez régler directement depuis votre espace client. Si le paiement a déjà été effectué, merci d'ignorer ce courriel.",
  },
  technical_followup: {
    label: "Suivi technique",
    subject: "Suivi de votre demande technique",
    badge: "Support technique",
    heroTitle: "Suivi de votre demande",
    body:
      "Bonjour {{name}},\n\n" +
      "Suite à votre demande, notre équipe technique a pris connaissance du dossier. " +
      "Nous reviendrons vers vous très rapidement avec les prochaines étapes.\n\n" +
      "Si vous souhaitez ajouter des informations utiles à l'analyse, vous pouvez répondre directement à ce courriel.",
  },
  welcome_back: {
    label: "Bienvenue (retour)",
    subject: "Heureux de vous revoir chez Nivra",
    badge: "Bienvenue",
    heroTitle: "Heureux de vous retrouver",
    body:
      "Bonjour {{name}},\n\n" +
      "Nous sommes heureux de vous compter à nouveau parmi nos clients. " +
      "Votre service est maintenant actif et notre équipe reste disponible pour toute question.",
  },
  account_review: {
    label: "Vérification du compte",
    subject: "Vérification de votre compte",
    badge: "Sécurité",
    heroTitle: "Vérification requise",
    body:
      "Bonjour {{name}},\n\n" +
      "Dans le cadre de la sécurité de votre compte, nous devons procéder à une vérification rapide. " +
      "Un agent de notre équipe pourrait communiquer avec vous afin de finaliser cette étape.",
  },
};

function renderBody(template: string, name: string): string {
  return template.replace(/\{\{name\}\}/g, name || "Bonjour");
}

function paragraphsToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
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
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: isStaffData } = await admin.rpc("has_staff_role", { _user_id: userData.user.id });
    if (isStaffData !== true) return json({ error: "forbidden" }, 403);

    const body = (await req.json()) as Body;

    if (body.action === "list_templates") {
      return json({
        ok: true,
        templates: Object.entries(TEMPLATES).map(([key, t]) => ({
          key, label: t.label, subject: t.subject, body: t.body,
        })),
      });
    }

    if (body.action !== "send_email") return json({ error: "unknown action" }, 400);
    if (!body.client_user_id) return json({ error: "client_user_id required" }, 400);
    if (!body.client_email) return json({ error: "client_email required" }, 400);

    const templateKey = body.template_key && TEMPLATES[body.template_key] ? body.template_key : "custom";
    const tpl = TEMPLATES[templateKey];

    const name = (body.client_name || "").trim() || "client";
    const subject = (body.subject?.trim() || tpl.subject || "Message Nivra Telecom").slice(0, 200);
    const rawBody = body.body_text?.trim() || renderBody(tpl.body, name);

    if (!rawBody) return json({ error: "Le contenu du message est requis" }, 400);

    const html = violetShell({
      preheader: subject,
      badge: tpl.badge ?? "Communication",
      heroTitle: tpl.heroTitle ?? subject,
      heroSub: "",
      bodyHtml: paragraphsToHtml(rawBody),
    } as any);

    const eventKey = `account_ops.communication.${body.client_user_id}.${Date.now()}`;

    const result = await enqueueEmail({
      to: body.client_email,
      subject,
      html,
      templateKey: `account_ops.${templateKey}`,
      messageType: "transactional",
      entityType: "user",
      entityId: body.client_user_id,
      eventKey,
      replyTo: userData.user.email ?? undefined,
    });

    await admin.from("admin_audit_log").insert({
      admin_user_id: userData.user.id,
      admin_email: userData.user.email,
      action: `account_ops.communication_send`,
      target_type: "user",
      target_id: body.client_user_id,
      target_email: body.client_email,
      details: {
        template_key: templateKey,
        subject,
        account_id: body.account_id ?? null,
        reason: body.reason ?? null,
        enqueue_result: result,
      },
    });

    if (!result.success) return json({ error: result.error ?? "enqueue_failed" }, 500);
    return json({ ok: true, message_id: result.id, already_queued: result.alreadyQueued ?? false });
  } catch (e) {
    console.error("communication-account-actions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
