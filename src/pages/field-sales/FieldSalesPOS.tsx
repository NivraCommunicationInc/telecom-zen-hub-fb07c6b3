/**
 * FieldSalesPOS - Professional Point of Sale interface for field sales representatives
 * Now uses the Unified POS component with equipment and adjustments support
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import UnifiedPOSPage from "@/components/pos/UnifiedPOSPage";

export default function FieldSalesPOS() {
  const [repName, setRepName] = useState("");

  useEffect(() => {
    const loadRepName = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      setRepName(profile?.full_name || session.user.email?.split("@")[0] || "");
    };
    loadRepName();
  }, []);

  return (
    <UnifiedPOSPage
      portalType="field-sales"
      backPath="/field-sales/dashboard"
      repName={repName}
      onOrderComplete={(orderId) => {
        console.log("Order completed:", orderId);
      }}
    />
  );
}
