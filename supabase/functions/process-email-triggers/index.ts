import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface TriggerRecord {
  id: string;
  trigger_type: string;
  client_id: string;
  client_email: string;
  client_name: string | null;
  metadata: Record<string, unknown>;
}

interface AutomationRule {
  id: string;
  template_id: string | null;
  subject_override: string | null;
  delay_minutes: number | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  variables: string[] | null;
}

function replaceVariables(content: string, variables: Record<string, unknown>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    result = result.replace(regex, String(value ?? ''));
  }
  // Clean up any remaining unmatched variables
  result = result.replace(/{{\s*\w+\s*}}/g, '');
  return result;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending triggers
    const { data: triggers, error: triggersError } = await supabase
      .from("email_trigger_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (triggersError) {
      throw new Error(`Failed to fetch triggers: ${triggersError.message}`);
    }

    if (!triggers || triggers.length === 0) {
      return new Response(JSON.stringify({ message: "No pending triggers" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const trigger of triggers as TriggerRecord[]) {
      try {
        // Get the automation rule for this trigger type
        const { data: rule } = await supabase
          .from("email_automation_rules")
          .select("id, template_id, subject_override, delay_minutes")
          .eq("trigger_type", trigger.trigger_type)
          .eq("is_active", true)
          .single();

        if (!rule || !rule.template_id) {
          // Mark as processed with no template
          await supabase
            .from("email_trigger_queue")
            .update({ 
              status: "skipped", 
              processed_at: new Date().toISOString(),
              error_message: "No active automation rule or template found"
            })
            .eq("id", trigger.id);
          continue;
        }

        // Check delay
        if (rule.delay_minutes && rule.delay_minutes > 0) {
          const triggerTime = new Date(trigger.metadata.created_at as string || Date.now());
          const sendTime = new Date(triggerTime.getTime() + rule.delay_minutes * 60 * 1000);
          if (new Date() < sendTime) {
            // Not ready to send yet
            continue;
          }
        }

        // Get the template
        const { data: template } = await supabase
          .from("email_templates")
          .select("id, name, subject, html_content, variables")
          .eq("id", rule.template_id)
          .eq("is_active", true)
          .single();

        if (!template) {
          await supabase
            .from("email_trigger_queue")
            .update({ 
              status: "failed", 
              processed_at: new Date().toISOString(),
              error_message: "Template not found or inactive"
            })
            .eq("id", trigger.id);
          continue;
        }

        // Check unsubscribe status
        const { data: unsubscribed } = await supabase
          .from("email_unsubscribes")
          .select("id")
          .eq("client_id", trigger.client_id)
          .eq("is_active", true)
          .single();

        if (unsubscribed) {
          await supabase
            .from("email_trigger_queue")
            .update({ 
              status: "skipped", 
              processed_at: new Date().toISOString(),
              error_message: "Client is unsubscribed"
            })
            .eq("id", trigger.id);
          continue;
        }

        // Prepare variables for template
        const templateVars = {
          client_name: trigger.client_name || "Client",
          first_name: trigger.client_name?.split(" ")[0] || "Client",
          email: trigger.client_email,
          ...trigger.metadata,
        };

        // Replace variables in content and subject
        const htmlContent = replaceVariables(template.html_content, templateVars);
        const subject = replaceVariables(rule.subject_override || template.subject, templateVars);

        // Send email via Resend
        const emailResponse = await resend.emails.send({
          from: "Nivra <noreply@nivra.ca>",
          to: [trigger.client_email],
          subject: subject,
          html: htmlContent,
        });

        // Record the send
        await supabase.from("email_sends").insert({
          client_id: trigger.client_id,
          template_id: template.id,
          automation_rule_id: rule.id,
          to_email: trigger.client_email,
          to_name: trigger.client_name,
          subject: subject,
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_id: emailResponse.data?.id,
        });

        // Update automation stats
        await supabase.rpc("increment_automation_stats", {
          p_automation_id: rule.id,
          p_field: "total_sent",
        });

        // Mark trigger as processed
        await supabase
          .from("email_trigger_queue")
          .update({ 
            status: "sent", 
            processed_at: new Date().toISOString() 
          })
          .eq("id", trigger.id);

        results.push({ id: trigger.id, status: "sent", email: trigger.client_email });

      } catch (triggerError: unknown) {
        const errorMessage = triggerError instanceof Error ? triggerError.message : "Unknown error";
        
        await supabase
          .from("email_trigger_queue")
          .update({ 
            status: "failed", 
            processed_at: new Date().toISOString(),
            error_message: errorMessage
          })
          .eq("id", trigger.id);

        results.push({ id: trigger.id, status: "failed", error: errorMessage });
      }
    }

    return new Response(JSON.stringify({ 
      processed: results.length,
      results 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing triggers:", errorMessage);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
