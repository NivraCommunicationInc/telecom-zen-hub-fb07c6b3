import ClientLayout from "@/components/client/ClientLayout";
import ClientMyServices from "@/components/client/ClientMyServices";

const ClientServices = () => {
  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Utilisation et services</h1>
          <p className="text-slate-500 mt-1">Gérez vos services, équipements et forfaits</p>
        </div>
        
        <ClientMyServices />
      </div>
    </ClientLayout>
  );
};

export default ClientServices;
