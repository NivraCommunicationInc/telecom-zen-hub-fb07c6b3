import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Only admin role is supported now
type StaffRole = "admin";
type StatusFilter = "all" | "active" | "disabled";
type PinFilter = "all" | "defined" | "not_defined";

interface StaffFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: StaffRole | "all";
  onRoleFilterChange: (value: StaffRole | "all") => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  pinFilter: PinFilter;
  onPinFilterChange: (value: PinFilter) => void;
}

export function StaffFilters({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  pinFilter,
  onPinFilterChange,
}: StaffFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher (nom, email, badge, tél)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 w-[250px]"
        />
      </div>

      <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous statuts</SelectItem>
          <SelectItem value="active">Actifs</SelectItem>
          <SelectItem value="disabled">Désactivés</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export type { StaffRole, StatusFilter, PinFilter };