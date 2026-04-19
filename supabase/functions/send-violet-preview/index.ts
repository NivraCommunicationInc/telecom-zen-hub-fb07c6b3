// One-shot preview sender — T-MOBILE SERIOUS TELECOM design
// Bold magenta signature, corporate sans-serif, real network dashboard
import { Resend } from "../_shared/ResendProxy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>Nivra Telecom — Service activé</title>
<style>
  @media only screen and (max-width:620px){
    .container{width:100%!important;}
    .px{padding-left:24px!important;padding-right:24px!important;}
    .hero-title{font-size:34px!important;line-height:1.05!important;}
    .stat-num{font-size:26px!important;}
    .stack{display:block!important;width:100%!important;}
    .stack td{display:block!important;width:100%!important;padding:10px 0!important;border:0!important;}
    .cta a{display:block!important;}
  }
  a{color:#E20074;text-decoration:none;}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">

<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f4f6;opacity:0;">
Réseau actif. Votre service Nivra GIGA + TV 25 est en ligne — Compte 100847291.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f6;">
<tr><td align="center" style="padding:0;">

<!-- ═══════ CONTAINER ═══════ -->
<table role="presentation" class="container" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;">

<!-- ─── TOP MAGENTA STRIP ─── -->
<tr><td style="background:#E20074;height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>

<!-- ─── HEADER : logo + account meta ─── -->
<tr><td class="px" style="padding:28px 48px;border-bottom:1px solid #e8e8ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:middle;">
  <span style="display:inline-block;font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#1a1a1a;">nivra</span><span style="display:inline-block;font-size:22px;font-weight:900;color:#E20074;">.</span>
  <span style="display:inline-block;margin-left:10px;padding:3px 9px;background:#fce7f3;color:#9d0050;font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;border-radius:3px;vertical-align:middle;">Telecom</span>
</td>
<td align="right" style="vertical-align:middle;font-size:11px;color:#71717a;font-weight:500;letter-spacing:0.3px;">
  Compte&nbsp;<span style="color:#1a1a1a;font-weight:700;font-variant-numeric:tabular-nums;">100847291</span>
</td>
</tr>
</table>
</td></tr>

<!-- ─── HERO : status banner ─── -->
<tr><td class="px" style="padding:48px 48px 12px;background:#ffffff;">

<!-- live status pill -->
<div style="display:inline-block;padding:6px 12px 6px 10px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:99px;margin-bottom:24px;">
  <span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:50%;vertical-align:middle;margin-right:7px;box-shadow:0 0 0 3px rgba(16,185,129,0.18);"></span>
  <span style="font-size:11px;font-weight:700;color:#065f46;letter-spacing:1px;text-transform:uppercase;vertical-align:middle;">Service actif</span>
</div>

<h1 class="hero-title" style="margin:0 0 14px;font-size:44px;line-height:1.05;font-weight:900;letter-spacing:-1.5px;color:#0a0a0a;">
Bonjour Oldo,<br>votre réseau<br>est <span style="color:#E20074;">en ligne.</span>
</h1>

<p style="margin:0 0 36px;font-size:16px;line-height:1.55;color:#52525b;font-weight:400;max-width:480px;">
L'activation est complète. Votre forfait <strong style="color:#1a1a1a;font-weight:700;">GIGA Internet + TV 25</strong> est opérationnel à votre adresse depuis aujourd'hui.
</p>

</td></tr>

<!-- ─── NETWORK DASHBOARD : dark band ─── -->
<tr><td style="padding:0 48px;" class="px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;border-radius:8px;overflow:hidden;">

<!-- header bar -->
<tr><td style="padding:16px 24px;border-bottom:1px solid #27272a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:10px;font-weight:800;color:#a1a1aa;letter-spacing:1.8px;text-transform:uppercase;font-family:'SF Mono','Monaco','Menlo',monospace;">
  ▌ État du réseau
</td>
<td align="right" style="font-size:10px;font-weight:600;color:#10b981;letter-spacing:1.2px;font-family:'SF Mono','Monaco','Menlo',monospace;">
  ● LIVE · QC-MTL-01
</td>
</tr></table>
</td></tr>

<!-- stats grid -->
<tr><td style="padding:28px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr class="stack">

<td width="33%" style="vertical-align:top;border-right:1px solid #27272a;padding-right:16px;">
  <div style="font-size:10px;font-weight:700;color:#71717a;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Téléchargement</div>
  <div class="stat-num" style="font-size:34px;font-weight:900;color:#ffffff;letter-spacing:-1.2px;line-height:1;font-variant-numeric:tabular-nums;">1000<span style="font-size:14px;color:#a1a1aa;font-weight:600;letter-spacing:0;margin-left:4px;">Mb/s</span></div>
  <div style="margin-top:10px;height:3px;background:#27272a;border-radius:2px;overflow:hidden;">
    <div style="width:100%;height:3px;background:linear-gradient(90deg,#E20074,#ec4899);"></div>
  </div>
</td>

<td width="33%" style="vertical-align:top;border-right:1px solid #27272a;padding:0 16px;">
  <div style="font-size:10px;font-weight:700;color:#71717a;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Téléversement</div>
  <div class="stat-num" style="font-size:34px;font-weight:900;color:#ffffff;letter-spacing:-1.2px;line-height:1;font-variant-numeric:tabular-nums;">1000<span style="font-size:14px;color:#a1a1aa;font-weight:600;letter-spacing:0;margin-left:4px;">Mb/s</span></div>
  <div style="margin-top:10px;height:3px;background:#27272a;border-radius:2px;overflow:hidden;">
    <div style="width:100%;height:3px;background:linear-gradient(90deg,#E20074,#ec4899);"></div>
  </div>
</td>

<td width="33%" style="vertical-align:top;padding-left:16px;">
  <div style="font-size:10px;font-weight:700;color:#71717a;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Latence</div>
  <div class="stat-num" style="font-size:34px;font-weight:900;color:#ffffff;letter-spacing:-1.2px;line-height:1;font-variant-numeric:tabular-nums;">2<span style="font-size:14px;color:#a1a1aa;font-weight:600;letter-spacing:0;margin-left:4px;">ms</span></div>
  <div style="margin-top:10px;height:3px;background:#27272a;border-radius:2px;overflow:hidden;">
    <div style="width:78%;height:3px;background:#10b981;"></div>
  </div>
</td>

</tr>
</table>
</td></tr>

<!-- footer bar of dashboard -->
<tr><td style="padding:14px 24px;background:#18181b;border-top:1px solid #27272a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:10px;color:#71717a;font-family:'SF Mono','Monaco','Menlo',monospace;letter-spacing:0.5px;">
  Type: FIBRE&nbsp;PON&nbsp;·&nbsp;ONT: actif&nbsp;·&nbsp;Lien: optique&nbsp;1&nbsp;Gbps
</td>
</tr></table>
</td></tr>

</table>
</td></tr>

<!-- ─── SERVICE SUMMARY ─── -->
<tr><td class="px" style="padding:40px 48px 8px;">
<div style="font-size:10px;font-weight:800;color:#71717a;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px;">Récapitulatif de service</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

<tr><td style="padding:14px 0;border-bottom:1px solid #f4f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;color:#71717a;font-weight:500;">Forfait</td>
<td align="right" style="font-size:14px;color:#0a0a0a;font-weight:700;">GIGA Internet + TV 25</td>
</tr></table>
</td></tr>

<tr><td style="padding:14px 0;border-bottom:1px solid #f4f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;color:#71717a;font-weight:500;">N° de commande</td>
<td align="right" style="font-size:14px;color:#0a0a0a;font-weight:700;font-family:'SF Mono','Monaco','Menlo',monospace;font-variant-numeric:tabular-nums;">#NIV-202612-0084</td>
</tr></table>
</td></tr>

<tr><td style="padding:14px 0;border-bottom:1px solid #f4f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;color:#71717a;font-weight:500;">Activé le</td>
<td align="right" style="font-size:14px;color:#0a0a0a;font-weight:700;">19 avril 2026 · 14:32</td>
</tr></table>
</td></tr>

<tr><td style="padding:14px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;color:#71717a;font-weight:500;">Cycle de facturation</td>
<td align="right" style="font-size:14px;color:#0a0a0a;font-weight:700;">19 du mois</td>
</tr></table>
</td></tr>

</table>
</td></tr>

<!-- ─── CTA BAND ─── -->
<tr><td class="px" style="padding:32px 48px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="cta">
<tr>
<td style="padding-right:8px;width:55%;">
  <a href="https://nivra-telecom.ca/portail" style="display:block;text-align:center;background:#E20074;color:#ffffff;padding:16px 28px;border-radius:6px;font-size:14px;font-weight:800;letter-spacing:0.3px;text-decoration:none;">
    Accéder à mon portail →
  </a>
</td>
<td style="padding-left:8px;width:45%;">
  <a href="https://nivra-telecom.ca/support" style="display:block;text-align:center;background:#ffffff;color:#0a0a0a;padding:14px 28px;border-radius:6px;font-size:14px;font-weight:700;letter-spacing:0.3px;text-decoration:none;border:2px solid #0a0a0a;">
    Centre d'aide
  </a>
</td>
</tr>
</table>
</td></tr>

<!-- ─── INFO STRIP ─── -->
<tr><td class="px" style="padding:0 48px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border-left:3px solid #E20074;border-radius:0 6px 6px 0;">
<tr><td style="padding:18px 22px;">
  <div style="font-size:11px;font-weight:800;color:#9d0050;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Bon à savoir</div>
  <div style="font-size:13px;line-height:1.6;color:#3f3f46;">
    Votre première facture sera générée le <strong style="color:#0a0a0a;">19 mai 2026</strong>. Aucune action requise — le paiement préautorisé prend le relais.
  </div>
</td></tr>
</table>
</td></tr>

<!-- ─── SUPPORT BLOCK ─── -->
<tr><td class="px" style="padding:32px 48px;background:#0a0a0a;color:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr class="stack">
<td style="vertical-align:top;width:60%;">
  <div style="font-size:11px;font-weight:800;color:#E20074;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Support 24/7</div>
  <div style="font-size:18px;font-weight:800;color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">
    Une question?<br>Notre équipe répond en moins de 2&nbsp;heures.
  </div>
</td>
<td align="right" style="vertical-align:top;width:40%;">
  <div style="font-size:11px;color:#a1a1aa;margin-bottom:4px;letter-spacing:0.5px;">Écrivez-nous</div>
  <a href="mailto:support@nivra-telecom.ca" style="font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">support@nivra-telecom.ca</a>
</td>
</tr>
</table>
</td></tr>

<!-- ─── FOOTER ─── -->
<tr><td class="px" style="padding:32px 48px;background:#18181b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:middle;">
  <span style="font-size:14px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">nivra</span><span style="font-size:14px;font-weight:900;color:#E20074;">.</span>
  <span style="font-size:10px;color:#71717a;margin-left:8px;letter-spacing:0.3px;">Télécommunications · Québec</span>
</td>
<td align="right" style="vertical-align:middle;">
  <a href="https://nivra-telecom.ca/portail" style="color:#a1a1aa;font-size:11px;text-decoration:none;margin-left:14px;">Compte</a>
  <a href="https://nivra-telecom.ca/legal" style="color:#a1a1aa;font-size:11px;text-decoration:none;margin-left:14px;">Légal</a>
  <a href="https://nivra-telecom.ca/desabonnement" style="color:#a1a1aa;font-size:11px;text-decoration:none;margin-left:14px;">Préférences</a>
</td>
</tr>
<tr><td colspan="2" style="padding-top:18px;border-top:1px solid #27272a;margin-top:18px;">
  <div style="padding-top:18px;font-size:10px;color:#52525b;line-height:1.6;letter-spacing:0.2px;">
    © 2026 Nivra Telecom inc. · CRTC&nbsp;FSI&nbsp;canadien · Tous droits réservés.<br>
    Ce courriel transactionnel a été envoyé suite à l'activation de votre service. Vous recevez ce message car vous êtes client Nivra.
  </div>
</td></tr>
</table>
</td></tr>

<!-- bottom magenta strip -->
<tr><td style="background:#E20074;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

</table>

</td></tr>
</table>

</body>
</html>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY missing");
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: ["support@nivra-telecom.ca"],
      subject: "Service activé — bienvenue chez Nivra",
      html: HTML,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
