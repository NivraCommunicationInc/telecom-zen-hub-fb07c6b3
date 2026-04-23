/**
 * FieldSecurity — Security info. Clean light UI.
 */
import { Lock, Shield, Key } from "lucide-react";

export default function FieldSecurity() {
  return (
    <div className="max-w-lg mx-auto space-y-5 field-page-enter">
      <h1 className="text-xl font-bold text-white">Sécurité</h1>
      <div className="bg-[hsl(var(--field-card))] border border-[hsl(var(--field-border-subtle))] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[hsl(var(--field-success)/0.15)] flex items-center justify-center">
            <Shield className="h-5 w-5 text-[hsl(var(--field-success))]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Authentification MFA</p>
            <p className="text-xs text-[hsl(var(--field-success))]">Active</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[hsl(var(--field-accent)/0.15)] flex items-center justify-center">
            <Lock className="h-5 w-5 text-[hsl(var(--field-accent-glow))]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Session sécurisée</p>
            <p className="text-xs text-[hsl(var(--field-text-muted))]">Les sessions expirent après inactivité.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[hsl(var(--field-warning)/0.15)] flex items-center justify-center">
            <Key className="h-5 w-5 text-[hsl(var(--field-warning))]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Accès terrain</p>
            <p className="text-xs text-[hsl(var(--field-text-muted))]">Limité aux fonctions de vente terrain uniquement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
