import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, History, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AppointmentTabsProps {
  upcomingCount: number;
  pastCount: number;
  historyCount: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: {
    upcoming: React.ReactNode;
    past: React.ReactNode;
    history: React.ReactNode;
  };
}

export const AppointmentTabs = ({
  upcomingCount,
  pastCount,
  historyCount,
  activeTab,
  onTabChange,
  children,
}: AppointmentTabsProps) => {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="upcoming" className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">À venir</span>
          {upcomingCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {upcomingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="past" className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Passés</span>
          {pastCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {pastCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">Historique</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="mt-0">
        {children.upcoming}
      </TabsContent>

      <TabsContent value="past" className="mt-0">
        {children.past}
      </TabsContent>

      <TabsContent value="history" className="mt-0">
        {children.history}
      </TabsContent>
    </Tabs>
  );
};
