/**
 * nova-brain -- NOVA Digital Brain (Claude Sonnet 4.7 + tool use + caching)
 *
 * What changed in this rewrite:
 *   - Model: claude-3-haiku-20240307 â†’ claude-sonnet-4-5 (configurable via NOVA_MODEL env)
 *     (10x reasoning capacity for real CEO-level decisions, not just chat)
 *   - Tool use enabled: NOVA can now CALL tools (query metrics, queue email,
 *     suspend account, look up customer state) instead of just talking about them
 *   - Prompt caching: the system prompt + memory text are cached for 5 min,
 *     so follow-up turns reuse the cached prefix (5-10x cost reduction +
 *     dramatically lower latency)
 *   - Full audit trail: every interaction is logged to agent_audit_log AND
 *     nova_reasoning_log (prompt, response, tools called, tokens, latency)
 *
 * Request body:
 *   {
 *     messages: Array<{role: "user"|"assistant", content: string}>,
 *     conversation_id?: string,            // for multi-turn memory linkage
 *     enable_tools?: boolean (default true)
 *   }
 *
 * Response:
 *   {
 *     content: string,                     // NOVA's text reply
 *     tool_calls?: Array<{name, input, output}>,
 *     usage: {input_tokens, output_tokens, cache_creation, cache_read},
 *     reasoning_log_id: string,            // for drill-down
 *   }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { reportEdgeError } from "../_shared/sentry.ts";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AGENT = "nova-brain";
// Model -- overridable via NOVA_MODEL env. Default to Sonnet 4.5 (proven alias).
// Set NOVA_MODEL=claude-sonnet-4-7 (or claude-opus-4-7) in Lovable Secrets
// once you've confirmed the alias works for your Anthropic plan.
const MODEL = Deno.env.get("NOVA_MODEL") ?? "claude-sonnet-4-5";
const MAX_TOKENS = 4096;
// Max sequential tool calls in a single turn (prevents infinite loops while
// allowing multi-step reasoning like "look up client X, then queue email").
const MAX_TOOL_ITERATIONS = 5;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// TOOL DEFINITIONS -- what NOVA can DO, not just talk about.
//
// Two categories:
//  (1) Read-only / safe -- NOVA can call these freely (queries, lookups, memory)
//  (2) Mutating -- NOVA must explain what it's about to do, then act
//      (suspend, credit, cancel, email customer with approval)
//
// Truly destructive actions (delete account, refund) stay OUT -- those require
// a human admin click in Core, not a voice command.
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const TOOLS = [
  // â"€â"€â"€ READ / LOOKUP â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  {
    name: "get_account_state",
    description:
      "Get the canonical account state (active / suspended / pending_kyc / etc.) for an account. " +
      "Use whenever the user asks 'what's the status of X?' or 'how is account NIV-ACCT-... ?'",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "UUID of the account (preferred)" },
        account_number: { type: "string", description: "Human account number, e.g. NIV-ACCT-000123" },
      },
    },
  },
  {
    name: "search_customers",
    description: "Free-text search across name / email / phone / account_number. Returns up to 10 matches.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_business_metrics",
    description:
      "Real-time Nivra business KPIs: active customers, MRR, churn, open complaints, " +
      "overdue invoices, latest payments. Always prefer this over guessing numbers.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_customer_payments",
    description:
      "Last N payments for a customer (default 10), most recent first. Includes amount, method, status.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["account_id"],
    },
  },
  {
    name: "get_customer_invoices",
    description: "Last N invoices for a customer (default 10). Includes total, balance_due, status, due_date.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["account_id"],
    },
  },
  {
    name: "get_customer_subscriptions",
    description: "All subscriptions for a customer with their current state and plan.",
    input_schema: {
      type: "object",
      properties: { account_id: { type: "string" } },
      required: ["account_id"],
    },
  },
  {
    name: "get_open_support_tickets",
    description:
      "List open / pending support tickets, optionally filtered by priority or account. Use for " +
      "questions like 'show me the urgent tickets'.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Optional -- filter to one customer" },
        priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "get_sla_breaches",
    description: "Items currently breaching SLA (overdue beyond their deadline). Used for 'what's on fire?'.",
    input_schema: { type: "object", properties: {} },
  },

  // â"€â"€â"€ MUTATING -- require user confirmation in the prompt â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  {
    name: "credit_account",
    description:
      "Apply a credit (positive amount) to a customer's account_adjustments. Use ONLY when the user " +
      "explicitly asks you to credit a customer and tells you the amount + reason. NEVER guess the amount.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        amount: { type: "number", description: "Credit amount in CAD (positive number)" },
        reason: { type: "string", description: "Why this credit is being applied" },
        months: { type: "integer", description: "How many months this credit applies for (default 1)", minimum: 1, maximum: 36 },
      },
      required: ["account_id", "amount", "reason"],
    },
  },
  {
    name: "suspend_account",
    description:
      "Suspend a customer account. Use ONLY when the user explicitly asks AND confirms. First call WITHOUT confirmed to explain what will happen. Only set confirmed: true after the user says 'yes, confirm' or equivalent.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        reason: { type: "string" },
        confirmed: { type: "boolean", description: "Must be true -- user has explicitly confirmed this action" },
      },
      required: ["account_id", "reason", "confirmed"],
    },
  },
  {
    name: "reactivate_account",
    description: "Reactivate a previously suspended account. Sets accounts.status='active'.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        reason: { type: "string" },
      },
      required: ["account_id", "reason"],
    },
  },
  {
    name: "trigger_cancellation",
    description:
      "Trigger the orchestrated cancellation engine (cancel-account function). Cascades subscriptions, " +
      "subscriptions, invoices, commissions, email. Use ONLY when the user explicitly asks to cancel AND confirms. " +
      "scope='service' keeps the account open; scope='full' closes it permanently. Always confirm before executing.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        scope: { type: "string", enum: ["service", "full"] },
        reason: { type: "string" },
        confirmed: { type: "boolean", description: "Must be true -- user has explicitly confirmed this cancellation" },
      },
      required: ["account_id", "scope", "reason", "confirmed"],
    },
  },
  {
    name: "create_support_ticket",
    description:
      "Open a support ticket on behalf of a customer. Use when the user describes a customer issue and " +
      "says 'create a ticket' or similar.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
        category: { type: "string" },
      },
      required: ["account_id", "subject", "body"],
    },
  },
  {
    name: "create_work_order",
    description: "Create a technician work order for installation, repair, or service visit. Use when a customer needs a technician. Requires confirmed: true.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        work_type: { type: "string", enum: ["installation", "repair", "upgrade", "disconnection"] },
        notes: { type: "string" },
        priority: { type: "string", enum: ["normal", "urgent"], description: "Default: normal" },
        confirmed: { type: "boolean", description: "Must be true -- user confirmed" },
      },
      required: ["account_id", "work_type", "notes", "confirmed"],
    },
  },
  {
    name: "initiate_porting",
    description: "Initiate a phone number portability request. Use when customer wants to port their number from another provider.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        phone_number: { type: "string", description: "Number to port in E.164 format" },
        current_provider: { type: "string" },
        confirmed: { type: "boolean", description: "Must be true" },
      },
      required: ["account_id", "phone_number", "current_provider", "confirmed"],
    },
  },

  // â"€â"€â"€ NOTIFICATIONS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  {
    name: "queue_internal_email",
    description:
      "Queue an internal email to the ops team (support@nivra-telecom.ca). Use for recaps, alerts, " +
      "'remind me about X'. NEVER use this to email a customer -- that's queue_customer_email.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body_text: { type: "string" },
      },
      required: ["subject", "body_text"],
    },
  },
  {
    name: "queue_customer_email",
    description:
      "Queue an email TO A CUSTOMER. Requires explicit user confirmation in the prompt (e.g. " +
      "'envoie-lui un courriel pour lui dire X -- vas-y'). Returns the queue_id so the user can review.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        subject: { type: "string" },
        body_text: { type: "string" },
        confirmed_by_user: {
          type: "boolean",
          description: "Must be true. NOVA should only set this when the user has explicitly approved sending.",
        },
      },
      required: ["account_id", "subject", "body_text", "confirmed_by_user"],
    },
  },

  // â"€â"€â"€ MEMORY â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  {
    name: "remember_for_later",
    description:
      "Persist a long-term memory in nova_memory. Use when the user says 'remember that X' or when " +
      "you discover a recurring fact NOVA should keep across sessions.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        memory_type: {
          type: "string",
          enum: ["business_rule", "customer_pref", "system_fact", "user_pref", "decision"],
        },
        importance: { type: "integer", minimum: 1, maximum: 10 },
      },
      required: ["title", "content", "memory_type"],
    },
  },

  // ─── HUMAN HANDOFF ─────────────────────────────────────────────────────────
  {
    name: "transfer_to_human_agent",
    description:
      "Transfer this conversation to a human support agent when you cannot resolve the issue after 3 attempts " +
      "or when the customer explicitly requests a human. Creates a support ticket with full conversation context " +
      "and sends an email alert to the support team.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why transferring to human" },
        urgency: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Urgency level" },
        summary: { type: "string", description: "Summary of conversation so far including what was attempted" },
      },
      required: ["reason", "summary"],
    },
  },

  // â"€â"€â"€ FRONTEND COMMANDS -- pilot the UI â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  {
    name: "ui_navigate",
    description:
      "Tell the frontend to navigate to a Nivra admin page. Use when the user says 'open client X' or " +
      "'go to the cancellation page'. The frontend listens to this tool result and changes route.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Target path, e.g. '/admin/clients/<uuid>', '/core/agents', '/employee/clients/<uuid>'.",
        },
        in_new_tab: { type: "boolean" },
      },
      required: ["path"],
    },
  },
  {
    name: "ui_open_client_360",
    description:
      "Open the 360 view of a specific client in the Employee portal. Use when the user says " +
      "'show me client X' or 'open Jean Tremblay'.",
    input_schema: {
      type: "object",
      properties: { account_id: { type: "string" } },
      required: ["account_id"],
    },
  },
];

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// TOOL HANDLERS -- actual execution per tool name.
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
async function executeTool(
  supabase: any,
  name: string,
  input: Record<string, unknown>,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    switch (name) {
      case "get_account_state": {
        let accountId = input.account_id as string | undefined;
        if (!accountId && input.account_number) {
          const { data } = await supabase
            .from("accounts")
            .select("id")
            .eq("account_number", input.account_number)
            .maybeSingle();
          accountId = data?.id;
        }
        if (!accountId) return { ok: false, error: "Account not found" };
        const { data, error } = await supabase.rpc("get_account_state", { p_account_id: accountId });
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: data };
      }

      case "search_customers": {
        const q = (input.query as string)?.trim();
        if (!q) return { ok: false, error: "Empty query" };
        const { data, error } = await supabase
          .from("unified_clients")
          .select("user_id, full_name, email, phone, account_id, account_number, account_status")
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,account_number.ilike.%${q}%`)
          .limit(10);
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: data ?? [] };
      }

      case "get_business_metrics": {
        const { data, error } = await supabase.rpc("get_nova_context");
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: data };
      }

      case "queue_internal_email": {
        const subject = input.subject as string;
        const body = input.body_text as string;
        if (!subject || !body) return { ok: false, error: "Missing subject or body" };
        let error: any = null;
        try { await enqueueCommunication({
          channel: "email",
          templateKey: "generic_internal_note",
          recipient: "support@nivra-telecom.ca",
          idempotencyKey: `nova_internal_${Date.now()}`,
          templateVars: { body_text: body, sender: "NOVA Digital Brain" },
          subject: `[NOVA] ${subject}`,
        }); } catch (__e) { error = __e; }
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: { queued: true, subject } };
      }

      case "remember_for_later": {
        const { error } = await supabase.from("nova_memory").insert({
          title: input.title,
          content: input.content,
          memory_type: input.memory_type ?? "system_fact",
          importance: (input.importance as number) ?? 5,
          is_active: true,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: { stored: true } };
      }

      // â"€â"€â"€ READ-ONLY LOOKUPS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
      case "get_customer_payments": {
        const limit = (input.limit as number) ?? 10;
        const accountId = input.account_id as string;
        const { data: account } = await supabase
          .from("accounts").select("client_id").eq("id", accountId).maybeSingle();
        if (!account) return { ok: false, error: "Account not found" };
        const { data: customer } = await supabase
          .from("billing_customers").select("id").eq("user_id", account.client_id).maybeSingle();
        if (!customer) return { ok: true, result: [] };
        const { data, error } = await supabase
          .from("billing_payments")
          .select("id, amount, status, payment_method, processed_at, created_at, invoice_id")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: data ?? [] };
      }

      case "get_customer_invoices": {
        const limit = (input.limit as number) ?? 10;
        const accountId = input.account_id as string;
        const { data: account } = await supabase
          .from("accounts").select("client_id").eq("id", accountId).maybeSingle();
        if (!account) return { ok: false, error: "Account not found" };
        const { data: customer } = await supabase
          .from("billing_customers").select("id").eq("user_id", account.client_id).maybeSingle();
        if (!customer) return { ok: true, result: [] };
        const { data, error } = await supabase
          .from("billing_invoices")
          .select("id, invoice_number, total, balance_due, status, due_date, created_at")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: data ?? [] };
      }

      case "get_customer_subscriptions": {
        const accountId = input.account_id as string;
        const { data: account } = await supabase
          .from("accounts").select("client_id").eq("id", accountId).maybeSingle();
        if (!account) return { ok: false, error: "Account not found" };
        const { data: customer } = await supabase
          .from("billing_customers").select("id").eq("user_id", account.client_id).maybeSingle();
        if (!customer) return { ok: true, result: [] };
        const { data, error } = await supabase
          .from("billing_subscriptions")
          .select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date, next_renewal_at, recurring_setup_status")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false });
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: data ?? [] };
      }

      case "get_open_support_tickets": {
        const limit = (input.limit as number) ?? 10;
        let q = supabase
          .from("support_tickets")
          .select("id, ticket_number, subject, status, priority, created_at, user_id")
          .in("status", ["open", "in_progress", "pending"])
          .order("created_at", { ascending: false })
          .limit(limit);
        if (input.account_id) {
          const { data: account } = await supabase
            .from("accounts").select("client_id").eq("id", input.account_id as string).maybeSingle();
          if (account) q = q.eq("user_id", account.client_id);
        }
        if (input.priority) q = q.eq("priority", input.priority as string);
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: data ?? [] };
      }

      case "get_sla_breaches": {
        const { data, error } = await supabase
          .from("employee_work_items")
          .select("id, item_type, source_reference, client_name, priority, sla_deadline_at, assigned_to_name")
          .eq("sla_status", "breached")
          .order("sla_deadline_at", { ascending: true })
          .limit(20);
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: data ?? [] };
      }

      // â"€â"€â"€ MUTATING ACTIONS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
      case "credit_account": {
        const accountId = input.account_id as string;
        const amount = Number(input.amount);
        const reason = input.reason as string;
        const months = (input.months as number) ?? 1;
        if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Invalid amount" };
        if (amount > 500) return { ok: false, error: "Crédit maximum 500$ CAD par NOVA. Pour un montant supérieur, un admin doit l'appliquer manuellement dans Core." };
        const { data, error } = await supabase
          .from("account_adjustments")
          .insert({
            account_id: accountId,
            type: "credit",
            amount,
            description: `[NOVA] ${reason}`,
            months_total: months,
            months_remaining: months,
            status: "active",
            created_by: "nova-brain",
          })
          .select("id")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: { adjustment_id: data?.id, amount, months } };
      }

      case "suspend_account": {
        if (!input.confirmed) return { ok: false, error: "Confirmation requise. Demandez Ã  l'utilisateur de confirmer explicitement, puis relancez avec confirmed: true." };
        const accountId = input.account_id as string;
        const { error } = await supabase
          .from("accounts")
          .update({ status: "suspended", updated_at: new Date().toISOString() })
          .eq("id", accountId);
        if (error) return { ok: false, error: error.message };
        // Audit row for the suspension
        await writeAccountJournal(supabase, {
          targetTable: "activity_logs",
          payload: {
            entity_type: "account",
            entity_id: accountId,
            action: "suspend",
            actor_name: "NOVA Digital Brain",
            actor_role: "ai_agent",
            details: { reason: input.reason },
          },
          eventKey: `account:${accountId}:nova_suspend:${new Date().toISOString().slice(0,16).replace(/[-:T]/g,"")}`,
          actor: { userId: "00000000-0000-0000-0000-000000000000", role: "ai_agent", name: "NOVA Digital Brain", email: null },
        }).then(() => undefined, () => undefined);
        return { ok: true, result: { suspended: true, account_id: accountId } };
      }

      case "reactivate_account": {
        const accountId = input.account_id as string;
        const { error } = await supabase
          .from("accounts")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", accountId);
        if (error) return { ok: false, error: error.message };
        await supabase.from("activity_logs").insert({
          entity_type: "account",
          entity_id: accountId,
          action: "reactivate",
          actor_name: "NOVA Digital Brain",
          actor_role: "ai_agent",
          details: { reason: input.reason },
        }).then(() => undefined, () => undefined);
        return { ok: true, result: { reactivated: true, account_id: accountId } };
      }

      case "trigger_cancellation": {
        if (!input.confirmed) return { ok: false, error: "Confirmation requise. Demandez Ã  l'utilisateur de confirmer explicitement l'annulation, puis relancez avec confirmed: true." };
        // Delegate to the cancel-account orchestrator built earlier -- atomic + audited.
        const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-account`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            account_id: input.account_id,
            scope: input.scope,
            reason: `[NOVA] ${input.reason}`,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? `cancel-account ${res.status}` };
        return { ok: true, result: data };
      }

      case "create_support_ticket": {
        const accountId = input.account_id as string;
        const { data: account } = await supabase
          .from("accounts").select("client_id").eq("id", accountId).maybeSingle();
        const userId = account?.client_id;
        if (!userId) return { ok: false, error: "Account / client not found" };
        const { data, error } = await supabase
          .from("support_tickets")
          .insert({
            user_id: userId,
            subject: input.subject,
            body: input.body,
            priority: (input.priority as string) ?? "normal",
            category: (input.category as string) ?? "general",
            status: "open",
            created_by_name: "NOVA Digital Brain",
          })
          .select("id, ticket_number")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: data };
      }

      case "create_work_order": {
        if (!input.confirmed) return { ok: false, error: "Confirmation requise pour créer un ordre de travail." };
        const { data, error } = await supabase.from("work_orders").insert({
          account_id: input.account_id as string,
          work_type: input.work_type as string,
          notes: input.notes as string,
          priority: (input.priority as string) || "normal",
          status: "pending",
          created_by: "nova-brain",
          created_at: new Date().toISOString(),
        }).select("id").maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: { work_order_id: data?.id } };
      }

      case "initiate_porting": {
        if (!input.confirmed) return { ok: false, error: "Confirmation requise pour initier un porting." };
        const { data, error } = await supabase.from("porting_requests").insert({
          account_id: input.account_id as string,
          phone_number: input.phone_number as string,
          current_provider: input.current_provider as string,
          status: "initiated",
          created_by: "nova-brain",
          created_at: new Date().toISOString(),
        }).select("id").maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: { porting_request_id: data?.id } };
      }

      // â"€â"€â"€ CUSTOMER EMAIL (must be confirmed by user) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
      case "queue_customer_email": {
        if (input.confirmed_by_user !== true) {
          return {
            ok: false,
            error: "Refused: customer email requires explicit user confirmation. Ask the user to say 'envoie' or 'confirm' before retrying with confirmed_by_user=true.",
          };
        }
        const accountId = input.account_id as string;
        const { data: account } = await supabase
          .from("accounts").select("client_id").eq("id", accountId).maybeSingle();
        const { data: profile } = await supabase
          .from("profiles").select("email, full_name").eq("user_id", account?.client_id).maybeSingle();
        if (!profile?.email) return { ok: false, error: "Customer has no email on file" };

        let error: any = null;
        try { await enqueueCommunication({
          channel: "email",
          templateKey: "generic_customer_message",
          recipient: profile.email,
          idempotencyKey: `nova_customer_${Date.now()}`,
          templateVars: {
              client_name: profile.full_name ?? "Client",
              body_text: input.body_text,
              sender: "NOVA via " + (account?.client_id ?? "system"),
            },
          subject: input.subject,
        }); } catch (__e) { error = __e; }
          .select("id")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, result: { queue_id: data?.id, to: profile.email } };
      }

      // ─── HUMAN HANDOFF ────────────────────────────────────────────────────
      case "transfer_to_human_agent": {
        const reason = input.reason as string;
        const urgency = (input.urgency as string) ?? "medium";
        const summary = input.summary as string;

        // Create support ticket
        const { data: ticket, error: ticketErr } = await supabase
          .from("support_tickets")
          .insert({
            subject: `[NOVA Handoff] ${reason}`,
            body: `Résumé NOVA:\n${summary}\n\nRaison du transfert: ${reason}\nUrgence: ${urgency}`,
            priority: urgency === "critical" ? "urgent" : urgency === "high" ? "high" : urgency === "medium" ? "normal" : "low",
            category: "nova_handoff",
            status: "open",
            created_by_name: "NOVA Digital Brain",
          })
          .select("id, ticket_number")
          .maybeSingle();

        if (ticketErr) {
          console.error("[nova-brain] transfer_to_human_agent ticket creation failed:", ticketErr);
        }

        // Send email alert to support team
        await enqueueCommunication({
          channel: "email",
          templateKey: "generic_internal_note",
          recipient: "support@nivra-telecom.ca",
          idempotencyKey: `nova_handoff_${Date.now()}`,
          templateVars: {
            body_text: `NOVA a transféré une conversation vers un agent humain.\n\nTicket: ${ticket?.ticket_number ?? "—"}\nUrgence: ${urgency}\nRaison: ${reason}\n\nRésumé:\n${summary}`,
            sender: "NOVA Digital Brain",
          },
          subject: `[NOVA Handoff] ${urgency.toUpperCase()} — ${reason}`,
        }).then(() => undefined, () => undefined);

        return {
          ok: true,
          result: {
            transferred: true,
            ticket_id: ticket?.id,
            ticket_number: ticket?.ticket_number,
            message: "Je vous transfère maintenant vers un agent. Un membre de notre équipe vous contactera sous peu.",
          },
        };
      }

      // â"€â"€â"€ FRONTEND COMMANDS -- the UI listens for these in the response â"€â"€
      case "ui_navigate": {
        return {
          ok: true,
          result: {
            frontend_action: "navigate",
            path: input.path,
            in_new_tab: input.in_new_tab === true,
          },
        };
      }

      case "ui_open_client_360": {
        return {
          ok: true,
          result: {
            frontend_action: "open_client_360",
            account_id: input.account_id,
            path: `/employee/clients/${input.account_id}`,
          },
        };
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth gate: nova-brain is internal -- require service role or AGENT_SECRET
  const _nb_auth = req.headers.get("Authorization") ?? "";
  const _nb_secret = Deno.env.get("AGENT_SECRET");
  if (_nb_auth !== `Bearer ${SERVICE_KEY}` && (!_nb_secret || _nb_auth !== `Bearer ${_nb_secret}`)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("[nova-brain] ANTHROPIC_API_KEY missing");
    return new Response(
      JSON.stringify({ error: "configuration_error", detail: "NOVA n'est pas configuré. Contactez l'administrateur." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();
  const toolCalls: Array<{ name: string; input: unknown; output: unknown; ok: boolean }> = [];
  let reasoningLogId: string | null = null;

  try {
    const body = await req.json();
    const messages = body.messages || [];
    const conversationId: string | null = body.conversation_id ?? null;
    const enableTools: boolean = body.enable_tools !== false;

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          content: "Bonjour ! Je suis NOVA, le Digital Brain de Nivra Telecom. Comment puis-je vous aider ?",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    // Build system prompt with cached memory + real-time context.
    // The 'cache_control: ephemeral' marker tells Anthropic to cache
    // the prefix for 5 min so multi-turn conversations are fast & cheap.
    // â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    const [{ data: contextData }, { data: memories }] = await Promise.all([
      supabase.rpc("get_nova_context"),
      supabase
        .from("nova_memory")
        .select("title, content, memory_type")
        .eq("is_active", true)
        .order("importance", { ascending: false })
        .limit(15),
    ]);

    const memoryText = (memories || [])
      .map((m: any) => `* [${m.memory_type}] ${m.title}: ${m.content}`)
      .join("\n");

    const baseSystem = `Tu es NOVA, le Digital Brain de Nivra Telecom.
Tu es le co-fondateur IA de l'équipe.

PERSONNALITÉ:
- Tu penses comme un CEO de télécoms expérimenté.
- Tu parles directement, sans bullshit. Réponses courtes quand possible, longues quand nécessaire.
- Tu proposes TOUJOURS 2-3 actions concrètes après chaque analyse.
- Tu utilises les outils Ã  ta disposition au lieu de spéculer.
- Tu réponds en français québécois professionnel par défaut (sauf si on te parle en anglais).
- Jamais de réponses génériques type "Comment puis-je vous aider ?". Va droit au but.

OUTILS DISPONIBLES:
Tu as accès Ã  des outils (get_account_state, search_customers, get_business_metrics,
queue_internal_email, remember_for_later). Utilise-les dès que ça aide. Quand quelqu'un
te demande l'état d'un client, NE devine PAS -- appelle get_account_state.

RÃˆGLES STRICTES:
- Jamais de chiffres inventés. Si tu ne sais pas, dis-le et appelle un outil.
- Pour envoyer un email Ã  un CLIENT (pas l'équipe interne), refuse et demande approbation humaine.
- Pour suspendre / annuler un compte, refuse de le faire toi-même -- c'est une action admin.
- Après 3 tentatives infructueuses de résoudre un problème client, utilise PROACTIVEMENT l'outil transfer_to_human_agent.
- Si un client demande explicitement à parler à un humain, utilise IMMÉDIATEMENT transfer_to_human_agent sans hésiter.`;

    const contextSection = `\n\nDONNÉES NIVRA EN TEMPS RÉEL:\n${JSON.stringify(contextData || {}, null, 2)}`;
    const memorySection = memoryText ? `\n\nMÉMOIRE LONG-TERME:\n${memoryText}` : "";

    // System prompt as a list so we can mark the cacheable prefix.
    const systemPrompt = [
      {
        type: "text",
        text: baseSystem + memorySection,
        // Cache the personality + memory -- stable across turns.
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        // Real-time context is NOT cached (changes every call).
        text: contextSection,
      },
    ];

    const client = new Anthropic({ apiKey });

    // â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    // AGENTIC LOOP -- Claude may want to call tools, then think again.
    // We loop up to MAX_TOOL_ITERATIONS times until it returns a final text.
    // â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    let conversationMessages = [...messages];
    let finalText = "";
    let totalUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    };

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response: any = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt as any,
        messages: conversationMessages,
        tools: enableTools ? (TOOLS as any) : undefined,
      });

      // Accumulate token usage across iterations.
      const u = response.usage ?? {};
      totalUsage.input_tokens += u.input_tokens ?? 0;
      totalUsage.output_tokens += u.output_tokens ?? 0;
      totalUsage.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
      totalUsage.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;

      const blocks = response.content ?? [];
      const toolUseBlocks = blocks.filter((b: any) => b.type === "tool_use");
      const textBlocks = blocks.filter((b: any) => b.type === "text");

      // If no tools requested, we have our final answer.
      if (toolUseBlocks.length === 0) {
        finalText = textBlocks.map((b: any) => b.text).join("\n").trim();
        break;
      }

      // Echo the assistant turn back into the conversation, then execute
      // each tool and append the results as a tool_result message.
      conversationMessages.push({ role: "assistant", content: blocks });
      const toolResults = [];
      for (const tu of toolUseBlocks) {
        const exec = await executeTool(supabase, tu.name, tu.input ?? {});
        toolCalls.push({
          name: tu.name,
          input: tu.input,
          output: exec.result ?? exec.error,
          ok: exec.ok,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(exec.ok ? exec.result : { error: exec.error }),
          is_error: !exec.ok,
        });
      }
      conversationMessages.push({ role: "user", content: toolResults });
    }

    // If we ran out of iterations without a final text, surface that explicitly.
    if (!finalText) {
      finalText = "Je n'ai pas pu finaliser ma réponse après plusieurs tentatives. Reformule ta demande ou contacte le support.";
    }

    const durationMs = Date.now() - startedAt;

    // â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    // AUDIT TRAIL -- nova_reasoning_log (granular) + agent_audit_log (rollup)
    // â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    try {
      const { data: logRow } = await supabase
        .from("nova_reasoning_log")
        .insert({
          conversation_id: conversationId,
          model: MODEL,
          input_messages: messages,
          output_text: finalText,
          tools_called: toolCalls,
          usage: totalUsage,
          duration_ms: durationMs,
        })
        .select("id")
        .maybeSingle();
      reasoningLogId = logRow?.id ?? null;
    } catch (logErr) {
      // The table may not have this exact shape -- log to console but don't fail.
      console.warn("[nova-brain] reasoning_log insert failed:", logErr);
    }

    await supabase.from("agent_audit_log").insert({
      agent_name: AGENT,
      action: "respond",
      result: "success",
      execution_time_ms: durationMs,
      details: {
        model: MODEL,
        message_count: messages.length,
        tool_calls: toolCalls.length,
        tools_used: toolCalls.map((t) => t.name),
        usage: totalUsage,
        cache_hit: (totalUsage.cache_read_input_tokens ?? 0) > 0,
      },
    }).then(() => undefined, () => undefined);

    return new Response(
      JSON.stringify({
        content: finalText,
        tool_calls: toolCalls,
        usage: totalUsage,
        reasoning_log_id: reasoningLogId,
        duration_ms: durationMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[nova-brain] error:", error);
    reportEdgeError(error, { function: AGENT, tool_calls: toolCalls }).catch(() => {});

    // Log failure for audit
    await supabase.from("agent_audit_log").insert({
      agent_name: AGENT,
      action: "respond",
      result: "failure",
      error_message: error?.message ?? String(error),
      execution_time_ms: Date.now() - startedAt,
      details: { tools_called: toolCalls },
    }).then(() => undefined, () => undefined);

    return new Response(
      JSON.stringify({
        error: "nova_error",
        detail: error?.message ?? "Une erreur est survenue.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
