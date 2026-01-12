import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInviteRequest {
  influencer_id: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-partner-invite] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const { influencer_id }: SendInviteRequest = await req.json();

    console.log("[send-partner-invite] Sending invite for influencer:", influencer_id);

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch influencer details
    const { data: influencer, error: influencerError } = await supabase
      .from("influencers")
      .select("id, first_name, last_name, email")
      .eq("id", influencer_id)
      .single();

    if (influencerError || !influencer) {
      console.error("[send-partner-invite] Influencer not found:", influencerError);
      return new Response(
        JSON.stringify({ success: false, error: "Influencer not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch or create invite token
    let inviteData = await supabase
      .from("influencer_invites")
      .select("id, token, expires_at")
      .eq("influencer_id", influencer_id)
      .is("used_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let inviteToken: string;

    if (!inviteData.data) {
      // Create new invite token
      const token = crypto.randomUUID();
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      const { data: newInvite, error: createError } = await supabase
        .from("influencer_invites")
        .insert({
          influencer_id,
          token,
          expires_at,
        })
        .select()
        .single();

      if (createError || !newInvite) {
        console.error("[send-partner-invite] Failed to create invite:", createError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create invite" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      inviteToken = newInvite.token;
    } else {
      inviteToken = inviteData.data.token;
    }

    // Build absolute onboarding URL
    const appUrl = Deno.env.get("APP_URL") || "https://nivratelecom.ca";
    const onboardingUrl = `${appUrl}/influencer/onboarding?token=${encodeURIComponent(inviteToken)}`;

    console.log("[send-partner-invite] Onboarding URL:", onboardingUrl);

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <support@nivratelecom.ca>",
      to: [influencer.email],
      subject: "Bienvenue au programme partenaires Nivra!",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation partenaire Nivra</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #0891b2; font-size: 28px; margin: 0;">🎉 Bienvenue ${influencer.first_name}!</h1>
      </div>
      
      <!-- Content -->
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Vous avez été invité(e) à rejoindre le <strong>Programme Partenaires Nivra Telecom</strong>.
      </p>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        En tant que partenaire, vous pourrez :
      </p>
      
      <ul style="color: #374151; font-size: 16px; line-height: 1.8; margin-bottom: 32px; padding-left: 20px;">
        <li>Gagner des commissions sur chaque client référé</li>
        <li>Suivre vos performances en temps réel</li>
        <li>Demander des retraits facilement</li>
      </ul>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${onboardingUrl}" style="display: inline-block; background-color: #0891b2; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
          Activer mon compte partenaire
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
        Ce lien expire dans 7 jours. Si vous n'avez pas demandé cette invitation, ignorez cet email.
      </p>
      
      <!-- Divider -->
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
      
      <!-- Footer -->
      <div style="text-align: center; color: #6b7280; font-size: 14px;">
        <p style="margin: 0 0 8px 0;">Besoin d'aide?</p>
        <p style="margin: 0;">
          <a href="mailto:Support@NivraTelecom.ca" style="color: #0891b2; text-decoration: none;">Support@NivraTelecom.ca</a>
        </p>
      </div>
      
    </div>
    
    <div style="text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px;">
      <p>© ${new Date().getFullYear()} Nivra Telecom. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    console.log("[send-partner-invite] Email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, email_sent: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("[send-partner-invite] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
