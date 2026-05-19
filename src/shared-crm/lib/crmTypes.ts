/**
 * Shared CRM types for the Outbound Call Center.
 * Used by Field, OneView CS (Employee), and Core portals.
 */

export type CrmCallStatus =
  | "not_called"
  | "in_progress"
  | "called"
  | "no_answer"
  | "message_left"
  | "not_interested"
  | "do_not_call"
  | "sold"
  | "callback";

export type CrmCallOutcome =
  | "sold"
  | "voicemail"
  | "callback"
  | "not_interested"
  | "wrong_number"
  | "no_answer";

export interface CrmContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  desired_install_date: string | null;
  service_address: string | null;
  service_city: string | null;
  service_postal_code: string | null;
  call_status: CrmCallStatus | null;
  call_attempts: number | null;
  last_called_at: string | null;
  last_called_by: string | null;
  call_notes: string | null;
  callback_scheduled_at: string | null;
  next_callback_at: string | null;
  is_locked: boolean | null;
  locked_by: string | null;
  locked_by_name: string | null;
  locked_at: string | null;
  locked_until: string | null;
  assigned_to: string | null;
  converted_to_user_id: string | null;
  converted_order_id: string | null;
  priority: number | null;
  territory: string | null;
  source: string | null;
  status: string;
  created_at: string;
}

export interface CrmCallLog {
  id: string;
  contact_id: string;
  agent_id: string;
  agent_name: string | null;
  agent_portal: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  outcome: CrmCallOutcome | "in_progress";
  notes: string | null;
  callback_at: string | null;
  order_id: string | null;
  created_at: string;
}

export interface CrmLeaderboardEntry {
  agent_id: string;
  agent_name: string | null;
  calls_today: number;
  calls_week: number;
  calls_month: number;
  sales_today: number;
  sales_week: number;
  sales_month: number;
  conversion_rate_today: number;
}

export const CALL_STATUS_META: Record<string, { label: string; cls: string }> = {
  not_called:     { label: "À appeler",      cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" },
  in_progress:    { label: "🔴 En appel",    cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 animate-pulse" },
  called:         { label: "Appelé",         cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  no_answer:      { label: "Pas de réponse", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  message_left:   { label: "Message laissé", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  callback:       { label: "Rappel prévu",   cls: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30" },
  not_interested: { label: "Pas intéressé",  cls: "bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-500/30" },
  do_not_call:    { label: "Ne pas rappeler",cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40" },
  sold:           { label: "🟢 Vendu",       cls: "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 font-bold" },
};

export const OUTCOME_META: Record<CrmCallOutcome, { label: string; emoji: string; cls: string }> = {
  sold:           { label: "Vendu",         emoji: "🟢", cls: "bg-emerald-600 hover:bg-emerald-500 text-white" },
  voicemail:      { label: "Message laissé",emoji: "📞", cls: "bg-blue-600 hover:bg-blue-500 text-white" },
  callback:       { label: "Rappeler",      emoji: "🔄", cls: "bg-cyan-600 hover:bg-cyan-500 text-white" },
  no_answer:      { label: "Pas de réponse",emoji: "📵", cls: "bg-amber-600 hover:bg-amber-500 text-white" },
  not_interested: { label: "Pas intéressé", emoji: "❌", cls: "bg-gray-600 hover:bg-gray-500 text-white" },
  wrong_number:   { label: "Faux numéro",   emoji: "🚫", cls: "bg-rose-600 hover:bg-rose-500 text-white" },
};

/** Business hours check — 9h-20h Québec time (America/Toronto). */
export function isWithinBusinessHours(now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(fmt.format(now), 10);
  return hour >= 9 && hour < 20;
}

export function displayName(c: Pick<CrmContact, "full_name" | "first_name" | "last_name" | "email" | "phone">): string {
  return (
    c.full_name?.trim() ||
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    c.email ||
    c.phone ||
    "Sans nom"
  );
}
