// One-shot preview sender — WARM HUMAN design
// Not AI-tech. Inspired by craft letters, warm paper, hand-written notes
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
    .title{font-size:34px!important;line-height:1.15!important;}
    .signature{font-size:28px!important;}
  }
  a{color:#9c5f3a;}
</style>
</head>
<body style="margin:0;padding:0;background:#ede4d3;font-family:Georgia,'Times New Roman',serif;color:#2b2419;">

<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#ede4d3;opacity:0;">
Une petite note pour vous dire que tout est prêt, Oldo. Bienvenue chez Nivra.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ede4d3;">
<tr><td align="center" style="padding:48px 16px 56px;">

<!-- ═══════ ENVELOPE WRAPPER ═══════ -->
<table role="presentation" class="container" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#fbf6ec;border-radius:4px;box-shadow:0 2px 0 #d4c5a8,0 8px 28px rgba(70,50,20,0.18);position:relative;">

<!-- ─── Stamp area (top right) ─── -->
<tr><td class="px" style="padding:36px 56px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:top;">
<!-- Postmark style date -->
<div style="display:inline-block;border:1.5px solid #2b2419;border-radius:50%;padding:10px 14px;font-family:Georgia,serif;font-size:10px;color:#2b2419;letter-spacing:1px;text-transform:uppercase;line-height:1.3;text-align:center;">
Montréal<br>
<span style="font-size:13px;font-weight:bold;">18 · IV</span><br>
2026
</div>
</td>
<td align="right" style="vertical-align:top;">
<!-- Stamp -->
<div style="display:inline-block;background:#9c5f3a;border:2px dashed #fbf6ec;outline:1.5px solid #9c5f3a;padding:14px 12px;text-align:center;color:#fbf6ec;font-family:Georgia,serif;line-height:1;">
<div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-style:italic;">Nivra</div>
<div style="font-size:18px;font-weight:bold;margin:6px 0 4px;">QC</div>
<div style="font-size:9px;letter-spacing:1px;">★&nbsp;★&nbsp;★</div>
</div>
</td>
</tr>
</table>
</td></tr>

<!-- ─── Address line ─── -->
<tr><td class="px" style="padding:32px 56px 0;">
<div style="font-family:'Courier New',Courier,monospace;font-size:12px;color:#6b5a3f;letter-spacing:0.5px;line-height:1.7;border-bottom:1px dashed #c8b896;padding-bottom:14px;">
À l'attention de<br>
<span style="color:#2b2419;font-size:13px;">Monsieur Oldo Lavaud</span>
</div>
</td></tr>

<!-- ─── Opening ─── -->
<tr><td class="px" style="padding:36px 56px 0;">
<div style="font-family:'Brush Script MT','Lucida Handwriting',cursive;font-size:24px;color:#9c5f3a;font-style:italic;line-height:1;">
Cher Oldo,
</div>
</td></tr>

<!-- ─── Title ─── -->
<tr><td class="px" style="padding:24px 56px 0;">
<h1 class="title" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:42px;font-weight:normal;color:#2b2419;line-height:1.1;letter-spacing:-0.5px;">
Tout est <em style="color:#9c5f3a;">prêt.</em>
</h1>
<div style="margin-top:14px;width:60px;height:2px;background:#9c5f3a;"></div>
</td></tr>

<!-- ─── Body letter ─── -->
<tr><td class="px" style="padding:28px 56px 0;">
<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:16px;color:#3d3424;line-height:1.7;">
Nous voulions vous écrire cette petite note pour vous dire que votre service <strong style="color:#2b2419;">GIGA Internet et TV 25 choix</strong> est désormais bien actif chez vous, à votre adresse, depuis aujourd'hui même.
</p>
<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:16px;color:#3d3424;line-height:1.7;">
Pas de paperasse, pas de contrat. Juste une connexion qui fonctionne, et une équipe qui répond — en français, et en moins de deux heures.
</p>
<p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#3d3424;line-height:1.7;">
Bienvenue dans la famille Nivra.
</p>
</td></tr>

<!-- ─── Receipt-style box (looks like a paper ticket) ─── -->
<tr><td class="px" style="padding:36px 56px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5ecda;border-top:2px dashed #c8b896;border-bottom:2px dashed #c8b896;">
<tr><td style="padding:22px 24px;">

<div style="font-family:'Courier New',Courier,monospace;font-size:11px;color:#6b5a3f;letter-spacing:1.5px;text-transform:uppercase;text-align:center;margin-bottom:18px;">
~ Reçu d'activation ~
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Courier New',Courier,monospace;font-size:13px;color:#2b2419;">
<tr>
<td style="padding:5px 0;color:#6b5a3f;">Commande</td>
<td align="right" style="padding:5px 0;">№&nbsp;99999</td>
</tr>
<tr>
<td style="padding:5px 0;color:#6b5a3f;">Compte</td>
<td align="right" style="padding:5px 0;">№&nbsp;200711</td>
</tr>
<tr>
<td style="padding:5px 0;color:#6b5a3f;">Forfait</td>
<td align="right" style="padding:5px 0;">GIGA + TV 25</td>
</tr>
<tr>
<td style="padding:5px 0;color:#6b5a3f;">Activé</td>
<td align="right" style="padding:5px 0;">18 avril 2026</td>
</tr>
<tr><td colspan="2" style="padding:10px 0 6px;">
<div style="border-top:1px dotted #c8b896;"></div>
</td></tr>
<tr>
<td style="padding:5px 0;color:#9c5f3a;font-weight:bold;">Prochaine facture</td>
<td align="right" style="padding:5px 0;color:#9c5f3a;font-weight:bold;">120,72&nbsp;$</td>
</tr>
<tr>
<td style="padding:0;font-size:11px;color:#6b5a3f;">19 mai 2026</td>
<td align="right" style="padding:0;font-size:11px;color:#6b5a3f;">taxes incluses</td>
</tr>
</table>

<div style="text-align:center;margin-top:18px;font-family:'Courier New',Courier,monospace;font-size:10px;color:#a89674;letter-spacing:2px;">
✦ &nbsp; ✦ &nbsp; ✦
</div>

</td></tr>
</table>
</td></tr>

<!-- ─── CTA — looks like a wax-sealed invitation ─── -->
<tr><td class="px" align="center" style="padding:40px 56px 0;">
<a href="https://nivra-telecom.ca/mon-compte" style="display:inline-block;background:#2b2419;color:#fbf6ec;text-decoration:none;padding:16px 36px;border-radius:2px;font-family:Georgia,serif;font-size:14px;font-style:italic;letter-spacing:0.5px;border:1px solid #2b2419;box-shadow:3px 3px 0 #9c5f3a;">
Visiter mon espace client →
</a>
</td></tr>

<!-- ─── Closing & signature ─── -->
<tr><td class="px" style="padding:44px 56px 0;">
<p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;color:#3d3424;line-height:1.6;font-style:italic;">
Avec gratitude,
</p>
<div class="signature" style="font-family:'Brush Script MT','Lucida Handwriting',cursive;font-size:34px;color:#9c5f3a;line-height:1;margin-top:8px;">
L'équipe Nivra
</div>
<div style="margin-top:6px;font-family:Georgia,serif;font-size:12px;color:#6b5a3f;font-style:italic;letter-spacing:0.3px;">
— Montréal, Québec
</div>
</td></tr>

<!-- ─── P.S. handwritten note ─── -->
<tr><td class="px" style="padding:36px 56px 0;">
<div style="border-top:1px dashed #c8b896;padding-top:20px;font-family:Georgia,serif;font-size:14px;color:#3d3424;line-height:1.6;font-style:italic;">
<strong style="font-style:normal;color:#9c5f3a;">P.&nbsp;S.</strong>&nbsp;&nbsp;Une question ? Écrivez-nous à <a href="mailto:support@nivra-telecom.ca" style="color:#9c5f3a;text-decoration:underline;">support@nivra-telecom.ca</a> — nous lisons chaque message.
</div>
</td></tr>

<!-- ─── Bottom decorative band ─── -->
<tr><td style="padding:44px 0 0;">
<div style="height:8px;background:repeating-linear-gradient(45deg,#9c5f3a 0,#9c5f3a 8px,#fbf6ec 8px,#fbf6ec 16px);"></div>
</td></tr>

<!-- ─── Footer ─── -->
<tr><td class="px" align="center" style="padding:24px 56px 36px;background:#f5ecda;">
<div style="font-family:Georgia,serif;font-size:11px;color:#6b5a3f;line-height:1.7;letter-spacing:0.3px;">
<a href="https://nivra-telecom.ca/mon-compte" style="color:#6b5a3f;text-decoration:none;">Mon compte</a>
&nbsp;·&nbsp;
<a href="https://nivra-telecom.ca/support" style="color:#6b5a3f;text-decoration:none;">Aide</a>
&nbsp;·&nbsp;
<a href="https://nivra-telecom.ca/confidentialite" style="color:#6b5a3f;text-decoration:none;">Confidentialité</a>
&nbsp;·&nbsp;
<a href="https://nivra-telecom.ca/desabonner" style="color:#6b5a3f;text-decoration:none;">Désabonnement</a>
</div>
<div style="margin-top:14px;font-family:Georgia,serif;font-size:11px;color:#a89674;line-height:1.6;font-style:italic;">
Nivra Telecom inc. · Montréal, Québec · Canada<br>
© Deux mille vingt-six. Tous droits réservés.
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
      subject: "Une petite note pour vous, Oldo",
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
