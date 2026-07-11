/**
 * Public account-transfer confirmation page — Module 48
 * Route: /account-transfer/confirm?token=...&party=old|new
 * No auth required — token acts as capability.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function AccountTransferConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const party = params.get("party") ?? "";
  const [status, setStatus] = useState<"idle" | "loading" | "confirmed" | "rejected" | "error">("idle");
  const [msg, setMsg] = useState("");

  const call = async (action: "approve" | "reject") => {
    setStatus("loading");
    try {
      const efAction = action === "reject"
        ? "reject_transfer"
        : party === "old" ? "approve_old_owner" : "approve_new_owner";
      const { data, error } = await supabase.functions.invoke("account-transfer-actions", {
        body: { action: efAction, token },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setStatus(action === "reject" ? "rejected" : "confirmed");
    } catch (e: any) {
      setStatus("error");
      setMsg(e.message ?? String(e));
    }
  };

  useEffect(() => {
    if (!token || !party) setStatus("error");
  }, [token, party]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full rounded-lg border border-border p-6 space-y-4 bg-card">
        <h1 className="text-xl font-semibold">Transfert de propriété — Confirmation</h1>
        {status === "idle" && (
          <>
            <p className="text-sm text-muted-foreground">
              {party === "old"
                ? "Confirmez le transfert de votre compte vers un nouveau propriétaire."
                : "Confirmez que vous devenez responsable de ce compte Nivra Telecom."}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => call("approve")} className="flex-1">Confirmer</Button>
              <Button variant="outline" onClick={() => call("reject")} className="flex-1">Refuser</Button>
            </div>
          </>
        )}
        {status === "loading" && <div className="flex justify-center"><Loader2 className="animate-spin" /></div>}
        {status === "confirmed" && <p className="text-emerald-500">✅ Confirmation enregistrée. Nous vous tiendrons informé par email.</p>}
        {status === "rejected" && <p className="text-amber-500">❌ Transfert refusé. L'administrateur en sera informé.</p>}
        {status === "error" && <p className="text-red-500">Erreur : {msg || "lien invalide"}</p>}
      </div>
    </div>
  );
}
