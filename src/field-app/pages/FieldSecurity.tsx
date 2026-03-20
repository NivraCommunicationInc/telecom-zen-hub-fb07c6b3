/**
 * FieldSecurity — Security info. Clean light UI.
 */
import { Lock, Shield, Key } from "lucide-react";

export default function FieldSecurity() {
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold text-[#000000]">Sécurité</h1>
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
            <Shield className="h-5 w-5 text-[#16A34A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#000000]">Authentification MFA</p>
            <p className="text-xs text-[#16A34A]">Active</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
            <Lock className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#000000]">Session sécurisée</p>
            <p className="text-xs text-[#6B7280]">Les sessions expirent après inactivité.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
            <Key className="h-5 w-5 text-[#D97706]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#000000]">Accès terrain</p>
            <p className="text-xs text-[#6B7280]">Limité aux fonctions de vente terrain uniquement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
