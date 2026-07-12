/**
 * Account360ProfileEditDialog — Module 52 Phase A/B.
 *
 * ORCHESTRATOR ONLY.
 * All business logic lives in dedicated sections and OTP dialogs.
 * All writes go through the `client-account-actions` Edge Function gateway.
 *
 * Tabs:
 *   1. Identité      → ProfileIdentitySection  (first_name, last_name, DOB)
 *   2. Contact       → ProfileContactSection   (email double-opt-in, phone OTP)
 *   3. Facturation   → ClientBillingAddressSection (canonical billing model)
 *   4. Préférences   → ProfilePreferencesSection    (language + deep-link Module 46)
 *
 * Service addresses are managed in the dedicated Account 360 "Adresses & Services"
 * tab (`AccountAddressesSection`); we surface a deep-link, not a duplicate editor.
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPen, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { ProfileIdentitySection } from "./profile-edit/ProfileIdentitySection";
import { ProfileContactSection } from "./profile-edit/ProfileContactSection";
import { ClientBillingAddressSection } from "./profile-edit/ClientBillingAddressSection";
import { ProfilePreferencesSection } from "./profile-edit/ProfilePreferencesSection";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any;
  profile: any;
  clientId?: string;
  onSaved: () => void;
  isAdminCore?: boolean;
}

export function Account360ProfileEditDialog({ open, onOpenChange, account, profile, onSaved, isAdminCore = false }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPen className="h-4 w-4 text-primary" />
            Modifier le profil client
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Toutes les modifications passent par la gateway <code>client-account-actions</code>
            (audit + timeline + correlation_id). Chaque action exige une raison motivée.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="identity" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="identity">Identité</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="billing">Facturation</TabsTrigger>
            <TabsTrigger value="prefs">Préférences</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-4">
            <ProfileIdentitySection account={account} profile={profile} isAdminCore={isAdminCore} onSaved={onSaved} />
          </TabsContent>

          <TabsContent value="contact" className="mt-4">
            <ProfileContactSection account={account} profile={profile} onSaved={onSaved} />
          </TabsContent>

          <TabsContent value="billing" className="mt-4">
            <ClientBillingAddressSection account={account} onSaved={onSaved} />
            <div className="mt-4 text-[11px] text-muted-foreground">
              L'adresse <em>de service</em> se gère dans l'onglet dédié du 360 :
              {" "}
              <Link to={corePath(`/accounts/${account?.id ?? ""}?tab=addresses`)} className="inline-flex items-center gap-1 text-primary hover:underline">
                Adresses & Services <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="prefs" className="mt-4">
            <ProfilePreferencesSection account={account} profile={profile} onSaved={onSaved} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
