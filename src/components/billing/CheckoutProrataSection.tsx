/**
 * CheckoutProrataSection — shared prorata preview for the checkout wizard.
 *
 * Wraps the canonical <ProratePreviewCard> for one or many recurring services.
 * Resolves the account id from the auth user id so parents don't have to.
 * All math comes from the DB (preview_prorata RPC). No frontend arithmetic.
 */
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { ProratePreviewCard } from "@/components/billing/ProratePreviewCard";

export interface ProrataServiceInput {
  key: string;
  label: string;
  monthlyPriceCents: number;
}

interface Props {
  userId?: string | null;
  serviceAddressId?: string | null;
  services: ProrataServiceInput[];
  activationDate?: string;
}

export function CheckoutProrataSection({
  userId,
  serviceAddressId,
  services,
  activationDate,
}: Props) {
  const { data: account } = useQuery({
    queryKey: ["checkout-account-id", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id")
        .eq("client_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const accountId = account?.id ?? null;
  const recurring = services.filter((s) => s.monthlyPriceCents > 0);

  if (!accountId || !serviceAddressId || recurring.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {recurring.map((s) => (
        <ProratePreviewCard
          key={s.key}
          accountId={accountId}
          serviceAddressId={serviceAddressId}
          monthlyPriceCents={s.monthlyPriceCents}
          serviceLabel={s.label}
          activationDate={activationDate}
        />
      ))}
    </div>
  );
}

export default CheckoutProrataSection;
