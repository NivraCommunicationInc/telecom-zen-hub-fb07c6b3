import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StaffRole = "admin" | "employee" | "technician";
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
      
      <Select value={roleFilter} onValueChange={(v) => onRoleFilterChange(v as StaffRole | "all")}>
        <SelectTrigger className="w-[150px]">
          <Filter className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Rôle" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les rôles</SelectItem>
          <SelectItem value="admin">Administrateurs</SelectItem>
          <SelectItem value="employee">Employés</SelectItem>
          <SelectItem value="technician">Techniciens</SelectItem>
        </SelectContent>
      </Select>

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

      <Select value={pinFilter} onValueChange={(v) => onPinFilterChange(v as PinFilter)}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="PIN" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous PIN</SelectItem>
          <SelectItem value="defined">PIN défini</SelectItem>
          <SelectItem value="not_defined">PIN non défini</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export type { StaffRole, StatusFilter, PinFilter };
