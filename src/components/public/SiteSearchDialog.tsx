/**
 * SiteSearchDialog — Command palette search across public pages.
 * Triggered from the header search icon. Keyboard accessible (Enter to navigate).
 */
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Wifi, Tv, Smartphone, HelpCircle, Mail, FileText, Receipt,
  Shield, Activity, User, Home, DollarSign,
} from "lucide-react";

interface SiteSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SiteSearchDialog({ open, onOpenChange }: SiteSearchDialogProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isFr = language === "fr";
  const [query, setQuery] = useState("");

  const items = useMemo(() => [
    { group: isFr ? "Forfaits" : "Plans", icon: Wifi, label: "Internet", path: "/internet", keywords: "internet wifi fibre haute vitesse" },
    { group: isFr ? "Forfaits" : "Plans", icon: Tv, label: isFr ? "Télévision" : "Television", path: "/television", keywords: "tv television chaines terminal" },
    { group: isFr ? "Forfaits" : "Plans", icon: Smartphone, label: isFr ? "Mobile" : "Mobile", path: "/mobile", keywords: "mobile cellulaire sim recharge prepaid" },
    { group: isFr ? "Forfaits" : "Plans", icon: Home, label: isFr ? "Tous les forfaits" : "All plans", path: "/forfaits", keywords: "forfaits plans prix" },
    { group: "Support", icon: HelpCircle, label: "FAQ / Aide", path: "/aide", keywords: "aide faq questions support" },
    { group: "Support", icon: Mail, label: "Contact", path: "/contact", keywords: "contact courriel email" },
    { group: "Support", icon: Activity, label: isFr ? "État des services" : "System status", path: "/status", keywords: "status etat services panne incident" },
    { group: isFr ? "Compte" : "Account", icon: User, label: isFr ? "Mon compte" : "My account", path: "/portal", keywords: "compte portail login connexion" },
    { group: isFr ? "Compte" : "Account", icon: Receipt, label: isFr ? "Commander" : "Order", path: "/commander", keywords: "commander commande checkout" },
    { group: "Info", icon: DollarSign, label: isFr ? "Frais possibles" : "Possible fees", path: "/frais-possibles", keywords: "frais fees prix activation livraison" },
    { group: isFr ? "Légal" : "Legal", icon: Shield, label: isFr ? "Confidentialité" : "Privacy", path: "/privacy-policy", keywords: "confidentialite privacy loi 25" },
    { group: isFr ? "Légal" : "Legal", icon: FileText, label: isFr ? "Conditions de service" : "Terms of service", path: "/conditions-de-service", keywords: "conditions terms cgv" },
    { group: isFr ? "Légal" : "Legal", icon: FileText, label: isFr ? "Remboursement" : "Refund policy", path: "/politique-remboursement", keywords: "remboursement refund" },
    { group: isFr ? "Légal" : "Legal", icon: FileText, label: "CRTC", path: "/conformite-crtc", keywords: "crtc conformite" },
  ], [isFr]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const handleSelect = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(path);
  };

  const grouped = items.reduce((acc, item) => {
    (acc[item.group] = acc[item.group] || []).push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={isFr ? "Rechercher une page, un forfait, de l'aide…" : "Search pages, plans, help…"}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{isFr ? "Aucun résultat." : "No results."}</CommandEmpty>
        {Object.entries(grouped).map(([group, groupItems]) => (
          <CommandGroup key={group} heading={group}>
            {groupItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.path}
                  value={`${item.label} ${item.keywords}`}
                  onSelect={() => handleSelect(item.path)}
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{item.path}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
