import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/backend/types";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tv,
  Search,
  Check,
  Star,
  Lock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  is_hd: boolean;
  is_4k: boolean;
  is_active: boolean;
  base_pack: string | null;
}

export interface TVChannelSelectionBaseProps {
  channelChoicesLimit: number;
  selectedFreeChannels: Channel[];
  selectedPremiumChannels: Channel[];
  onFreeChannelsChange: (channels: Channel[]) => void;
  onPremiumChannelsChange: (channels: Channel[]) => void;
  isFrench: boolean;
  supabaseClient: SupabaseClient<Database>;
}

const CATEGORY_FILTERS = [
  { value: "all", labelFr: "Toutes", labelEn: "All" },
  { value: "news", labelFr: "Nouvelles", labelEn: "News" },
  { value: "sports", labelFr: "Sports", labelEn: "Sports" },
  { value: "entertainment", labelFr: "Divertissement", labelEn: "Entertainment" },
  { value: "kids", labelFr: "Enfants", labelEn: "Kids" },
  { value: "movies", labelFr: "Films", labelEn: "Movies" },
  { value: "music", labelFr: "Musique", labelEn: "Music" },
  { value: "lifestyle", labelFr: "Style de vie", labelEn: "Lifestyle" },
];

export const TVChannelSelectionBase = ({
  channelChoicesLimit,
  selectedFreeChannels,
  selectedPremiumChannels,
  onFreeChannelsChange,
  onPremiumChannelsChange,
  isFrench,
  supabaseClient,
}: TVChannelSelectionBaseProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAllBase, setShowAllBase] = useState(false);

  // Fetch all active channels from database with error handling
  const { data: channels = [], isLoading, error, refetch } = useQuery({
    queryKey: ["tv-channels-checkout"],
    queryFn: async () => {
      console.log("[TVChannelSelection] fetch start");
      const { data, error } = await supabaseClient
        .from("tv_channels")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) {
        console.error("[TVChannelSelection] fetch error", error);
        throw error;
      }
      console.log("[TVChannelSelection] fetched", data?.length, "channels");
      return data as Channel[];
    },
  });


  // Categorize channels - La Base = only channels with base_pack = 'LA_BASE_26' (exactly 26)
  const baseChannels = useMemo(() => 
    channels.filter(ch => ch.base_pack === "LA_BASE_26"), [channels]);
  const freeChoiceChannels = useMemo(() => 
    channels.filter(ch => ch.category === "free_choice"), [channels]);
  const paidChannels = useMemo(() => 
    channels.filter(ch => ch.category === "paid"), [channels]);

  // Filter free choice channels
  const filteredFreeChoice = useMemo(() => {
    return freeChoiceChannels.filter(ch => {
      const matchesSearch = ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ch.description?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || 
        ch.description?.toLowerCase().includes(categoryFilter);
      return matchesSearch && matchesCategory;
    });
  }, [freeChoiceChannels, searchTerm, categoryFilter]);

  // Toggle free choice channel
  const toggleFreeChannel = (channel: Channel) => {
    const isSelected = selectedFreeChannels.some(ch => ch.id === channel.id);
    if (isSelected) {
      onFreeChannelsChange(selectedFreeChannels.filter(ch => ch.id !== channel.id));
    } else if (selectedFreeChannels.length < channelChoicesLimit) {
      onFreeChannelsChange([...selectedFreeChannels, channel]);
    }
  };

  // Toggle premium channel
  const togglePremiumChannel = (channel: Channel) => {
    const isSelected = selectedPremiumChannels.some(ch => ch.id === channel.id);
    if (isSelected) {
      onPremiumChannelsChange(selectedPremiumChannels.filter(ch => ch.id !== channel.id));
    } else {
      onPremiumChannelsChange([...selectedPremiumChannels, channel]);
    }
  };

  const premiumTotal = selectedPremiumChannels.reduce((sum, ch) => sum + (ch.price || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              {isFrench ? "Chargement des chaînes..." : "Loading channels..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium">
              {isFrench ? "Erreur lors du chargement des chaînes" : "Error loading channels"}
            </p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              {isFrench ? "Veuillez réessayer" : "Please try again"}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              {isFrench ? "Réessayer" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section A: La Base - 26 chaînes HD (Included) - Nivra official lineup */}
      <Card className="bg-card border-emerald-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {isFrench ? "La Base" : "The Base"} — 26 {isFrench ? "chaînes HD" : "HD channels"}
                </CardTitle>
                <CardDescription>
                  {isFrench 
                    ? "Incluant les réseaux généralistes canadiens. Toujours inclus avec votre forfait."
                    : "Including Canadian general networks. Always included with your plan."}
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-emerald-500">{isFrench ? "INCLUS" : "INCLUDED"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {(showAllBase ? baseChannels : baseChannels.slice(0, 10)).map(channel => (
              <div 
                key={channel.id} 
                className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm"
              >
                <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                <span className="truncate">{channel.name}</span>
                {channel.is_hd && <Badge variant="outline" className="text-[10px] px-1">HD</Badge>}
              </div>
            ))}
          </div>
          {baseChannels.length > 10 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-3 text-emerald-600"
              onClick={() => setShowAllBase(!showAllBase)}
            >
              {showAllBase ? (
                <><ChevronUp className="w-4 h-4 mr-1" /> {isFrench ? "Voir moins" : "Show less"}</>
              ) : (
                <><ChevronDown className="w-4 h-4 mr-1" /> {isFrench ? `Voir les ${baseChannels.length} chaînes` : `See all ${baseChannels.length} channels`}</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Section B: Chaînes au choix (Free-Choice) */}
      {channelChoicesLimit > 0 && (
        <Card className="bg-card border-purple-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Tv className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {isFrench ? "Chaînes au choix" : "Channels of Choice"}
                    <Badge variant="outline" className={`${
                      selectedFreeChannels.length === channelChoicesLimit 
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" 
                        : "bg-purple-500/10 text-purple-500 border-purple-500/30"
                    }`}>
                      {selectedFreeChannels.length}/{channelChoicesLimit} {isFrench ? "sélectionnées" : "selected"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {isFrench 
                      ? `Choisissez ${channelChoicesLimit} chaînes incluses avec votre forfait.`
                      : `Choose ${channelChoicesLimit} channels included with your plan.`}
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Quick presets */}
                {[
                  { labelFr: "Sports", labelEn: "Sports", keywords: ["sport","rds","tva sport","espn","sportsnet"] },
                  { labelFr: "Francophone", labelEn: "Francophone", keywords: ["tva","v network","noovo","canal vie","canal d","ztélé","series+","super écran","historia"] },
                  { labelFr: "Mix Sport+Séries", labelEn: "Sports+Series Mix", keywords: ["sport","rds","serie","serie+","historia","z télé"] },
                ].map((preset) => (
                  <Button
                    key={preset.labelFr}
                    variant="outline"
                    size="sm"
                    className="text-purple-500 border-purple-500/30 hover:bg-purple-500/10 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      const matches = freeChoiceChannels.filter(ch =>
                        preset.keywords.some(kw => ch.name.toLowerCase().includes(kw) || (ch.description || "").toLowerCase().includes(kw))
                      );
                      const fallback = freeChoiceChannels.filter(ch =>
                        !matches.some(m => m.id === ch.id)
                      );
                      const combined = [...matches, ...fallback].slice(0, channelChoicesLimit);
                      onFreeChannelsChange(combined);
                    }}
                    disabled={freeChoiceChannels.length === 0}
                  >
                    {isFrench ? preset.labelFr : preset.labelEn}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-purple-500 border-purple-500/30 hover:bg-purple-500/10 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    const shuffled = [...freeChoiceChannels].sort(() => Math.random() - 0.5);
                    onFreeChannelsChange(shuffled.slice(0, channelChoicesLimit));
                  }}
                  disabled={freeChoiceChannels.length === 0}
                >
                  🎲 {isFrench ? "Hasard" : "Random"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder={isFrench ? "Rechercher une chaîne..." : "Search channels..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {CATEGORY_FILTERS.slice(0, 5).map(cat => (
                  <Button
                    key={cat.value}
                    variant={categoryFilter === cat.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryFilter(cat.value)}
                    className={categoryFilter === cat.value ? "bg-purple-500 hover:bg-purple-600" : ""}
                  >
                    {isFrench ? cat.labelFr : cat.labelEn}
                  </Button>
                ))}
              </div>
            </div>

            {/* Channel grid */}
            <ScrollArea className="h-[300px] pr-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredFreeChoice.map(channel => {
                  const isSelected = selectedFreeChannels.some(ch => ch.id === channel.id);
                  const isDisabled = !isSelected && selectedFreeChannels.length >= channelChoicesLimit;
                  
                  return (
                    <div 
                      key={channel.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                        isSelected 
                          ? "border-purple-500 bg-purple-500/5" 
                          : isDisabled 
                            ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                            : "border-border hover:border-purple-500/50"
                      }`}
                      onClick={() => !isDisabled && toggleFreeChannel(channel)}
                    >
                      <Checkbox 
                        checked={isSelected} 
                        disabled={isDisabled}
                        className="pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{channel.name}</span>
                          {channel.is_hd && <Badge variant="outline" className="text-[10px] px-1">HD</Badge>}
                          {channel.is_4k && <Badge variant="outline" className="text-[10px] px-1 bg-purple-100 text-purple-700">4K</Badge>}
                        </div>
                        {channel.description && (
                          <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 flex-shrink-0">
                        {isFrench ? "Inclus" : "Included"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              {filteredFreeChoice.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {isFrench ? "Aucune chaîne trouvée" : "No channels found"}
                </div>
              )}
            </ScrollArea>

            {selectedFreeChannels.length >= channelChoicesLimit && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  {isFrench 
                    ? `Limite atteinte. Désélectionnez une chaîne pour en choisir une autre.`
                    : `Limit reached. Deselect a channel to choose another.`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section C: Premium / Sports Channels (Paid) */}
      <Card className="bg-card border-amber-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <CardTitle>
                  {isFrench ? "Chaînes Premium & Sports" : "Premium & Sports Channels"}
                </CardTitle>
                <CardDescription>
                  {isFrench 
                    ? "Ajoutez des chaînes premium avec abonnement mensuel."
                    : "Add premium channels with monthly subscription."}
                </CardDescription>
              </div>
            </div>
            {premiumTotal > 0 && (
              <Badge className="bg-amber-500">
                +${premiumTotal.toFixed(2)}/{isFrench ? "mois" : "mo"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px] pr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {paidChannels.map(channel => {
                const isSelected = selectedPremiumChannels.some(ch => ch.id === channel.id);
                
                return (
                  <div 
                    key={channel.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected 
                        ? "border-amber-500 bg-amber-500/5" 
                        : "border-border hover:border-amber-500/50"
                    }`}
                    onClick={() => togglePremiumChannel(channel)}
                  >
                    <Checkbox 
                      checked={isSelected} 
                      className="pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{channel.name}</span>
                        {channel.is_hd && <Badge variant="outline" className="text-[10px] px-1">HD</Badge>}
                        {channel.is_4k && <Badge variant="outline" className="text-[10px] px-1 bg-purple-100 text-purple-700">4K</Badge>}
                      </div>
                      {channel.description && (
                        <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                      )}
                    </div>
                    <span className="font-semibold text-amber-600 flex-shrink-0">
                      ${channel.price}/{isFrench ? "mois" : "mo"}
                    </span>
                  </div>
                );
              })}
            </div>
            {paidChannels.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {isFrench ? "Aucune chaîne premium disponible" : "No premium channels available"}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Summary */}
      {(selectedFreeChannels.length > 0 || selectedPremiumChannels.length > 0) && (
        <Card className="bg-muted/30 border-border">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {isFrench ? "Résumé des chaînes sélectionnées" : "Selected Channels Summary"}
                </p>
                <p className="text-xs text-muted-foreground">
                  26 {isFrench ? "chaînes de base incluses" : "base channels included"} + {" "}
                  {selectedFreeChannels.length} {isFrench ? "au choix" : "choices"} + {" "}
                  {selectedPremiumChannels.length} premium
                </p>
              </div>
              {premiumTotal > 0 && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{isFrench ? "Supplément mensuel" : "Monthly add-on"}</p>
                  <p className="text-lg font-bold text-amber-600">+${premiumTotal.toFixed(2)}/{isFrench ? "mois" : "mo"}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
