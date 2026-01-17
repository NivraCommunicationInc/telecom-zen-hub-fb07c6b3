/**
 * ClientSearchBar - Enhanced search bar for client filtering
 */
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SearchFilter = "all" | "name" | "email" | "phone" | "tag";

interface ClientSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchFilter: SearchFilter;
  onFilterChange: (filter: SearchFilter) => void;
}

const filterPlaceholders: Record<SearchFilter, string> = {
  all: "Rechercher par nom, courriel, téléphone, numéro client...",
  name: "Rechercher par nom...",
  email: "Rechercher par courriel...",
  phone: "Rechercher par téléphone...",
  tag: "Rechercher par tag...",
};

export function ClientSearchBar({
  searchQuery,
  onSearchChange,
  searchFilter,
  onFilterChange,
}: ClientSearchBarProps) {
  return (
    <div className="flex gap-2 max-w-xl">
      <Select value={searchFilter} onValueChange={(v) => onFilterChange(v as SearchFilter)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Filtrer par" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          <SelectItem value="name">Nom</SelectItem>
          <SelectItem value="email">Courriel</SelectItem>
          <SelectItem value="phone">Téléphone</SelectItem>
          <SelectItem value="tag">Tag service</SelectItem>
        </SelectContent>
      </Select>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={filterPlaceholders[searchFilter]}
          className="pl-10"
        />
      </div>
    </div>
  );
}

export type { SearchFilter };
