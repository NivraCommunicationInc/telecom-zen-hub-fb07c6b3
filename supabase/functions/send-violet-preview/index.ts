// One-shot preview sender for the PREMIUM Nivra email design
// World-class telecom email inspired by Telus, Bell, Rogers, T-Mobile
import { Resend } from "../_shared/ResendProxy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HTML = `<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Nivra Telecom</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @media only screen and (max-width:620px){
    .container{width:100%!important;border-radius:0!important;}
    .px{padding-left:24px!important;padding-right:24px!important;}
    .hero-title{font-size:30px!important;line-height:1.15!important;}
    .stat-num{font-size:22px!important;}
    .hide-mobile{display:none!important;}
    .stack{display:block!important;width:100%!important;}
    .stack td{display:block!important;width:100%!important;padding:0 0 16px 0!important;}
  }
  a{color:#E20074;text-decoration:none;}
  .btn-primary:hover{background:#6d28d9!important;}
</style>
</head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:#0a0a23;">

<!-- Preheader (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#eef0f4;opacity:0;">
Votre service GIGA Internet + TV 25 choix est maintenant actif. Compte #200711 · Prochaine facture 19 mai 2026.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef0f4;">
<tr><td align="center" style="padding:24px 12px 40px;">

<!-- ===== MAIN CONTAINER ===== -->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04),0 12px 40px rgba(30,27,75,0.10);">

<!-- ===== TOP ACCENT GRADIENT BAR ===== -->
<tr><td style="height:4px;background:#E20074;background:linear-gradient(90deg,#E20074 0%,#ec4899 50%,#E20074 100%);line-height:4px;font-size:0;">&nbsp;</td></tr>

<!-- ===== HEADER (clean white, logo + utility) ===== -->
<tr><td class="px" style="background:#ffffff;padding:22px 36px;border-bottom:1px solid #f1f1f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left" style="vertical-align:middle;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;padding-right:10px;">
<div style="width:32px;height:32px;background:#E20074;border-radius:8px;text-align:center;line-height:32px;color:#ffffff;font-size:14px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;">N</div>
</td>
<td style="vertical-align:middle;">
<div style="color:#0a0a23;font-size:17px;font-weight:700;letter-spacing:-0.3px;line-height:1;">Nivra</div>
<div style="color:#6b7280;font-size:11px;font-weight:500;line-height:1.4;margin-top:2px;">Telecom · Québec</div>
</td>
</tr></table>
</td>
<td align="right" class="hide-mobile" style="vertical-align:middle;color:#6b7280;font-size:12px;font-weight:500;">
Compte <span style="color:#0a0a23;font-weight:600;">#200711</span>
</td>
</tr></table>
</td></tr>

<!-- ===== HERO SECTION ===== -->
<tr><td class="px" style="padding:56px 36px 44px;background:#ffffff;">

<!-- Status pill -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:99px;"><tr>
<td style="padding:6px 12px 6px 10px;vertical-align:middle;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;padding-right:6px;line-height:1;">
<div style="width:6px;height:6px;background:#10b981;border-radius:50%;"></div>
</td>
<td style="vertical-align:middle;color:#065f46;font-size:11px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;line-height:1;">
Service actif
</td>
</tr></table>
</td>
</tr></table>
</td></tr></table>

<!-- Hero headline -->
<h1 class="hero-title" style="margin:0 0 14px;font-size:36px;font-weight:800;color:#0a0a23;line-height:1.1;letter-spacing:-1.2px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;">
Bonjour Oldo,<br><span style="color:#E20074;">votre service est actif.</span>
</h1>

<p style="margin:0 0 0;font-size:16px;color:#52525b;line-height:1.55;font-weight:400;">
Tout est prêt. Votre forfait <strong style="color:#0a0a23;font-weight:600;">GIGA Internet + TV 25 choix</strong> a été activé avec succès le 18 avril 2026.
</p>

</td></tr>

<!-- ===== STATS ROW (3 columns, telecom-style) ===== -->
<tr><td class="px" style="padding:0 36px 32px;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafe;border:1px solid #f1f1f5;border-radius:14px;">
<tr>
<td class="stack" width="33.33%" style="padding:22px 18px;text-align:center;border-right:1px solid #f1f1f5;vertical-align:top;">
<div style="font-size:11px;color:#71717a;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px;">Vitesse</div>
<div class="stat-num" style="font-size:26px;color:#0a0a23;font-weight:800;line-height:1;letter-spacing:-0.8px;">1<span style="color:#E20074;">Gbps</span></div>
<div style="font-size:11px;color:#71717a;font-weight:500;margin-top:4px;">téléchargement</div>
</td>
<td class="stack" width="33.33%" style="padding:22px 18px;text-align:center;border-right:1px solid #f1f1f5;vertical-align:top;">
<div style="font-size:11px;color:#71717a;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px;">Chaînes TV</div>
<div class="stat-num" style="font-size:26px;color:#0a0a23;font-weight:800;line-height:1;letter-spacing:-0.8px;">25<span style="color:#E20074;">+</span></div>
<div style="font-size:11px;color:#71717a;font-weight:500;margin-top:4px;">au choix</div>
</td>
<td class="stack" width="33.33%" style="padding:22px 18px;text-align:center;vertical-align:top;">
<div style="font-size:11px;color:#71717a;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px;">Engagement</div>
<div class="stat-num" style="font-size:26px;color:#0a0a23;font-weight:800;line-height:1;letter-spacing:-0.8px;">0<span style="color:#E20074;">$</span></div>
<div style="font-size:11px;color:#71717a;font-weight:500;margin-top:4px;">sans contrat</div>
</td>
</tr>
</table>
</td></tr>

<!-- ===== ACCOUNT DETAILS CARD ===== -->
<tr><td class="px" style="padding:0 36px 28px;background:#ffffff;">

<div style="font-size:12px;color:#71717a;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 14px;">
Récapitulatif
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ececf3;border-radius:14px;border-collapse:separate;overflow:hidden;">

<tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;color:#71717a;font-weight:500;">Numéro de commande</td>
<td align="right" style="font-size:14px;color:#0a0a23;font-weight:600;font-family:'SF Mono',Menlo,Consolas,monospace;">#99999</td>
</tr></table>
</td></tr>

<tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;color:#71717a;font-weight:500;">Compte client</td>
<td align="right" style="font-size:14px;color:#0a0a23;font-weight:600;font-family:'SF Mono',Menlo,Consolas,monospace;">#200711</td>
</tr></table>
</td></tr>

<tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;color:#71717a;font-weight:500;">Forfait</td>
<td align="right" style="font-size:14px;color:#0a0a23;font-weight:600;">GIGA + TV 25</td>
</tr></table>
</td></tr>

<tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;color:#71717a;font-weight:500;">Date d'activation</td>
<td align="right" style="font-size:14px;color:#0a0a23;font-weight:600;">18 avril 2026</td>
</tr></table>
</td></tr>

<!-- Highlighted next billing row -->
<tr><td style="padding:18px 20px;background:linear-gradient(135deg,#faf9ff 0%,#f5f3ff 100%);">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td>
<div style="font-size:11px;color:#E20074;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:3px;">Prochaine facture</div>
<div style="font-size:13px;color:#52525b;font-weight:500;">19 mai 2026</div>
</td>
<td align="right">
<div style="font-size:22px;color:#0a0a23;font-weight:800;letter-spacing:-0.6px;line-height:1;">120,72&nbsp;$</div>
<div style="font-size:11px;color:#71717a;font-weight:500;margin-top:3px;">taxes incluses</div>
</td>
</tr></table>
</td></tr>

</table>

</td></tr>

<!-- ===== CTA SECTION ===== -->
<tr><td class="px" align="center" style="padding:8px 36px 36px;background:#ffffff;">

<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://nivra-telecom.ca/mon-compte" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="50%" stroke="f" fillcolor="#E20074">
<w:anchorlock/>
<center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Accéder à mon compte</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="https://nivra-telecom.ca/mon-compte" class="btn-primary" style="display:inline-block;background:#E20074;color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:99px;font-weight:700;font-size:15px;letter-spacing:-0.2px;box-shadow:0 4px 14px rgba(124,58,237,0.32);transition:background 0.2s;">
Accéder à mon compte →
</a>
<!--<![endif]-->

<div style="margin-top:14px;font-size:12px;color:#a1a1aa;font-weight:500;">
Gérez votre forfait, factures et paiements
</div>

</td></tr>

<!-- ===== DIVIDER ===== -->
<tr><td class="px" style="padding:0 36px;background:#ffffff;">
<div style="height:1px;background:#f1f1f5;line-height:1px;font-size:0;">&nbsp;</div>
</td></tr>

<!-- ===== QUICK LINKS GRID ===== -->
<tr><td class="px" style="padding:32px 36px 8px;background:#ffffff;">

<div style="font-size:12px;color:#71717a;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 16px;">
Étapes suivantes
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="stack" width="50%" style="padding:0 8px 12px 0;vertical-align:top;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafe;border:1px solid #f1f1f5;border-radius:12px;"><tr>
<td style="padding:18px;">
<div style="width:36px;height:36px;background:#f5f3ff;border-radius:10px;text-align:center;line-height:36px;font-size:18px;margin-bottom:10px;">⚡</div>
<div style="font-size:14px;color:#0a0a23;font-weight:700;margin-bottom:4px;letter-spacing:-0.2px;">Test de vitesse</div>
<div style="font-size:12px;color:#71717a;font-weight:500;line-height:1.5;">Vérifiez votre débit Internet en quelques secondes.</div>
</td>
</tr></table>
</td>
<td class="stack" width="50%" style="padding:0 0 12px 8px;vertical-align:top;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafe;border:1px solid #f1f1f5;border-radius:12px;"><tr>
<td style="padding:18px;">
<div style="width:36px;height:36px;background:#f5f3ff;border-radius:10px;text-align:center;line-height:36px;font-size:18px;margin-bottom:10px;">📺</div>
<div style="font-size:14px;color:#0a0a23;font-weight:700;margin-bottom:4px;letter-spacing:-0.2px;">Configurer la TV</div>
<div style="font-size:12px;color:#71717a;font-weight:500;line-height:1.5;">Choisissez vos 25 chaînes préférées.</div>
</td>
</tr></table>
</td>
</tr>
</table>

</td></tr>

<!-- ===== SUPPORT BANNER ===== -->
<tr><td class="px" style="padding:24px 36px 36px;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a23;border-radius:14px;">
<tr><td style="padding:22px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;">
<div style="font-size:11px;color:#ec4899;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:4px;">Support québécois</div>
<div style="font-size:15px;color:#ffffff;font-weight:600;letter-spacing:-0.2px;line-height:1.4;">Une question ? On répond en moins de 2h.</div>
</td>
<td align="right" style="vertical-align:middle;" class="hide-mobile">
<a href="mailto:support@nivra-telecom.ca" style="display:inline-block;background:#ffffff;color:#0a0a23;text-decoration:none;padding:10px 20px;border-radius:99px;font-weight:700;font-size:13px;letter-spacing:-0.1px;">
Nous écrire
</a>
</td>
</tr></table>
</td></tr>
</table>
</td></tr>

<!-- ===== FOOTER ===== -->
<tr><td style="background:#fafafe;padding:32px 36px;border-top:1px solid #f1f1f5;">

<!-- Logo + tagline -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr>
<td>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;padding-right:8px;">
<div style="width:24px;height:24px;background:#E20074;border-radius:6px;text-align:center;line-height:24px;color:#ffffff;font-size:11px;font-weight:800;">N</div>
</td>
<td style="vertical-align:middle;color:#0a0a23;font-size:14px;font-weight:700;letter-spacing:-0.2px;">
Nivra Telecom
</td>
</tr></table>
</td>
</tr></table>

<!-- Links -->
<div style="font-size:12px;color:#71717a;line-height:2;margin-bottom:16px;">
<a href="https://nivra-telecom.ca/mon-compte" style="color:#52525b;text-decoration:none;font-weight:500;">Mon compte</a>
<span style="color:#d4d4d8;margin:0 10px;">·</span>
<a href="https://nivra-telecom.ca/support" style="color:#52525b;text-decoration:none;font-weight:500;">Support</a>
<span style="color:#d4d4d8;margin:0 10px;">·</span>
<a href="https://nivra-telecom.ca/confidentialite" style="color:#52525b;text-decoration:none;font-weight:500;">Confidentialité</a>
<span style="color:#d4d4d8;margin:0 10px;">·</span>
<a href="https://nivra-telecom.ca/desabonner" style="color:#52525b;text-decoration:none;font-weight:500;">Désabonnement</a>
</div>

<!-- Legal -->
<div style="font-size:11px;color:#a1a1aa;line-height:1.6;font-weight:400;">
© 2026 Nivra Telecom inc. Tous droits réservés.<br>
Vous recevez ce message car vous êtes client Nivra Telecom.<br>
Montréal, Québec · Canada
</div>

</td></tr>

</table>
<!-- ===== END MAIN CONTAINER ===== -->

</td></tr>
</table>
</body>
</html>`;

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
      subject: "Bonjour Oldo, votre service Nivra est actif ✓",
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
