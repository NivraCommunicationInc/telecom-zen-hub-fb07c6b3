/**
 * FieldSecurity — Security settings for field agents.
 */
import { Lock, Shield, Key } from "lucide-react";

export default function FieldSecurity() {
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold tracking-tight">Sécurité</h1>

      <div className="rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Authentification MFA</p>
            <p className="text-xs text-emerald-400">Active</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Session sécurisée</p>
            <p className="text-xs text-[hsl(220,10%,45%)]">Les sessions expirent après inactivité.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Key className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Accès terrain</p>
            <p className="text-xs text-[hsl(220,10%,45%)]">Limité aux fonctions de vente terrain uniquement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
