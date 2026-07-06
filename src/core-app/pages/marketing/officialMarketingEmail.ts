const COLORS = {
  primary: "#0066CC",
  primaryDark: "#004C99",
  primaryLight: "#E6F0FA",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  white: "#FFFFFF",
  bgLight: "#F8FAFB",
  bgSection: "#F3F4F6",
  borderLight: "#E5E7EB",
  footerBg: "#1F2937",
  footerText: "#D1D5DB",
  footerLink: "#9CA3AF",
};

const FONT = "Arial, Helvetica, 'Segoe UI', sans-serif";

export const OFFICIAL_MARKETING_BODY = `<h2 style="color:#0066CC;font-size:22px;margin:0 0 12px;font-weight:700">Bonjour {{first_name}},</h2>
<p style="font-size:15px;line-height:1.7;color:#4A4A4A;margin:0 0 16px">Présentez ici votre offre, votre nouvelle campagne ou votre message client. Ce contenu sera toujours envoyé dans le template officiel Nivra.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto"><tr><td style="background:#0066CC;border-radius:6px;text-align:center"><a href="https://nivra-telecom.ca" style="display:inline-block;padding:14px 32px;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;font-family:Arial,Helvetica,sans-serif">Voir les forfaits</a></td></tr></table>`;

export const MARKETING_EMAIL_SNIPPETS = [
  {
    label: "Titre",
    html: `<h2 style="color:#0066CC;font-size:22px;margin:0 0 12px;font-weight:700">Bonjour {{first_name}},</h2>`,
  },
  {
    label: "Texte",
    html: `<p style="font-size:15px;line-height:1.7;color:#4A4A4A;margin:0 0 16px">Écrivez votre message ici avec une offre claire et utile.</p>`,
  },
  {
    label: "Bouton",
    html: `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto"><tr><td style="background:#0066CC;border-radius:6px;text-align:center"><a href="https://nivra-telecom.ca" style="display:inline-block;padding:14px 32px;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;font-family:Arial,Helvetica,sans-serif">Voir les forfaits</a></td></tr></table>`,
  },
  {
    label: "Encadré",
    html: `<div style="background:#E6F0FA;border:1px solid #E5E7EB;border-radius:8px;padding:18px;margin:20px 0"><strong style="color:#004C99">À retenir</strong><p style="margin:8px 0 0;color:#4A4A4A;line-height:1.6">Ajoutez un détail important pour {{city}} ou pour ce segment.</p></div>`,
  },
  {
    label: "Séparateur",
    html: `<hr style="border:0;border-top:1px solid #E5E7EB;margin:24px 0" />`,
  },
] as const;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeOfficialMarketingBody(html: string): string {
  return String(html || OFFICIAL_MARKETING_BODY)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<!doctype[\s\S]*?>/gi, "")
    .replace(/<head[\s\S]*?>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .replace(/<div[^>]*background\s*:\s*#0066CC[^>]*>[\s\S]*?Nivra Telecom[\s\S]*?<\/div>/i, "")
    .replace(/<div[^>]*background\s*:\s*#f5f5f5[\s\S]*?Se désabonner[\s\S]*?<\/div>\s*<\/div>\s*$/i, "")
    .trim();
}

function personalizePreview(html: string): string {
  return html
    .replace(/\{\{first_name\}\}/g, "Alex")
    .replace(/\{\{full_name\}\}/g, "Alex Tremblay")
    .replace(/\{\{city\}\}/g, "Montréal")
    .replace(/\{\{email\}\}/g, "alex@example.com")
    .replace(/\{\{unsubscribe_url\}\}/g, "#desabonnement");
}

export function renderOfficialMarketingEmail({
  title = "Nivra Telecom",
  preheader = "",
  bodyHtml = OFFICIAL_MARKETING_BODY,
  showUnsubscribe = true,
}: {
  title?: string;
  preheader?: string;
  bodyHtml?: string;
  showUnsubscribe?: boolean;
}) {
  const previewBody = personalizePreview(normalizeOfficialMarketingBody(bodyHtml));
  const unsubscribe = showUnsubscribe
    ? `<div style="border-top:1px solid ${COLORS.borderLight};margin-top:24px;padding-top:16px;text-align:center;font-size:12px;line-height:1.6;color:${COLORS.textMuted};font-family:${FONT}">Vous recevez ce message parce que vous êtes inscrit aux communications Nivra.<br><a href="#desabonnement" style="color:${COLORS.primary};text-decoration:underline">Se désabonner</a></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin:0; padding:0; background:${COLORS.bgLight}; font-family:${FONT}; color:${COLORS.textPrimary}; }
    table { border-collapse:collapse; }
    @media only screen and (max-width: 600px) { .container { width:100% !important; } .content-padding { padding:24px 16px !important; } .header-padding { padding:20px 16px !important; } }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)} &#847; &#847; &#847;</div>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${COLORS.bgLight}">
    <tr><td style="padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" class="container" style="max-width:600px;width:100%;margin:0 auto;background:${COLORS.white};border:1px solid ${COLORS.borderLight};border-radius:8px;overflow:hidden">
        <tr><td class="header-padding" style="padding:28px 40px;border-bottom:3px solid ${COLORS.primary};background:${COLORS.white}">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%"><tr>
            <td style="text-align:left"><h1 style="margin:0;font-size:26px;font-weight:700;color:${COLORS.primary};font-family:${FONT}">Nivra Telecom</h1></td>
            <td style="text-align:right;vertical-align:middle"><span style="color:${COLORS.textMuted};font-size:11px;text-transform:uppercase;letter-spacing:1px">Télécommunications</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="content-padding" style="padding:32px 40px;background:${COLORS.white};font-family:${FONT}">
          ${previewBody}
          ${unsubscribe}
          <div style="background:${COLORS.primaryLight};border:1px solid ${COLORS.borderLight};border-radius:8px;margin-top:24px;padding:18px 20px;font-size:13px;color:${COLORS.textSecondary};line-height:1.6">
            <strong style="color:${COLORS.primaryDark};text-transform:uppercase;font-size:11px;letter-spacing:.6px">Support Nivra Telecom</strong><br>
            Une question ? Notre équipe vous répond rapidement à <a href="mailto:support@nivra-telecom.ca" style="color:${COLORS.primary}">support@nivra-telecom.ca</a>.
          </div>
        </td></tr>
        <tr><td style="background:${COLORS.footerBg};padding:32px 40px;text-align:center">
          <h4 style="color:${COLORS.white};font-size:18px;font-weight:700;margin:0">Nivra Telecom</h4>
          <p style="color:${COLORS.footerText};font-size:13px;margin:8px 0 18px">Fournisseur de services Internet et TV sans contrat au Québec</p>
          <p style="color:${COLORS.footerLink};font-size:12px;margin:0"><a href="https://nivra-telecom.ca" style="color:${COLORS.footerLink};text-decoration:none">Site web</a> · <a href="https://nivra-telecom.ca/forfaits" style="color:${COLORS.footerLink};text-decoration:none">Forfaits</a> · <a href="https://nivra-telecom.ca/faq" style="color:${COLORS.footerLink};text-decoration:none">FAQ</a></p>
          <p style="border-top:1px solid #374151;color:${COLORS.textLight};font-size:11px;margin:18px 0 0;padding-top:16px">© ${new Date().getFullYear()} Nivra Communications Inc. Tous droits réservés.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}