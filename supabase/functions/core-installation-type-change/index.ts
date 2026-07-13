// ============================================================
// core-installation-type-change
//   Change a manual order's installation type between "technician"
//   and "auto" (self-install). Handles fee delta automatically:
//     • unpaid invoice  → adjusts invoice + order_items in place
//     • paid invoice    → issues a compte credit via account_adjustments
//   Updates orders.fulfillment_type / installation_type and syncs the
//   linked appointment (cancels it on switch to auto; creates a placeholder
//   note when switching to technician without an existing appointment).
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  order_id: string;
  new_type: "auto" | "technician";
  reason: string;
  installation_fee?: number; // used when re-adding fee for tech (defaults to 50)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as Body;
    if (!body.order_id || !body.new_type || !body.reason?.trim()) {
      return json({ error: "order_id, new_type and reason are required" }, 400);
    }
    if (!["auto", "technician"].includes(body.new_type)) {
      return json({ error: "new_type must be 'auto' or 'technician'" }, 400);
    }

    const authUser = await getUser(req);
    const actorId = authUser?.id ?? null;

    // 1) Load order + linked pieces
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, account_id, user_id, fulfillment_type, installation_type, total, service_address, service_city, service_postal_code")
      .eq("id", body.order_id)
      .maybeSingle();
    if (orderErr || !order) return json({ error: "Order not found" }, 404);

    const currentType = String(order.fulfillment_type || order.installation_type || "").toLowerCase();
    const currentIsAuto = currentType === "auto" || currentType === "self_install";
    if ((body.new_type === "auto" && currentIsAuto) || (body.new_type === "technician" && !currentIsAuto && currentType)) {
      return json({ error: "L'ordre a déjà ce type d'installation" }, 400);
    }

    // 2) Locate installation fee line(s) on the order
    const { data: items } = await supabase
      .from("order_items")
      .select("id, plan_name, description, unit_price, quantity, line_total")
      .eq("order_id", body.order_id);
    const installLines = (items || []).filter((it: any) => {
      const s = `${it.plan_name || ""} ${it.description || ""}`.toLowerCase();
      return s.includes("install");
    });
    const installFeePaid = installLines.reduce(
      (sum: number, l: any) => sum + Number(l.line_total ?? (Number(l.unit_price) * Number(l.quantity || 1)) ?? 0),
      0,
    );
    const feeParam = Number(body.installation_fee ?? 50);

    // 3) Delta accounting
    const { data: invoices } = await supabase
      .from("billing_invoices")
      .select("id, status, total, amount_paid, paid_at")
      .eq("order_id", body.order_id)
      .order("created_at", { ascending: false });
    const unpaidInvoice = (invoices || []).find(
      (inv: any) => inv.status !== "paid" && inv.status !== "void" && Number(inv.amount_paid || 0) === 0,
    );

    let creditIssued = 0;
    let invoiceAdjusted: string | null = null;
    let chargeAdded = 0;

    if (body.new_type === "auto") {
      // Switching to auto → remove installation fee (delta = installFeePaid)
      if (installFeePaid > 0) {
        if (unpaidInvoice) {
          // Adjust invoice total downward and delete/zero the install lines
          const newTotal = Math.max(0, Number(unpaidInvoice.total) - installFeePaid);
          await supabase.from("billing_invoices").update({ total: newTotal }).eq("id", unpaidInvoice.id);
          if (installLines.length) {
            await supabase.from("order_items").delete().in("id", installLines.map((l: any) => l.id));
          }
          invoiceAdjusted = unpaidInvoice.id;
        } else {
          // Fee was already paid → issue credit on account
          const { error: adjErr } = await supabase.from("account_adjustments").insert({
            account_id: order.account_id,
            type: "credit",
            amount: installFeePaid,
            description: `Crédit — passage installation technicien → auto-installation. Commande ${order.id.slice(0, 8)}. Motif: ${body.reason.trim()}`,
            status: "active",
            is_permanent: false,
            applies_to: "next_invoice",
            created_by: actorId,
            idempotency_key: `install-swap-auto:${order.id}`,
            metadata: { order_id: order.id, source: "installation_type_change", original_fee: installFeePaid },
          } as any);
          if (adjErr && !String(adjErr.message).includes("duplicate")) throw adjErr;
          creditIssued = installFeePaid;
        }
      }
    } else {
      // Switching to technician → add fee
      if (unpaidInvoice) {
        const newTotal = Number(unpaidInvoice.total) + feeParam;
        await supabase.from("billing_invoices").update({ total: newTotal }).eq("id", unpaidInvoice.id);
        await supabase.from("order_items").insert({
          order_id: body.order_id,
          plan_name: "Installation technicien",
          description: "Installation technicien (ajouté suite au changement de type)",
          unit_price: feeParam,
          quantity: 1,
          line_total: feeParam,
          service_type: "installation",
          is_recurring: false,
        } as any);
        invoiceAdjusted = unpaidInvoice.id;
        chargeAdded = feeParam;
      } else {
        // No unpaid invoice → book fee as pending charge on account
        await supabase.from("account_adjustments").insert({
          account_id: order.account_id,
          type: "fee",
          amount: feeParam,
          description: `Frais — passage auto-installation → installation technicien. Commande ${order.id.slice(0, 8)}. Motif: ${body.reason.trim()}`,
          status: "active",
          is_permanent: false,
          applies_to: "next_invoice",
          created_by: actorId,
          idempotency_key: `install-swap-tech:${order.id}`,
          metadata: { order_id: order.id, source: "installation_type_change", fee: feeParam },
        } as any);
        chargeAdded = feeParam;
      }
    }

    // 4) Update order flags
    await supabase
      .from("orders")
      .update({
        fulfillment_type: body.new_type === "auto" ? "self_install" : "technician",
        installation_type: body.new_type,
      } as any)
      .eq("id", body.order_id);

    // 5) Sync appointment
    const { data: appt } = await supabase
      .from("appointments")
      .select("id")
      .eq("order_id", body.order_id)
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (appt?.id) {
      if (body.new_type === "auto") {
        await supabase.from("appointments").update({
          status: "cancelled",
          installation_method: "auto",
          cancellation_reason: `Changement de type: ${body.reason.trim()}`,
          updated_at: new Date().toISOString(),
        } as any).eq("id", appt.id);
      } else {
        await supabase.from("appointments").update({
          installation_method: "technician",
          updated_at: new Date().toISOString(),
        } as any).eq("id", appt.id);
      }
    }

    // 6) Audit note
    await supabase.from("order_internal_notes").insert({
      order_id: body.order_id,
      author_id: actorId,
      content: `[Type d'installation] Changé vers **${body.new_type}**. Motif: ${body.reason.trim()}. ${
        creditIssued > 0 ? `Crédit émis: ${creditIssued.toFixed(2)} $.` : ""
      }${invoiceAdjusted ? ` Facture ajustée: ${invoiceAdjusted.slice(0, 8)}.` : ""}${
        chargeAdded > 0 ? ` Frais ajouté: ${chargeAdded.toFixed(2)} $.` : ""
      }`,
      is_pinned: false,
    } as any).then(() => undefined, () => undefined);

    return json({
      ok: true,
      new_type: body.new_type,
      credit_issued: creditIssued,
      invoice_adjusted: invoiceAdjusted,
      charge_added: chargeAdded,
    });
  } catch (e) {
    console.error("[core-installation-type-change] error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data } = await supabase.auth.getUser();
  return data.user;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
