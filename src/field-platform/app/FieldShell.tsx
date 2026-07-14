import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import "../design/field.css";
import { FieldTopbar } from "./FieldTopbar";
import { FieldRail } from "./FieldRail";
import { FieldDock } from "./FieldDock";
import { CommandPalette } from "./CommandPalette";
import { NotificationCenter } from "./NotificationCenter";
import { AIAssistantPanel } from "./AIAssistantPanel";
import { ScannerSheet } from "./ScannerSheet";

type Status = "available" | "en_route" | "on_site" | "pause" | "off";
const STATUS_CYCLE: Status[] = ["available", "en_route", "on_site", "pause", "off"];

export default function FieldShell() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [status, setStatus] = useState<Status>("available");

  const cycleStatus = useCallback(() => {
    setStatus((s) => STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length]);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="field-root">
      <div className="field-shell">
        <FieldTopbar
          onOpenCommand={() => setCmdOpen(true)}
          onOpenNotifications={() => setNotifOpen(true)}
          onOpenAssistant={() => setAiOpen(true)}
          onOpenScanner={() => setScanOpen(true)}
          status={status}
          onCycleStatus={cycleStatus}
        />
        <FieldRail />
        <main className="field-main">
          <Outlet />
        </main>
        <FieldDock onOpenScanner={() => setScanOpen(true)} />
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
      <AIAssistantPanel open={aiOpen} onClose={() => setAiOpen(false)} />
      <ScannerSheet open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  );
}
