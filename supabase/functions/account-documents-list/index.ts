// account-documents-list — Phase 11
// Staff-only aggregator of all documents tied to a client/account.
// Returns contracts, auto-generated docs (invoices/receipts), uploaded docs,
// and order documents — with signed URLs for storage_path entries.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  client_user_id: string;
  account_id?: string | null;
}

interface DocItem {
  id: string;
  source: "contract" | "auto" | "uploaded" | "order" | "invoice" | "receipt" | "quote";
  category: string;
  name: string;
  number?: string | null;
  created_at: string;
  url: string | null;
  signed: boolean;
  size_bytes?: number | null;
  metadata?: Record<string, any> | null;
}

const STORAGE_BUCKETS = ["client-documents", "contracts", "invoices", "receipts", "order-documents"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Staff role check via has_staff_role helper
    const { data: isStaff } = await admin.rpc("has_staff_role", {
      _user_id: userData.user.id,
    });
    if (isStaff !== true) {
      return json({ error: "forbidden" }, 403);
    }

    const body = (await req.json()) as Body;
    if (!body?.client_user_id) return json({ error: "client_user_id required" }, 400);

    const clientId = body.client_user_id;

    // Parallel fetches — include monthly_invoices, billing_invoices, payments (receipts), quotes
    const [contractsRes, autoRes, uploadedRes, ordersRes, monthlyInvRes, paymentsRes, quotesRes] = await Promise.all([
      admin
        .from("contracts")
        .select("id, contract_number, contract_name, status, contract_pdf_url, contract_url, created_at, signed_at, version")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("client_auto_documents")
        .select("id, doc_type, doc_number, storage_path, file_size_bytes, event_type, created_at, metadata, recipient_email")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("client_documents")
        .select("id, document_type, document_name, document_url, created_at")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("orders")
        .select("id, order_number, status, total_amount, created_at")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("monthly_invoices")
        .select("id, invoice_number, status, total, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("payments")
        .select("id, amount, payment_method, status, created_at, account_id")
        .eq("user_id", clientId)
        .in("status", ["completed", "succeeded", "captured", "paid"])
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("quotes")
        .select("id, quote_number, status, total_due_now, created_at")
        .eq("customer_user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const items: DocItem[] = [];

    for (const c of contractsRes.data ?? []) {
      items.push({
        id: c.id,
        source: "contract",
        category: "Contrat",
        name: c.contract_name || `Contrat ${c.contract_number ?? ""}`.trim(),
        number: c.contract_number,
        created_at: c.created_at,
        url: c.contract_pdf_url || c.contract_url || null,
        signed: false,
        metadata: { status: c.status, signed_at: c.signed_at, version: c.version },
      });
    }

    // Sign storage paths for auto-docs
    const autoSignTasks = (autoRes.data ?? []).map(async (d) => {
      let url: string | null = null;
      let signed = false;
      if (d.storage_path) {
        // Path might be "bucket/key" or just "key". Try common buckets.
        const parsed = parseStoragePath(d.storage_path);
        const { data: signedData } = await admin.storage
          .from(parsed.bucket)
          .createSignedUrl(parsed.key, 60 * 5);
        if (signedData?.signedUrl) {
          url = signedData.signedUrl;
          signed = true;
        }
      }
      items.push({
        id: d.id,
        source: "auto",
        category: humanizeDocType(d.doc_type),
        name: `${humanizeDocType(d.doc_type)} ${d.doc_number ?? ""}`.trim(),
        number: d.doc_number,
        created_at: d.created_at,
        url,
        signed,
        size_bytes: d.file_size_bytes,
        metadata: { event_type: d.event_type, recipient_email: d.recipient_email, ...(d.metadata as any) },
      });
    });
    await Promise.all(autoSignTasks);

    for (const u of uploadedRes.data ?? []) {
      items.push({
        id: u.id,
        source: "uploaded",
        category: humanizeDocType(u.document_type) || "Document",
        name: u.document_name || "Document",
        created_at: u.created_at,
        url: u.document_url,
        signed: false,
      });
    }

    // Order documents
    const orderIds = (ordersRes.data ?? []).map((o) => o.id);
    if (orderIds.length > 0) {
      const { data: orderDocs } = await admin
        .from("order_documents")
        .select("id, order_id, doc_type, file_name, file_size, pdf_url, generated_at, version")
        .in("order_id", orderIds)
        .order("generated_at", { ascending: false })
        .limit(200);
      for (const od of orderDocs ?? []) {
        items.push({
          id: od.id,
          source: "order",
          category: humanizeDocType(od.doc_type),
          name: od.file_name || `${humanizeDocType(od.doc_type)} (commande)`,
          created_at: od.generated_at,
          url: od.pdf_url,
          signed: false,
          size_bytes: od.file_size,
          metadata: { order_id: od.order_id, version: od.version },
        });
      }
    }

    items.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    return json({ ok: true, items, total: items.length });
  } catch (e) {
    console.error("account-documents-list error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function parseStoragePath(path: string): { bucket: string; key: string } {
  // If first segment matches a known bucket, split. Otherwise default to client-documents.
  const segs = path.split("/");
  if (segs.length > 1 && STORAGE_BUCKETS.includes(segs[0])) {
    return { bucket: segs[0], key: segs.slice(1).join("/") };
  }
  return { bucket: "client-documents", key: path };
}

function humanizeDocType(t: string | null | undefined): string {
  if (!t) return "Document";
  const map: Record<string, string> = {
    invoice: "Facture",
    receipt: "Reçu",
    contract: "Contrat",
    quote: "Devis",
    kyc: "Document KYC",
    id_front: "Pièce d'identité (recto)",
    id_back: "Pièce d'identité (verso)",
    selfie: "Selfie de vérification",
    proof_of_address: "Preuve de résidence",
    order_summary: "Récapitulatif commande",
    refund: "Remboursement",
  };
  return map[t] || t.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
