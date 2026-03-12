/**
 * CoreEmailMarketingPage — Transferred from AdminMarketing.tsx
 * Email marketing campaigns
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, Search, Plus, Send, BarChart3, FileText, Clock, Users } from "lucide-react";

export default function CoreEmailMarketingPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Email Marketing</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Campagnes et communications marketing</p></div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4" /> Nouvelle campagne</Button>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)]">
          <TabsTrigger value="campaigns" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Campagnes</TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Templates</TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns"><div className="text-center py-12 text-[hsl(var(--core-text-label))]"><Megaphone className="w-8 h-8 mx-auto mb-3 opacity-30" />Aucune campagne active</div></TabsContent>
        <TabsContent value="templates"><div className="text-center py-12 text-[hsl(var(--core-text-label))]"><FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />Templates marketing à configurer</div></TabsContent>
        <TabsContent value="analytics"><div className="text-center py-12 text-[hsl(var(--core-text-label))]"><BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-30" />Aucune donnée analytique</div></TabsContent>
      </Tabs>
    </div>
  );
}
