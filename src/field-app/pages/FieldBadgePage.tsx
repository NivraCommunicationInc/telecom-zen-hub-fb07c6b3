/**
 * FieldBadgePage — Field agent's digital badge (Apple Wallet, Google Wallet, PDF, Email).
 */
import EmployeeBadgePreview from "@/components/employee/EmployeeBadgePreview";

export default function FieldBadgePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon Badge</h1>
        <p className="text-sm text-muted-foreground">
          Votre badge employé numérique Nivra. Ajoutez-le à votre portefeuille mobile ou imprimez-le.
        </p>
      </div>
      <EmployeeBadgePreview />
    </div>
  );
}
