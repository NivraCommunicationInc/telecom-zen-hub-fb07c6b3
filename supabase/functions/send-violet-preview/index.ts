// One-shot preview sender — EDITORIAL PREMIUM design
// Inspired by Apple, Linear, Stripe, Vercel — magazine-grade typography
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
<title>Nivra</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  @media only screen and (max-width:640px){
    .container{width:100%!important;border-radius:0!important;}
    .px{padding-left:28px!important;padding-right:28px!important;}
    .px-lg{padding-left:28px!important;padding-right:28px!important;}
    .display{font-size:42px!important;line-height:1.02!important;letter-spacing:-1.6px!important;}
    .eyebrow{font-size:11px!important;}
    .stack{display:block!important;width:100%!important;}
    .stack-td{display:block!important;width:100%!important;padding:0 0 14px 0!important;border:0!important;}
    .hide-mobile{display:none!important;}
    .stat-grid td{padding:18px 14px!important;}
    .big-num{font-size:32px!important;}
  }
  a{color:#0a0a0a;text-decoration:none;}
  .link-underline:hover{color:#7c3aed!important;}
  .btn-dark:hover{background:#1a1a1a!important;}
</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:#0a0a0a;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f5f5f0;opacity:0;">
Tout est en ligne. GIGA Internet + TV 25 choix · Compte 200711 · Prochaine facture le 19 mai.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f0;">
<tr><td align="center" style="padding:32px 16px 48px;">

<!-- ═══════════════════════════════════════════════ -->
<!-- MAIN CARD                                       -->
<!-- ═══════════════════════════════════════════════ -->
<table role="presentation" class="container" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 1px 3px rgba(10,10,10,0.04),0 24px 48px -12px rgba(10,10,10,0.12);">

<!-- ─────────────── MASTHEAD ─────────────── -->
<tr><td class="px-lg" style="padding:28px 48px 24px;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left" style="vertical-align:middle;">
<div style="font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;color:#0a0a0a;letter-spacing:-0.8px;line-height:1;">
nivra<span style="color:#7c3aed;">.</span>
</div>
</td>
<td align="right" style="vertical-align:middle;">
<div style="font-size:11px;color:#737373;font-weight:500;letter-spacing:0.3px;text-transform:uppercase;">Édition&nbsp;Client</div>
</td>
</tr></table>
</td></tr>

<!-- ─────────────── HAIRLINE ─────────────── -->
<tr><td style="padding:0 48px;" class="px-lg">
<div style="height:1px;background:#0a0a0a;line-height:1px;font-size:0;">&nbsp;</div>
</td></tr>

<!-- ─────────────── EDITORIAL META ─────────────── -->
<tr><td class="px-lg" style="padding:32px 48px 0;background:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;padding-right:14px;">N°&nbsp;01</td>
<td style="font-size:11px;color:#a3a3a3;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;padding-right:14px;">·</td>
<td style="font-size:11px;color:#525252;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;padding-right:14px;">Activation</td>
<td style="font-size:11px;color:#a3a3a3;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;padding-right:14px;">·</td>
<td style="font-size:11px;color:#525252;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;">18&nbsp;Avr&nbsp;2026</td>
</tr>
</table>
</td></tr>

<!-- ─────────────── DISPLAY HEADLINE ─────────────── -->
<tr><td class="px-lg" style="padding:24px 48px 12px;background:#ffffff;">
<h1 class="display" style="margin:0;font-family:'SF Pro Display','Times New Roman',Georgia,serif;font-size:56px;font-weight:800;color:#0a0a0a;line-height:0.98;letter-spacing:-2.4px;">
Tout est<br>
<span style="font-style:italic;font-weight:600;color:#7c3aed;font-family:'New York','Times New Roman',Georgia,serif;">en ligne.</span>
</h1>
</td></tr>

<!-- ─────────────── DECK / SUBTITLE ─────────────── -->
<tr><td class="px-lg" style="padding:18px 48px 40px;background:#ffffff;">
<p style="margin:0;max-width:480px;font-size:17px;color:#404040;line-height:1.5;font-weight:400;letter-spacing:-0.2px;">
Bonjour Oldo. Votre forfait <strong style="color:#0a0a0a;font-weight:600;">GIGA Internet + TV 25 choix</strong> est désormais actif à votre adresse. Aucun contrat. Aucune surprise.
</p>
</td></tr>

<!-- ─────────────── HERO STATEMENT (large quote-style) ─────────────── -->
<tr><td class="px-lg" style="padding:0 48px 40px;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;border-radius:18px;overflow:hidden;">
<tr><td style="padding:44px 40px;position:relative;">

<div style="font-size:11px;color:#a78bfa;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:16px;">Votre service</div>

<div class="big-num" style="font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,Helvetica,sans-serif;font-size:44px;color:#ffffff;font-weight:800;letter-spacing:-1.6px;line-height:1;margin-bottom:6px;">
1&nbsp;Gbps<span style="color:#7c3aed;">.</span>
</div>
<div style="font-size:14px;color:#a3a3a3;font-weight:500;line-height:1.4;margin-bottom:32px;">
Fibre symétrique · 25+ chaînes télé incluses
</div>

<!-- Inline stats row -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="stat-grid"><tr>
<td class="stack-td" width="33%" style="vertical-align:top;border-right:1px solid #1f1f1f;padding-right:18px;">
<div style="font-size:10px;color:#737373;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Engagement</div>
<div style="font-size:18px;color:#ffffff;font-weight:700;letter-spacing:-0.4px;">Aucun</div>
</td>
<td class="stack-td" width="33%" style="vertical-align:top;border-right:1px solid #1f1f1f;padding:0 18px;">
<div style="font-size:10px;color:#737373;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Installation</div>
<div style="font-size:18px;color:#ffffff;font-weight:700;letter-spacing:-0.4px;">Complétée</div>
</td>
<td class="stack-td" width="33%" style="vertical-align:top;padding-left:18px;">
<div style="font-size:10px;color:#737373;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Support</div>
<div style="font-size:18px;color:#ffffff;font-weight:700;letter-spacing:-0.4px;">Québécois</div>
</td>
</tr></table>

</td></tr>
</table>
</td></tr>

<!-- ─────────────── SECTION DIVIDER ─────────────── -->
<tr><td class="px-lg" style="padding:0 48px;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:10px;color:#a3a3a3;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;padding-bottom:18px;">— Récapitulatif</td>
</tr></table>
</td></tr>

<!-- ─────────────── DETAILS LIST (editorial style) ─────────────── -->
<tr><td class="px-lg" style="padding:0 48px 8px;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

<tr><td style="padding:18px 0;border-top:1px solid #f0f0f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:14px;color:#737373;font-weight:500;letter-spacing:-0.1px;">Commande</td>
<td align="right" style="font-size:15px;color:#0a0a0a;font-weight:600;font-family:'SF Mono','Menlo',Consolas,monospace;letter-spacing:-0.3px;">99999</td>
</tr></table>
</td></tr>

<tr><td style="padding:18px 0;border-top:1px solid #f0f0f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:14px;color:#737373;font-weight:500;letter-spacing:-0.1px;">Compte client</td>
<td align="right" style="font-size:15px;color:#0a0a0a;font-weight:600;font-family:'SF Mono','Menlo',Consolas,monospace;letter-spacing:-0.3px;">200711</td>
</tr></table>
</td></tr>

<tr><td style="padding:18px 0;border-top:1px solid #f0f0f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:14px;color:#737373;font-weight:500;letter-spacing:-0.1px;">Forfait</td>
<td align="right" style="font-size:15px;color:#0a0a0a;font-weight:600;letter-spacing:-0.2px;">GIGA + TV 25</td>
</tr></table>
</td></tr>

<tr><td style="padding:18px 0;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:14px;color:#737373;font-weight:500;letter-spacing:-0.1px;">Activation</td>
<td align="right" style="font-size:15px;color:#0a0a0a;font-weight:600;letter-spacing:-0.2px;">18 avril 2026</td>
</tr></table>
</td></tr>

</table>
</td></tr>

<!-- ─────────────── PROCHAINE FACTURE — bold editorial moment ─────────────── -->
<tr><td class="px-lg" style="padding:36px 48px 8px;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:top;">
<div style="font-size:10px;color:#7c3aed;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:8px;">Prochaine facture</div>
<div style="font-size:14px;color:#525252;font-weight:500;letter-spacing:-0.1px;">19&nbsp;mai&nbsp;2026 — taxes incluses</div>
</td>
<td align="right" style="vertical-align:top;">
<div style="font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,Helvetica,sans-serif;font-size:36px;color:#0a0a0a;font-weight:800;letter-spacing:-1.4px;line-height:0.95;">
120<span style="color:#a3a3a3;font-weight:600;">,72&nbsp;$</span>
</div>
</td>
</tr>
</table>
</td></tr>

<!-- ─────────────── CTA ─────────────── -->
<tr><td class="px-lg" style="padding:36px 48px 16px;background:#ffffff;">

<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://nivra-telecom.ca/mon-compte" style="height:54px;v-text-anchor:middle;width:100%;" arcsize="10%" stroke="f" fillcolor="#0a0a0a">
<w:anchorlock/>
<center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Ouvrir mon espace client</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="https://nivra-telecom.ca/mon-compte" class="btn-dark" style="display:block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:18px 24px;border-radius:14px;font-weight:600;font-size:15px;letter-spacing:-0.3px;text-align:center;">
Ouvrir mon espace client&nbsp;&nbsp;→
</a>
<!--<![endif]-->

</td></tr>

<tr><td class="px-lg" align="center" style="padding:0 48px 48px;background:#ffffff;">
<a href="https://nivra-telecom.ca/test-vitesse" class="link-underline" style="font-size:13px;color:#737373;font-weight:500;text-decoration:underline;text-underline-offset:3px;letter-spacing:-0.1px;">Tester ma vitesse Internet</a>
</td></tr>

<!-- ─────────────── DARK FOOTER STORYTELLING ─────────────── -->
<tr><td style="background:#0a0a0a;padding:48px 48px 40px;" class="px-lg">

<!-- Pull quote -->
<div style="font-family:'New York','Times New Roman',Georgia,serif;font-size:24px;font-weight:500;font-style:italic;color:#ffffff;line-height:1.35;letter-spacing:-0.5px;margin-bottom:32px;max-width:440px;">
"Une question ? Nous répondons en moins de deux heures, par des humains, en français."
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:middle;">
<div style="font-size:11px;color:#737373;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Support</div>
<a href="mailto:support@nivra-telecom.ca" style="font-size:15px;color:#ffffff;font-weight:600;text-decoration:none;letter-spacing:-0.2px;">support@nivra-telecom.ca</a>
</td>
<td align="right" class="hide-mobile" style="vertical-align:middle;">
<a href="mailto:support@nivra-telecom.ca" style="display:inline-block;background:#ffffff;color:#0a0a0a;text-decoration:none;padding:11px 22px;border-radius:99px;font-weight:600;font-size:13px;letter-spacing:-0.1px;">
Écrire&nbsp;&nbsp;→
</a>
</td>
</tr>
</table>

</td></tr>

<!-- ─────────────── BOTTOM BAR ─────────────── -->
<tr><td style="background:#0a0a0a;padding:0 48px 36px;" class="px-lg">
<div style="height:1px;background:#1f1f1f;margin-bottom:24px;line-height:1px;font-size:0;">&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:middle;">
<div style="font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,Helvetica,sans-serif;font-size:14px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
nivra<span style="color:#7c3aed;">.</span>
</div>
</td>
<td align="right" style="vertical-align:middle;">
<a href="https://nivra-telecom.ca/mon-compte" style="font-size:11px;color:#737373;text-decoration:none;font-weight:500;letter-spacing:0.2px;margin-left:14px;">Compte</a>
<a href="https://nivra-telecom.ca/support" style="font-size:11px;color:#737373;text-decoration:none;font-weight:500;letter-spacing:0.2px;margin-left:14px;">Aide</a>
<a href="https://nivra-telecom.ca/confidentialite" style="font-size:11px;color:#737373;text-decoration:none;font-weight:500;letter-spacing:0.2px;margin-left:14px;">Confidentialité</a>
<a href="https://nivra-telecom.ca/desabonner" style="font-size:11px;color:#737373;text-decoration:none;font-weight:500;letter-spacing:0.2px;margin-left:14px;">Désabonnement</a>
</td>
</tr>
</table>

<div style="margin-top:24px;font-size:11px;color:#525252;line-height:1.6;font-weight:400;letter-spacing:0.1px;">
© 2026 Nivra Telecom inc. — Montréal, Québec.<br>
Vous recevez ce courriel parce que vous êtes client Nivra.
</div>

</td></tr>

</table>
<!-- ═══════════════════════════════════════════════ -->

<!-- Tiny outside caption -->
<div style="margin-top:18px;font-size:11px;color:#a3a3a3;font-weight:500;letter-spacing:0.3px;">
Édition envoyée à support@nivra-telecom.ca
</div>

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
      from: "Nivra <support@nivra-telecom.ca>",
      to: ["support@nivra-telecom.ca"],
      subject: "Tout est en ligne, Oldo.",
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
