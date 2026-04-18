import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribeToken.ts";

const FUNCTIONS_BASE = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;
const PUBLIC_SITE = Deno.env.get("PUBLIC_SITE_URL") ?? "https://nivra-telecom.ca";

/** Inject tracking pixel + rewrite <a href> through track-email-click. */
function injectTracking(html: string, campaignId: string | null, sendId: string): string {
  const cidQ = campaignId ? `cid=${encodeURIComponent(campaignId)}&` : "";
  const rewritten = html.replace(
    /href\s*=\s*"([^"]+)"/gi,
    (full, url: string) => {
      if (/^(mailto:|tel:|#|javascript:)/i.test(url)) return full;
      if (url.includes("/email-unsubscribe") || url.includes("/unsubscribe?token=")) return full;
      if (url.includes("/track-email-click")) return full;
      const wrapped = `${FUNCTIONS_BASE}/track-email-click?${cidQ}rid=${encodeURIComponent(sendId)}&url=${encodeURIComponent(url)}`;
      return `href="${wrapped}"`;
    },
  );
  const pixel = `<img src="${FUNCTIONS_BASE}/track-email-open?${cidQ}rid=${encodeURIComponent(sendId)}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px" />`;
  return rewritten.includes("</body>")
    ? rewritten.replace("</body>", `${pixel}</body>`)
    : `${rewritten}${pixel}`;
}

interface SendRequest {
  campaign_id?: string;
  automation_rule_id?: string;
  template_id?: string;
  client_ids?: string[];
  test_email?: string;
  subject_override?: string;
  preview_count?: boolean;       // returns recipient count only, no send
  segment_filters?: Record<string, unknown>; // for preview without a campaign row
}

interface Client {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: SendRequest = await req.json();
    const { campaign_id, automation_rule_id, template_id, client_ids, test_email, subject_override: reqSubjectOverride, preview_count } = body;

    // Get template and campaign/automation info
    let template: { id: string; subject: string; html_content: string; variables: string[] } | null = null;
    let subjectOverride: string | null = reqSubjectOverride || null;
    let segmentFilters: Record<string, unknown> = body.segment_filters || {};

    if (campaign_id) {
      const { data: campaign, error } = await supabase
        .from("email_campaigns")
        .select("*, email_templates(*)")
        .eq("id", campaign_id)
        .single();

      if (error || !campaign) {
        throw new Error("Campaign not found");
      }

      template = campaign.email_templates;
      subjectOverride = campaign.subject_override;
      segmentFilters = campaign.segment_filters || {};

      // Update campaign status
      await supabase
        .from("email_campaigns")
        .update({ status: "sending", started_at: new Date().toISOString() })
        .eq("id", campaign_id);

    } else if (automation_rule_id) {
      const { data: rule, error } = await supabase
        .from("email_automation_rules")
        .select("*, email_templates(*)")
        .eq("id", automation_rule_id)
        .single();

      if (error || !rule) {
        throw new Error("Automation rule not found");
      }

      template = rule.email_templates;
      subjectOverride = subjectOverride || rule.subject_override;
      segmentFilters = rule.segment_filters || {};
    } else if (template_id) {
      // Direct template send (no campaign/automation)
      const { data: templateData, error } = await supabase
        .from("email_templates")
        .select("id, subject, html_content, variables")
        .eq("id", template_id)
        .single();

      if (error || !templateData) {
        throw new Error("Template not found");
      }

      template = templateData;
    }

    if (!template && !preview_count) {
      throw new Error("No template found");
    }

