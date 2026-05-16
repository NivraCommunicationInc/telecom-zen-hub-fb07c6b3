// Temporary audit function — generates contract+invoice+receipt+summary
// PDFs for a given order_number and returns them as base64.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildInvoicePdfAttachment,
  buildContractPdfAttachment,
  buildReceiptPdfAttachment,
  buildSummaryPdfAttachment,
} from "../_shared/pdfFromDb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { order_number } = await req.json();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: order } = await sb.from("orders").select("id").eq("order_number", order_number).maybeSingle();
  if (!order) return new Response(JSON.stringify({ error: "order not found" }), { status: 404, headers: corsHeaders });
  const { data: inv } = await sb.from("billing_invoices").select("id").eq("order_id", order.id).maybeSingle();

  const [contract, invoice, receipt, summary] = await Promise.all([
    buildContractPdfAttachment(order.id),
    inv ? buildInvoicePdfAttachment(inv.id) : Promise.resolve(null),
    inv ? buildReceiptPdfAttachment(inv.id) : Promise.resolve(null),
    buildSummaryPdfAttachment(order.id),
  ]);
  return new Response(JSON.stringify({ contract, invoice, receipt, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
