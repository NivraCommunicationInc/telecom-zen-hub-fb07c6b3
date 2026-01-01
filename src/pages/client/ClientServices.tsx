import ClientLayout from "@/components/client/ClientLayout";
import ClientMyServices from "@/components/client/ClientMyServices";

const ClientServices = () => {
  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Mes services</h1>
          <p className="text-muted-foreground mt-1">Gérez vos services, équipements et forfaits</p>
        </div>
        
        <ClientMyServices />
      </div>
    </ClientLayout>
  );
};

export default ClientServices;
