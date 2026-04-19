// One-shot preview sender — HUMAN TELECOM design
// Warm + editorial, but visually grounded in telecom (signal, network, fibre)
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
<title>Nivra</title>
<style>
  @media only screen and (max-width:620px){
    .container{width:100%!important;border-radius:0!important;}
    .px{padding-left:32px!important;padding-right:32px!important;}
    .title{font-size:36px!important;line-height:1.1!important;}
    .signal-num{font-size:38px!important;}
    .stack{display:block!important;width:100%!important;}
    .stack td{display:block!important;width:100%!important;padding:12px 0!important;border:0!important;}
  }
  a{color:#0d4d3f;}
</style>
</head>
<body style="margin:0;padding:0;background:#e8e4dc;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">

<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#e8e4dc;opacity:0;">
Votre ligne est ouverte, Oldo. GIGA Internet + TV 25 — signal stable, réseau prêt.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e8e4dc;">
<tr><td align="center" style="padding:40px 16px 56px;">

<!-- ═══════ MAIN CARD ═══════ -->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fafaf5;border-radius:6px;box-shadow:0 1px 0 #d4cfc0,0 12px 36px rgba(40,30,15,0.12);">

<!-- ─── MASTHEAD : line + station identifier ─── -->
<tr><td class="px" style="padding:32px 52px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:middle;">
<!-- Logo with signal bars -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:bottom;padding-right:8px;line-height:1;">
<!-- signal bars -->
<span style="display:inline-block;width:3px;height:6px;background:#0d4d3f;margin-right:2px;vertical-align:bottom;"></span>
<span style="display:inline-block;width:3px;height:9px;background:#0d4d3f;margin-right:2px;vertical-align:bottom;"></span>
<span style="display:inline-block;width:3px;height:12px;background:#0d4d3f;margin-right:2px;vertical-align:bottom;"></span>
<span style="display:inline-block;width:3px;height:15px;background:#c9692c;vertical-align:bottom;"></span>
</td>
<td style="vertical-align:middle;font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#1a1a1a;letter-spacing:-0.3px;">
Nivra
</td>
</tr></table>
</td>
<td align="right" style="vertical-align:middle;font-family:'Courier New',monospace;font-size:11px;color:#5a5448;letter-spacing:1.5px;">
QC&nbsp;·&nbsp;FIBRE&nbsp;·&nbsp;01
</td>
</tr>
</table>
</td></tr>

<!-- ─── Top hairline ─── -->
<tr><td class="px" style="padding:18px 52px 0;">
<div style="height:1px;background:#1a1a1a;line-height:1px;font-size:0;">&nbsp;</div>
<div style="height:3px;line-height:3px;font-size:0;">&nbsp;</div>
<div style="height:1px;background:#1a1a1a;line-height:1px;font-size:0;">&nbsp;</div>
</td></tr>

<!-- ─── Bulletin meta ─── -->
<tr><td class="px" style="padding:24px 52px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-family:'Courier New',monospace;font-size:10px;color:#c9692c;font-weight:bold;letter-spacing:2px;text-transform:uppercase;padding-right:16px;">● EN&nbsp;LIGNE</td>
<td style="font-family:'Courier New',monospace;font-size:10px;color:#5a5448;letter-spacing:2px;text-transform:uppercase;padding-right:16px;">18 AVR 2026</td>
<td style="font-family:'Courier New',monospace;font-size:10px;color:#5a5448;letter-spacing:2px;text-transform:uppercase;">14:32&nbsp;HE</td>
</tr>
</table>
</td></tr>

<!-- ─── HEADLINE ─── -->
<tr><td class="px" style="padding:18px 52px 0;">
<h1 class="title" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:46px;font-weight:normal;color:#1a1a1a;line-height:1.05;letter-spacing:-1px;">
Votre ligne<br>est <em style="color:#0d4d3f;font-weight:normal;">ouverte</em>, Oldo.
</h1>
</td></tr>

<!-- ─── Lead paragraph ─── -->
<tr><td class="px" style="padding:22px 52px 0;">
<p style="margin:0;font-family:Georgia,serif;font-size:17px;color:#3d3424;line-height:1.6;max-width:460px;">
Le signal est passé à votre adresse à <strong>14h32</strong> ce 18 avril. Votre forfait <strong>GIGA + TV 25</strong> tourne maintenant sur notre réseau fibre — symétrique, sans plafond, sans contrat.
</p>
</td></tr>

<!-- ─── SIGNAL READOUT — telecom dashboard moment ─── -->
<tr><td class="px" style="padding:36px 52px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0e1a16;border-radius:8px;overflow:hidden;">
<tr><td style="padding:28px 28px 24px;">

<!-- header line -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
<tr>
<td style="font-family:'Courier New',monospace;font-size:10px;color:#7a9c8a;letter-spacing:2px;text-transform:uppercase;">↳ Test de réseau · live</td>
<td align="right" style="font-family:'Courier New',monospace;font-size:10px;color:#c9692c;letter-spacing:2px;">● STABLE</td>
</tr>
</table>

<!-- Big speed readout -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr class="stack">
<td width="50%" style="vertical-align:top;padding-right:14px;border-right:1px solid #1f3329;">
<div style="font-family:'Courier New',monospace;font-size:10px;color:#7a9c8a;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">↓ Téléchargement</div>
<div class="signal-num" style="font-family:Georgia,serif;font-size:44px;color:#fafaf5;font-weight:normal;letter-spacing:-1.5px;line-height:1;">
1000<span style="color:#7a9c8a;font-size:18px;font-family:'Courier New',monospace;letter-spacing:1px;">&nbsp;Mbps</span>
</div>
<!-- ASCII signal bar -->
<div style="font-family:'Courier New',monospace;font-size:10px;color:#c9692c;margin-top:10px;letter-spacing:1px;">
████████████ 100%
</div>
</td>
<td width="50%" style="vertical-align:top;padding-left:18px;">
<div style="font-family:'Courier New',monospace;font-size:10px;color:#7a9c8a;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">↑ Téléversement</div>
<div class="signal-num" style="font-family:Georgia,serif;font-size:44px;color:#fafaf5;font-weight:normal;letter-spacing:-1.5px;line-height:1;">
1000<span style="color:#7a9c8a;font-size:18px;font-family:'Courier New',monospace;letter-spacing:1px;">&nbsp;Mbps</span>
</div>
<div style="font-family:'Courier New',monospace;font-size:10px;color:#c9692c;margin-top:10px;letter-spacing:1px;">
████████████ 100%
</div>
</td>
</tr>
</table>

<!-- bottom line -->
<div style="margin-top:24px;padding-top:18px;border-top:1px dashed #1f3329;font-family:'Courier New',monospace;font-size:11px;color:#7a9c8a;letter-spacing:0.5px;line-height:1.7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td>Latence&nbsp;: <span style="color:#fafaf5;">2 ms</span></td>
<td align="center">Gigue&nbsp;: <span style="color:#fafaf5;">0,3 ms</span></td>
<td align="right">Perte&nbsp;: <span style="color:#fafaf5;">0%</span></td>
</tr>
</table>
</div>

</td></tr>
</table>
</td></tr>

<!-- ─── DISPATCH — voice of the company ─── -->
<tr><td class="px" style="padding:32px 52px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="32" style="vertical-align:top;padding-right:14px;">
<div style="font-family:Georgia,serif;font-size:48px;color:#0d4d3f;line-height:0.7;font-style:italic;">"</div>
</td>
<td>
<p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#3d3424;line-height:1.65;font-style:italic;">
Pas de paperasse. Pas de tour de l'horloge à attendre quelqu'un. Si quelque chose cloche, on répond — par des humains, en français, en moins de deux heures.
</p>
</td>
</tr>
</table>
</td></tr>

<!-- ─── ACTIVATION TICKET — looks like a phone bill stub ─── -->
<tr><td class="px" style="padding:36px 52px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1.5px solid #1a1a1a;">

<!-- ticket header -->
<tr><td style="background:#1a1a1a;padding:10px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-family:'Courier New',monospace;font-size:10px;color:#fafaf5;letter-spacing:2.5px;text-transform:uppercase;">⎯ Bordereau d'activation</td>
<td align="right" style="font-family:'Courier New',monospace;font-size:10px;color:#c9692c;letter-spacing:2px;">№ 99999</td>
</tr>
</table>
</td></tr>

<!-- rows -->
<tr><td style="padding:16px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Courier New',monospace;font-size:13px;color:#1a1a1a;">
<tr>
<td style="padding:6px 0;color:#5a5448;width:40%;">Abonné</td>
<td align="right" style="padding:6px 0;">Oldo Lavaud</td>
</tr>
<tr>
<td style="padding:6px 0;color:#5a5448;border-top:1px dashed #d4cfc0;">Compte</td>
<td align="right" style="padding:6px 0;border-top:1px dashed #d4cfc0;">№ 200711</td>
</tr>
<tr>
<td style="padding:6px 0;color:#5a5448;border-top:1px dashed #d4cfc0;">Service</td>
<td align="right" style="padding:6px 0;border-top:1px dashed #d4cfc0;">GIGA Internet + TV 25</td>
</tr>
<tr>
<td style="padding:6px 0;color:#5a5448;border-top:1px dashed #d4cfc0;">Type de réseau</td>
<td align="right" style="padding:6px 0;border-top:1px dashed #d4cfc0;">Fibre optique (FTTH)</td>
</tr>
<tr>
<td style="padding:6px 0;color:#5a5448;border-top:1px dashed #d4cfc0;">Activé le</td>
<td align="right" style="padding:6px 0;border-top:1px dashed #d4cfc0;">18 avril 2026 — 14:32 HE</td>
</tr>
</table>
</td></tr>

<!-- next bill highlighted -->
<tr><td style="background:#f0e9d7;padding:16px 18px;border-top:1.5px solid #1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td>
<div style="font-family:'Courier New',monospace;font-size:10px;color:#c9692c;font-weight:bold;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:4px;">→ Prochaine facture</div>
<div style="font-family:'Courier New',monospace;font-size:12px;color:#5a5448;">19 mai 2026 · taxes incluses</div>
</td>
<td align="right">
<div style="font-family:Georgia,serif;font-size:30px;color:#1a1a1a;font-weight:normal;letter-spacing:-1px;line-height:1;">
120,72&nbsp;$
</div>
</td>
</tr>
</table>
</td></tr>

</table>
</td></tr>

<!-- ─── CTA ─── -->
<tr><td class="px" style="padding:36px 52px 0;">
<a href="https://nivra-telecom.ca/mon-compte" style="display:block;background:#0d4d3f;color:#fafaf5;text-decoration:none;padding:18px 28px;font-family:Georgia,serif;font-size:15px;letter-spacing:0.3px;text-align:center;border:1.5px solid #0d4d3f;box-shadow:4px 4px 0 #c9692c;">
Voir mon réseau →
</a>
<div style="margin-top:14px;text-align:center;font-family:Georgia,serif;font-size:13px;color:#5a5448;font-style:italic;">
ou <a href="https://nivra-telecom.ca/test-vitesse" style="color:#0d4d3f;text-decoration:underline;">testez votre vitesse</a> en deux clics
</div>
</td></tr>

<!-- ─── Sign-off ─── -->
<tr><td class="px" style="padding:44px 52px 0;">
<p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;color:#3d3424;line-height:1.6;">
Au plaisir de vous garder en ligne,
</p>
<div style="margin-top:6px;font-family:Georgia,serif;font-size:18px;color:#0d4d3f;font-style:italic;">
L'équipe Nivra
</div>
<div style="margin-top:4px;font-family:'Courier New',monospace;font-size:10px;color:#5a5448;letter-spacing:1.5px;">
MONTRÉAL · QUÉBEC · CANADA
</div>
</td></tr>

<!-- ─── P.S. ─── -->
<tr><td class="px" style="padding:32px 52px 0;">
<div style="border-top:1px dashed #d4cfc0;padding-top:18px;font-family:Georgia,serif;font-size:14px;color:#3d3424;line-height:1.65;">
<strong style="color:#c9692c;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;">P.&nbsp;S.</strong>&nbsp;&nbsp;Une question, un souci de signal, une coupure ? Écrivez-nous à <a href="mailto:support@nivra-telecom.ca" style="color:#0d4d3f;text-decoration:underline;">support@nivra-telecom.ca</a>. Quelqu'un de vrai vous répondra.
</div>
</td></tr>

<!-- ─── Bottom transmission band ─── -->
<tr><td style="padding:40px 0 0;">
<div style="height:6px;background:repeating-linear-gradient(90deg,#0d4d3f 0,#0d4d3f 14px,#fafaf5 14px,#fafaf5 18px,#c9692c 18px,#c9692c 26px,#fafaf5 26px,#fafaf5 30px);"></div>
</td></tr>

<!-- ─── Footer ─── -->
<tr><td class="px" align="center" style="padding:22px 52px 32px;background:#1a1a1a;">
<div style="font-family:'Courier New',monospace;font-size:10px;color:#7a9c8a;letter-spacing:2px;line-height:1.8;text-transform:uppercase;">
<a href="https://nivra-telecom.ca/mon-compte" style="color:#fafaf5;text-decoration:none;">Compte</a>
&nbsp;·&nbsp;
<a href="https://nivra-telecom.ca/support" style="color:#fafaf5;text-decoration:none;">Aide</a>
&nbsp;·&nbsp;
<a href="https://nivra-telecom.ca/confidentialite" style="color:#fafaf5;text-decoration:none;">Confidentialité</a>
&nbsp;·&nbsp;
<a href="https://nivra-telecom.ca/desabonner" style="color:#fafaf5;text-decoration:none;">Désabonnement</a>
</div>
<div style="margin-top:12px;font-family:Georgia,serif;font-size:11px;color:#7a9c8a;line-height:1.6;font-style:italic;">
Nivra Telecom inc. — Sans contrat. Sans détour.<br>
© 2026 · Tous droits réservés
</div>
</td></tr>

</table>

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
      subject: "Votre ligne est ouverte, Oldo — 1 Gbps en service",
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
