// One-shot preview sender for the Violet Bold design
// Sends a hardcoded HTML email to support@nivra-telecom.ca via Resend
import { Resend } from "../_shared/ResendProxy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HTML = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nivra Telecom</title></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(30,27,75,0.08);">

<tr><td style="height:5px;background:#7c3aed;line-height:5px;font-size:0;">&nbsp;</td></tr>

<tr><td style="background:#1e1b4b;padding:24px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left" style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:2px;">NIVRA.</td>
<td align="right" style="color:#a5b4fc;font-size:11px;">Sans contrat &middot; Support qu&eacute;b&eacute;cois</td>
</tr></table>
</td></tr>

<tr><td align="center" style="background:#f5f3ff;padding:48px 32px;">
<div style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:10px;font-weight:700;padding:4px 14px;border-radius:99px;letter-spacing:2px;">SERVICE ACTIV&Eacute;</div>
<h1 style="margin:18px 0 8px;font-size:28px;font-weight:800;color:#1e1b4b;line-height:1.2;">Votre service est maintenant actif</h1>
<p style="margin:0;font-size:14px;color:#6b7280;">Bienvenue chez Nivra Telecom.</p>
</td></tr>

<tr><td style="background:#ffffff;padding:36px 32px;">
<p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1e1b4b;">Bonjour Oldo Lavaud,</p>
<p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.8;">Votre service <strong>GIGA Internet + TV 25 choix</strong> est maintenant actif. Voici le r&eacute;sum&eacute;.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1.5px solid #ede9fe;border-radius:12px;border-collapse:separate;overflow:hidden;">
<tr><td style="background:#1e1b4b;padding:10px 18px;color:#a5b4fc;font-size:10px;font-weight:700;letter-spacing:2px;">D&Eacute;TAILS DE VOTRE COMMANDE</td></tr>
<tr><td style="padding:10px 18px;border-bottom:1px solid #f5f3ff;"><table width="100%" role="presentation"><tr><td style="font-size:13px;color:#6b7280;">Commande</td><td align="right" style="font-size:13px;color:#1e1b4b;font-weight:600;">#99999</td></tr></table></td></tr>
<tr><td style="padding:10px 18px;border-bottom:1px solid #f5f3ff;"><table width="100%" role="presentation"><tr><td style="font-size:13px;color:#6b7280;">Compte client</td><td align="right" style="font-size:13px;color:#1e1b4b;font-weight:600;">#200711</td></tr></table></td></tr>
<tr><td style="padding:10px 18px;border-bottom:1px solid #f5f3ff;"><table width="100%" role="presentation"><tr><td style="font-size:13px;color:#6b7280;">Service</td><td align="right" style="font-size:13px;color:#1e1b4b;font-weight:600;">GIGA + TV 25 choix</td></tr></table></td></tr>
<tr><td style="padding:10px 18px;border-bottom:1px solid #f5f3ff;"><table width="100%" role="presentation"><tr><td style="font-size:13px;color:#6b7280;">Activation</td><td align="right" style="font-size:13px;color:#1e1b4b;font-weight:600;">18 avril 2026</td></tr></table></td></tr>
<tr><td style="padding:12px 18px;background:#f5f3ff;"><table width="100%" role="presentation"><tr><td style="font-size:13px;color:#1e1b4b;font-weight:700;">Prochaine facture</td><td align="right" style="font-size:13px;color:#1e1b4b;font-weight:700;">120,72 $ &middot; 19 mai 2026</td></tr></table></td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;"><tr><td align="center">
<a href="https://nivra-telecom.ca/mon-compte" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:15px 44px;border-radius:99px;font-weight:700;font-size:14px;">Acc&eacute;der &agrave; mon espace client</a>
</td></tr></table>

<div style="background:#faf9ff;border-left:4px solid #7c3aed;padding:14px 18px;font-size:13px;color:#4b5563;border-radius:0 8px 8px 0;">Besoin d&rsquo;aide ? &Eacute;crivez-nous &agrave; <a href="mailto:support@nivra-telecom.ca" style="color:#7c3aed;text-decoration:none;font-weight:600;">support@nivra-telecom.ca</a> &mdash; r&eacute;ponse en moins de 2h.</div>
</td></tr>

<tr><td align="center" style="background:#1e1b4b;padding:28px 32px;">
<div style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:2px;">NIVRA TELECOM</div>
<div style="height:1px;background:#2d2b55;margin:16px auto;width:80%;line-height:1px;font-size:0;">&nbsp;</div>
<div style="font-size:11px;color:#a5b4fc;margin:0 0 12px;">
<a href="https://nivra-telecom.ca/mon-compte" style="color:#a5b4fc;text-decoration:none;">Mon compte</a> &nbsp;|&nbsp;
<a href="https://nivra-telecom.ca/support" style="color:#a5b4fc;text-decoration:none;">Support</a> &nbsp;|&nbsp;
<a href="https://nivra-telecom.ca/confidentialite" style="color:#a5b4fc;text-decoration:none;">Confidentialit&eacute;</a> &nbsp;|&nbsp;
<a href="https://nivra-telecom.ca/desabonner" style="color:#a5b4fc;text-decoration:none;">Se d&eacute;sabonner</a>
</div>
<div style="font-size:11px;color:#6b7280;line-height:1.6;">&copy; 2026 Nivra Telecom. Tous droits r&eacute;serv&eacute;s.<br>Ce message a &eacute;t&eacute; envoy&eacute; car vous &ecirc;tes client Nivra Telecom.</div>
</td></tr>

</table></td></tr></table></body></html>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY missing");

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: "Nivra Telecom <support@nivra-telecom.ca>",
      to: ["support@nivra-telecom.ca"],
      subject: "Test — Nouveau design Nivra Telecom",
      html: HTML,
    });

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
