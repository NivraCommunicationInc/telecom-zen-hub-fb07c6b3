import ClientLayout from "@/components/client/ClientLayout";
import ClientMyServices from "@/components/client/ClientMyServices";
import { PaymentHistoryV2 } from "@/components/client/PaymentHistoryV2";
import { useClientAuth } from "@/hooks/useClientAuth";

const ClientServices = () => {
  const { user } = useClientAuth();

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Utilisation et services</h1>
          <p className="text-slate-500 mt-1">Gérez vos services, équipements et forfaits</p>
        </div>
        
        <ClientMyServices />

        {/* Payment History - V2 canonical source */}
        {user?.id && <PaymentHistoryV2 userId={user.id} />}
      </div>
    </ClientLayout>
  );
};

export default ClientServices;
