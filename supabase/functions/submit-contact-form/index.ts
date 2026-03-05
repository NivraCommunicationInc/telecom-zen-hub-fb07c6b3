import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ContactFormPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  preferredContact?: string;
  consentGiven: boolean;
  pageUrl?: string;
  addressStreet?: string;
  addressApartment?: string;
  addressCity?: string;
  addressProvince?: string;
  addressPostalCode?: string;
}

function validatePayload(body: unknown): { valid: true; data: ContactFormPayload } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const b = body as Record<string, unknown>;

  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const message = typeof b.message === "string" ? b.message.trim() : "";
  const consentGiven = b.consentGiven === true;

  if (!firstName || firstName.length > 50) {
    return { valid: false, error: "firstName is required (max 50 chars)" };
  }
  if (!lastName || lastName.length > 50) {
    return { valid: false, error: "lastName is required (max 50 chars)" };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: "Valid email is required" };
  }
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length !== 10) {
    return { valid: false, error: "Phone must be 10 digits" };
  }
  if (!subject) {
    return { valid: false, error: "subject is required" };
  }
  if (!message || message.length < 10 || message.length > 2000) {
    return { valid: false, error: "message must be 10-2000 characters" };
  }
  if (!consentGiven) {
    return { valid: false, error: "consentGiven must be true" };
  }

  return {
    valid: true,
    data: {
      firstName,
      lastName,
      email,
      phone,
      subject,
      message,
      preferredContact: typeof b.preferredContact === "string" ? b.preferredContact : "email",
      consentGiven: true,
      pageUrl: typeof b.pageUrl === "string" ? b.pageUrl : undefined,
      addressStreet: typeof b.addressStreet === "string" ? b.addressStreet : undefined,
      addressApartment: typeof b.addressApartment === "string" ? b.addressApartment : undefined,
      addressCity: typeof b.addressCity === "string" ? b.addressCity : undefined,
      addressProvince: typeof b.addressProvince === "string" ? b.addressProvince : undefined,
      addressPostalCode: typeof b.addressPostalCode === "string" ? b.addressPostalCode : undefined,
    },
  };
}

function generateTicketNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WEB-${y}${m}${d}-${rand}`;
}

function generateRequestNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REQ-${y}${m}${d}-${rand}`;
}

Deno.serve(async (req) => {
  // Handle preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Rate limit: 10 submissions per minute per IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = await checkRateLimit({ key: `contact_form:${clientIp}`, maxAttempts: 10, windowMs: 60_000 });
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders, "fr");
    }

    const body = await req.json();
    const validation = validatePayload(body);

    if (!validation.valid) {
      return new Response(JSON.stringify({ ok: false, error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = validation.data;
    const userAgent = req.headers.get("user-agent") || "unknown";
    const submittedAt = new Date().toISOString();

    // Create service role client for server-side writes
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[submit-contact-form] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ ok: false, error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const ticketNumber = generateTicketNumber();
    const requestNumber = generateRequestNumber();

    // Build ticket description with all contact info
    const ticketDescription = `
**FORMULAIRE WEB — Contact Public**

**Nom complet:** ${fullName}
**Courriel:** ${data.email}
**Téléphone:** ${data.phone}
**Sujet sélectionné:** ${data.subject}
**Méthode de contact préférée:** ${data.preferredContact || "email"}

**Message:**
${data.message}

---
**Métadonnées:**
- Page URL: ${data.pageUrl || "N/A"}
- Submitted at: ${submittedAt}
- User Agent: ${userAgent}
${data.addressStreet ? `- Adresse: ${data.addressStreet}${data.addressApartment ? `, ${data.addressApartment}` : ""}, ${data.addressCity || ""}, ${data.addressProvince || "QC"} ${data.addressPostalCode || ""}` : ""}
`.trim();

    // 1) Insert into support_tickets (admin ticket)
    // Use a system UUID for user_id and owner_user_id since this is a public form
    const systemUserId = "00000000-0000-0000-0000-000000000000";

    const { data: ticketData, error: ticketError } = await supabase
      .from("support_tickets")
      .insert({
        user_id: systemUserId,
        owner_user_id: systemUserId,
        subject: `FORMULAIRE WEB — ${fullName}`,
        description: ticketDescription,
        status: "open",
        priority: "normal",
        category: "web_form",
        client_email: data.email,
        ticket_number: ticketNumber,
        created_by_role: "public",
      })
      .select("id, ticket_number")
      .single();

    if (ticketError) {
      console.error("[submit-contact-form] Error inserting ticket:", ticketError);
      return new Response(JSON.stringify({ ok: false, error: "Failed to create ticket" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Also insert into contact_requests for legacy tracking
    const { error: contactError } = await supabase.from("contact_requests").insert({
      name: fullName,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      notes: data.message,
      preferred_contact: data.preferredContact || "email",
      status: "new",
      consent_given: true,
      page_url: data.pageUrl || null,
      address_street: data.addressStreet || null,
      address_apartment: data.addressApartment || null,
      address_city: data.addressCity || null,
      address_province: data.addressProvince || "QC",
      address_postal_code: data.addressPostalCode || null,
      source: "website_contact",
      request_number: requestNumber,
    });

    if (contactError) {
      // Log but don't fail - ticket was already created
      console.warn("[submit-contact-form] Warning: contact_requests insert failed:", contactError);
    }

    console.log(`[submit-contact-form] Success: ticket=${ticketData.ticket_number}, request=${requestNumber}`);

    return new Response(
      JSON.stringify({
        ok: true,
        ticket_id: ticketData.id,
        ticket_number: ticketData.ticket_number,
        request_number: requestNumber,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[submit-contact-form] Unexpected error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
