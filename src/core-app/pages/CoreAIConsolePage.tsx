/**
 * CoreAIConsolePage — Nivra AI Console (conversationnel vocal).
 * Vraie conversation : STT temps réel + Gemini contextuel + TTS premium français.
 * Pas de message d'intro — l'opérateur parle ou écrit, l'IA répond.
 */
import { useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import ClientPicker, { type PickedClient } from "@/core-app/components/ai-console/ClientPicker";
import ClientSummaryCard from "@/core-app/components/ai-console/ClientSummaryCard";
import VoiceConversation from "@/core-app/components/ai-console/VoiceConversation";
import ActionCatalog from "@/core-app/components/ai-console/ActionCatalog";
import type { ActionCategory } from "@/core-app/components/ai-console/actionsRegistry";

export default function CoreAIConsolePage() {
  const [client, setClient] = useState<PickedClient | null>(null);
  const [category, setCategory] = useState<ActionCategory | "all">("all");
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="space-y-4 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-core-text-primary flex items-center gap-2">
            <Brain className="w-5 h-5 text-core-accent" /> Nivra AI Console
          </h1>
          <p className="text-sm text-core-text-secondary">
            Conversation vocale avec contexte client en direct.
          </p>
        </div>
        <div className="w-full sm:w-96">
          <ClientPicker value={client} onChange={setClient} />
        </div>
      </header>

      {client && <ClientSummaryCard client={client} />}

      <VoiceConversation client={client} />

      <div>
        <button
          onClick={() => setShowActions((v) => !v)}
          className="flex items-center gap-2 text-sm text-core-text-secondary hover:text-core-text-primary"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showActions ? "rotate-180" : ""}`} />
          Catalogue d'actions Core ({showActions ? "masquer" : "afficher"})
        </button>
        {showActions && (
          <div className="mt-3">
            <ActionCatalog client={client} category={category} onCategoryChange={setCategory} />
          </div>
        )}
      </div>
    </div>
  );
}
