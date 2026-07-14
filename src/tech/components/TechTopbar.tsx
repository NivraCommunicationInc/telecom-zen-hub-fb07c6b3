import { Bell, Bot, Command, MapPin, Satellite, Search, ShieldCheck, Wifi } from "lucide-react";

function openOps(name: "command" | "assistant" | "notifications") {
  window.dispatchEvent(new CustomEvent("nivra-tech-open-ops", { detail: name }));
}

export function TechTopbar() {
  return (
    <header className="tk-topbar">
      <div className="tk-brand">
        <div className="tk-brand-mark"><Satellite size={16} /></div>
        <div>
          <div className="tk-brand-name">Nivra Ops</div>
          <div className="tk-brand-sub">Technician command system</div>
        </div>
      </div>
      <button className="tk-top-search" type="button" onClick={() => openOps("command")}>
        <Search size={15} />
        <span>Client, commande, équipement…</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="tk-status">
        <span className="tk-status__dot" /> GPS Live
      </div>
      <div className="tk-top-actions">
        <button aria-label="Connexion"><Wifi /></button>
        <button aria-label="Position"><MapPin /></button>
        <button aria-label="Assistant" onClick={() => openOps("assistant")}><Bot /></button>
        <button aria-label="Commandes" onClick={() => openOps("command")}><Command /></button>
        <button aria-label="Notifications" onClick={() => openOps("notifications")}><Bell /></button>
        <button aria-label="Sécurité"><ShieldCheck /></button>
      </div>
    </header>
  );
}
