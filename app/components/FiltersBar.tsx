import { useState } from "react";
import { sportLabels, statusLabels } from "../lib/collection-data";
import type { ShirtFilters, ShirtStatus, Sport } from "../lib/types";
import { SelectField, TextField } from "./FormControls";

type FiltersBarProps = {
  filters: ShirtFilters;
  leagues: string[];
  onFilterChange: <K extends keyof ShirtFilters>(field: K, value: ShirtFilters[K]) => void;
  onReset: () => void;
};

const sportOptions: Array<"all" | Sport> = ["all", "football", "basketball"];
const statusOptions: Array<"all" | ShirtStatus> = ["all", "collection", "wishlist"];

export function FiltersBar({
  filters,
  leagues,
  onFilterChange,
  onReset,
}: FiltersBarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleOpenMobile = () => setIsMobileOpen(true);
  const handleCloseMobile = () => setIsMobileOpen(false);

  const handleReset = () => {
    onReset();
    handleCloseMobile();
  };

  return (
    <div className="filters-bar">
      <button className="filters-mobile-toggle" type="button" onClick={handleOpenMobile}>
        🔍 Filters
      </button>

      <div className="filters-grid">
        <TextField
          label="Búsqueda"
          value={filters.search}
          placeholder="Buscar en la vitrina..."
          onChange={(value) => onFilterChange("search", value)}
        />
        <SelectField
          label="Deporte"
          value={filters.sport}
          options={sportOptions}
          getLabel={(value) => (value === "all" ? "Todos" : sportLabels[value])}
          onChange={(value) => onFilterChange("sport", value as Sport | "all")}
        />
        <SelectField
          label="Liga"
          value={filters.league}
          options={["all", ...leagues]}
          getLabel={(value) => (value === "all" ? "Todas" : value)}
          onChange={(value) => onFilterChange("league", value as "all" | string)}
        />
        <SelectField
          label="Wishlist"
          value={filters.status}
          options={statusOptions}
          getLabel={(value) => (value === "all" ? "Todo" : statusLabels[value])}
          onChange={(value) => onFilterChange("status", value as ShirtStatus | "all")}
        />
      </div>
      <button className="quiet-button" type="button" onClick={onReset}>
        Limpiar
      </button>

      {isMobileOpen ? (
        <div className="filters-mobile-drawer-backdrop" onClick={handleCloseMobile}>
          <div className="filters-mobile-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="filters-mobile-header">
              <span>Filtros</span>
              <button className="icon-button" type="button" onClick={handleCloseMobile} aria-label="Cerrar filtros">
                ✕
              </button>
            </div>
            <div className="filters-mobile-content">
              <TextField
                label="Búsqueda"
                value={filters.search}
                placeholder="Buscar en la vitrina..."
                onChange={(value) => onFilterChange("search", value)}
              />
              <SelectField
                label="Deporte"
                value={filters.sport}
                options={sportOptions}
                getLabel={(value) => (value === "all" ? "Todos" : sportLabels[value])}
                onChange={(value) => onFilterChange("sport", value as Sport | "all")}
              />
              <SelectField
                label="Liga"
                value={filters.league}
                options={["all", ...leagues]}
                getLabel={(value) => (value === "all" ? "Todas" : value)}
                onChange={(value) => onFilterChange("league", value as "all" | string)}
              />
              <SelectField
                label="Wishlist"
                value={filters.status}
                options={statusOptions}
                getLabel={(value) => (value === "all" ? "Todo" : statusLabels[value])}
                onChange={(value) => onFilterChange("status", value as ShirtStatus | "all")}
              />
              <button className="quiet-button" type="button" onClick={handleReset}>
                Limpiar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
