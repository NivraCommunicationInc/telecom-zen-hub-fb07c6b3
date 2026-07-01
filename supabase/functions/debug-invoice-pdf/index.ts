// Debug: return invoice PDF as base64 given invoice_id
import { buildInvoicePdfAttachment } from "../_shared/pdfFromDb.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { invoice_id } = await req.json();
    const att = await buildInvoicePdfAttachment(invoice_id);
    if (!att) return new Response(JSON.stringify({ error: "no attachment" }), { status: 404, headers: cors });
    return new Response(JSON.stringify(att), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: cors });
  }
});
