/**
 * EmployeeSecurity — Security settings page for employee.
 */
import { Lock, Shield, Key } from "lucide-react";

export default function EmployeeSecurity() {
  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Sécurité</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">Paramètres de sécurité de votre compte</p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Authentification à deux facteurs</p>
              <p className="text-xs text-[hsl(220,10%,45%)]">TOTP activé — requis pour l'accès interne</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Key className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Vérification renforcée</p>
              <p className="text-xs text-[hsl(220,10%,45%)]">Les actions sensibles requièrent une vérification supplémentaire</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Lock className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Session</p>
              <p className="text-xs text-[hsl(220,10%,45%)]">Votre session est protégée par MFA et contrôle d'accès portal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
