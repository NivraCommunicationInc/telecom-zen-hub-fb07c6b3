/**
 * CoreAIConsolePage — Nivra AI Console.
 * Console IA centralisée Core : client picker, résumé 360, suggestion IA,
 * catalogue complet d'actions avec liens directs vers les pages Core existantes.
 */
import { useState } from "react";
import { Brain } from "lucide-react";
import ClientPicker, { type PickedClient } from "@/core-app/components/ai-console/ClientPicker";
import ClientSummaryCard from "@/core-app/components/ai-console/ClientSummaryCard";
import AISuggestionPanel from "@/core-app/components/ai-console/AISuggestionPanel";
import ActionCatalog from "@/core-app/components/ai-console/ActionCatalog";
import type { ActionCategory } from "@/core-app/components/ai-console/actionsRegistry";

export default function CoreAIConsolePage() {
  const [client, setClient] = useState<PickedClient | null>(null);
  const [category, setCategory] = useState<ActionCategory | "all">("all");

  return (
    <div className="space-y-4 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-core-text-primary flex items-center gap-2">
            <Brain className="w-5 h-5 text-core-accent" /> Nivra AI Console
          </h1>
          <p className="text-sm text-core-text-secondary">
            Console assistée par IA — sélectionnez un client, obtenez un résumé contextuel et accédez à toutes les actions Core.
          </p>
        </div>
        <div className="w-full sm:w-96">
          <ClientPicker value={client} onChange={setClient} />
        </div>
      </header>

      {client && <ClientSummaryCard client={client} />}

      <AISuggestionPanel client={client} />

      <ActionCatalog client={client} category={category} onCategoryChange={setCategory} />
    </div>
  );
}