    // Test email mode
    if (test_email) {
      const result = await sendEmail(resendApiKey, {
        to: test_email,
        subject: subjectOverride || template.subject,
        html: replaceVariables(template.html_content, {
          client_name: "Test User",
          client_email: test_email,
          portal_link: `${supabaseUrl.replace('.supabase.co', '')}/portal`,
          unsubscribe_link: "#"
        })
      });

      return new Response(JSON.stringify({ success: true, test: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get clients to send to
    let clients: Client[] = [];

    if (client_ids && client_ids.length > 0) {
      const { data } = await supabase
        .from("clients")
        .select("id, email, first_name, last_name, phone")
        .in("id", client_ids);
      clients = data || [];
    } else {
      // Build query based on segment filters
      let query = supabase
        .from("clients")
        .select("id, email, first_name, last_name, phone");

      // Apply status filter
      if (segmentFilters.status && Array.isArray(segmentFilters.status) && segmentFilters.status.length > 0) {
        query = query.in("status", segmentFilters.status);
      }

      // Apply date filters
      if (segmentFilters.created_after) {
        query = query.gte("created_at", segmentFilters.created_after);
      }
      if (segmentFilters.created_before) {
        query = query.lte("created_at", segmentFilters.created_before);
      }

      // City filter (case-insensitive)
      if (segmentFilters.city && typeof segmentFilters.city === "string" && segmentFilters.city.trim()) {
        query = query.ilike("service_city", `%${segmentFilters.city.trim()}%`);
      }

      // Language filter — fr | en | both (both = no filter)
      if (segmentFilters.language === "fr" || segmentFilters.language === "en") {
        query = query.eq("preferred_language", segmentFilters.language);
      }

      const { data } = await query.limit(5000);
      clients = data || [];

      // Filter by service if needed (requires join with service_instances)
      if (segmentFilters.services && Array.isArray(segmentFilters.services) && segmentFilters.services.length > 0) {
        const { data: serviceClients } = await supabase
          .from("service_instances")
          .select("client_id")
          .in("service_type", segmentFilters.services)
          .eq("status", "active");

        const clientIdsWithService = new Set(serviceClients?.map(s => s.client_id) || []);
        clients = clients.filter(c => clientIdsWithService.has(c.id));
      }
    }

    // Check unsubscribes
    const { data: unsubscribes } = await supabase
      .from("email_unsubscribes")
      .select("email")
      .eq("is_active", true);

    const unsubscribedEmails = new Set(unsubscribes?.map(u => u.email) || []);
    clients = clients.filter(c => !unsubscribedEmails.has(c.email));

    // Check email preferences
    const { data: preferences } = await supabase
      .from("client_email_preferences")
      .select("client_id, marketing_emails")
      .eq("marketing_emails", false);

    const optedOutClients = new Set(preferences?.map(p => p.client_id) || []);
    clients = clients.filter(c => !optedOutClients.has(c.id));

    // Preview-only mode: return count without sending
    if (preview_count) {
      return new Response(
        JSON.stringify({ success: true, preview: true, total_recipients: clients.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update recipient count
    if (campaign_id) {
      await supabase
        .from("email_campaigns")
        .update({ total_recipients: clients.length })
        .eq("id", campaign_id);
    }

    // Send emails
    let sentCount = 0;
    let failedCount = 0;
    const portalUrl = supabaseUrl.replace(".supabase.co", "").replace("https://", "https://");

    for (const client of clients) {
      try {
        const variables = {
          client_name: `${client.first_name} ${client.last_name}`.trim() || "Client",
          client_email: client.email,
          client_phone: client.phone || "",
          portal_link: `${portalUrl}/portal`,
          unsubscribe_link: `${portalUrl}/unsubscribe?email=${encodeURIComponent(client.email)}`
        };

        const html = replaceVariables(template.html_content, variables);
        const subject = replaceVariables(subjectOverride || template.subject, variables);

        const result = await sendEmail(resendApiKey, {
          to: client.email,
          subject,
          html
        });

        // Log the send
        await supabase.from("email_sends").insert({
          campaign_id,
          automation_rule_id,
          template_id: template.id,
          client_id: client.id,
          to_email: client.email,
          to_name: `${client.first_name} ${client.last_name}`.trim(),
          subject,
          resend_id: result.id,
          status: "sent",
          sent_at: new Date().toISOString()
        });

        sentCount++;

        // Rate limiting: 10 emails per second
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Failed to send to ${client.email}:`, error);
        
        await supabase.from("email_sends").insert({
          campaign_id,
          automation_rule_id,
          template_id: template.id,
          client_id: client.id,
          to_email: client.email,
          to_name: `${client.first_name} ${client.last_name}`.trim(),
          subject: subjectOverride || template.subject,
          status: "failed",
          error_message: (error as Error).message,
          failed_at: new Date().toISOString()
        });

        failedCount++;
      }
    }

    // Update campaign stats
    if (campaign_id) {
      await supabase
        .from("email_campaigns")
        .update({
          total_sent: sentCount,
          status: "sent",
          completed_at: new Date().toISOString()
        })
        .eq("id", campaign_id);
    }

    // Update automation stats
    if (automation_rule_id) {
      await supabase.rpc("increment_automation_stats", {
        rule_id: automation_rule_id,
        triggered_count: clients.length,
        sent_count: sentCount
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_recipients: clients.length,
        sent: sentCount,
        failed: failedCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function replaceVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

async function sendEmail(_apiKey: string, params: { to: string; subject: string; html: string }) {
  const result = await enqueueEmail({
    to: params.to,
    templateKey: "custom_html",
    subject: params.subject,
    html: params.html,
    fromEmail: "Nivra Télécom <marketing@nivra-telecom.ca>",
    replyTo: "support@nivra-telecom.ca",
    messageType: "marketing_email",
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to queue email");
  }

  return { id: result.id };
}
