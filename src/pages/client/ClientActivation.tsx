/**
 * ClientActivation — /portal/activation
 * Form for clients to request WiFi service activation,
 * with realtime status tracker subscribed to activation_requests changes.
 */
import ClientLayout from "@/components/client/ClientLayout";
import { useClientAuth } from "@/hooks/useClientAuth";
import ClientActivationSection from "@/components/client/ClientActivationSection";

const ClientActivation = () => {
  const { user } = useClientAuth();

  return (
    <ClientLayout>
      <div className="max-w-3xl">
        {user?.id && <ClientActivationSection clientId={user.id} />}
      </div>
    </ClientLayout>
  );
};

export default ClientActivation;
