import { useState } from "react";
import { sportLabels } from "../lib/collection-data";
import type { ShirtFilters, Sport } from "../lib/types";
import { SelectField, TextField } from "./FormControls";

type FiltersBarProps = {
  filters: ShirtFilters;
  leagues: string[];
  countries: string[];
  onFilterChange: <K extends keyof ShirtFilters>(field: K, value: ShirtFilters[K]) => void;
  onReset: () => void;
  sortBy?: string;
  onSortChange?: (value: string) => void;
};

const sportOptions: Array<"all" | Sport> = ["all", "football", "basketball"];

export function FiltersBar({
  filters,
  leagues,
  countries,
  onFilterChange,
  onReset,
  sortBy,
  onSortChange,
}: FiltersBarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleToggleMobile = () => setIsMobileOpen((current) => !current);
  const handleCloseMobile = () => setIsMobileOpen(false);

  const handleReset = () => {
    onReset();
    handleCloseMobile();
  };

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.sport !== "all" ||
    filters.country !== "all" ||
    filters.league !== "all" ||
    filters.year.trim() !== "";

  return (
    <div className="filters-bar">
      <button className="filters-mobile-toggle" type="button" onClick={handleToggleMobile}>
        🔍 Filtros
        {hasActiveFilters ? <span className="filters-badge">✕</span> : null}
      </button>

      <div className="filters-grid">
        <TextField
          label="Búsqueda"
          value={filters.search}
          placeholder="Buscar en la vitrina..."
          onChange={(value) => onFilterChange("search", value)}
        />
        <SelectField
          label="País"
          value={filters.country}
          options={["all", ...countries]}
          getLabel={(value) => (value === "all" ? "Todos" : value)}
          onChange={(value) => onFilterChange("country", value as "all" | string)}
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
        <TextField
          label="Año"
          value={filters.year}
          placeholder="2024"
          type="text"
          onChange={(value) => onFilterChange("year", value)}
        />
        {/* Sort control moved to header (compact button) */}
      </div>
      {isMobileOpen ? (
        <div className="filters-mobile-drawer-backdrop" onClick={handleCloseMobile}>
          <div className="filters-mobile-dropdown" onClick={(event) => event.stopPropagation()}>
            <div className="filters-mobile-header">
              <span>Filtros</span>
              {hasActiveFilters ? (
                <button
                  className="filters-reset-button"
                  type="button"
                  onClick={handleReset}
                  aria-label="Restablecer filtros"
                >
                  ✕
                </button>
              ) : null}
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
                label="País"
                value={filters.country}
                options={["all", ...countries]}
                getLabel={(value) => (value === "all" ? "Todos" : value)}
                onChange={(value) => onFilterChange("country", value as "all" | string)}
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
              <TextField
                label="Año"
                value={filters.year}
                placeholder="2024"
                type="text"
                onChange={(value) => onFilterChange("year", value)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
