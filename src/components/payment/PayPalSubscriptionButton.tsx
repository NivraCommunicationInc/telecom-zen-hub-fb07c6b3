import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";

interface ServiceItem {
  plan_code: string;
  plan_name: string;
  plan_price: number;
  category: string;
}

interface PayPalSubscriptionButtonProps {
  services: ServiceItem[];
  customerInfo: {
    user_id?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  orderId?: string;
  orderNumber?: string;
  isFrench?: boolean;
  disabled?: boolean;
  className?: string;
  onSuccess?: (result: {
    approval_url: string;
    paypal_subscription_id: string;
    paypal_plan_id: string;
    total_amount: number;
  }) => void;
  onError?: (error: string) => void;
}

/**
 * PayPal Subscription Button for automatic recurring payments.
 * Creates a billing subscription with $5/month discount and redirects to PayPal for approval.
 */
export const PayPalSubscriptionButton = ({
  services,
  customerInfo,
  orderId,
  orderNumber,
  isFrench = true,
  disabled = false,
  className = "",
  onSuccess,
  onError,
}: PayPalSubscriptionButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "billing-create-order-with-paypal-subscription",
        {
          body: {
            user_id: customerInfo.user_id,
            first_name: customerInfo.first_name,
            last_name: customerInfo.last_name,
            email: customerInfo.email,
            phone: customerInfo.phone,
            services,
            order_id: orderId,
            order_number: orderNumber,
            enable_auto_billing: true,
          },
        }
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Subscription creation failed");

      toast.success(
        isFrench
          ? "Abonnement créé! Redirection vers PayPal..."
          : "Subscription created! Redirecting to PayPal..."
      );

      // Call success callback with result
      onSuccess?.({
        approval_url: data.approval_url,
        paypal_subscription_id: data.paypal_subscription_id,
        paypal_plan_id: data.paypal_plan_id,
        total_amount: data.total_amount,
      });

      // Redirect to PayPal approval page
      if (data.approval_url) {
        window.location.href = data.approval_url;
      }
    } catch (err) {
      console.error("PayPal subscription error:", err);
      const errorMessage = await getInvokeErrorMessage(err);
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSubscribe}
      disabled={disabled || isLoading}
      className={`w-full bg-[#0070ba] hover:bg-[#005ea6] text-white font-medium py-3 ${className}`}
      size="lg"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          {isFrench ? "Création de l'abonnement..." : "Creating subscription..."}
        </>
      ) : (
        <>
          <CreditCard className="w-5 h-5 mr-2" />
          {isFrench ? "Activer le paiement automatique" : "Activate automatic payments"}
          <Gift className="w-4 h-4 ml-2" />
        </>
      )}
    </Button>
  );
};

export default PayPalSubscriptionButton;
