import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { categoryLabels, sportLabels, statusLabels } from "../lib/collection-data";
import type { ShirtCategory, ShirtFilters, ShirtStatus, Sport } from "../lib/types";
import { SelectField, TextField } from "./FormControls";

type FiltersBarProps = {
  filters: ShirtFilters;
  leagues: string[];
  countries: string[];
  onFilterChange: <K extends keyof ShirtFilters>(field: K, value: ShirtFilters[K]) => void;
  onReset: () => void;
  showStatusFilter?: boolean;
  toolbarSlot?: ReactNode;
  onOpenChange?: (isOpen: boolean) => void;
};

const sportOptions: Array<"all" | Sport> = ["all", "football", "basketball"];
const categoryOptions: Array<"all" | ShirtCategory> = ["all", "club", "national"];
const statusOptions: Array<"all" | ShirtStatus> = ["all", "collection", "wishlist"];

const withSelectedOption = (options: string[], selected: string) => {
  if (selected === "all" || selected.trim() === "" || options.includes(selected)) {
    return options;
  }

  return [selected, ...options];
};

export function FiltersBar({
  filters,
  leagues,
  countries,
  onFilterChange,
  onReset,
  showStatusFilter = false,
  toolbarSlot,
  onOpenChange,
}: FiltersBarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const countryOptions = withSelectedOption(countries, filters.country);
  const leagueOptions = withSelectedOption(leagues, filters.league);

  const handleToggleMobile = () => {
    if (!window.matchMedia("(max-width: 768px)").matches) return;
    setIsMobileOpen((current) => !current);
  };
  const handleCloseMobile = () => setIsMobileOpen(false);

  const handleReset = () => {
    onReset();
    handleCloseMobile();
  };

  useEffect(() => {
    onOpenChange?.(isMobileOpen);
  }, [isMobileOpen, onOpenChange]);

  useEffect(() => {
    if (!isMobileOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseMobile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.sport !== "all" ||
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.country !== "all" ||
    filters.league !== "all" ||
    filters.year.trim() !== "";

  return (
    <div className="filters-bar">
      <div className="filters-toolbar">
        <button
          className="filters-mobile-toggle"
          type="button"
          onClick={handleToggleMobile}
          aria-expanded={isMobileOpen}
        >
          <span>Filtros</span>
          {hasActiveFilters ? <span className="filters-badge">×</span> : null}
        </button>
        {toolbarSlot ? <div className="filters-toolbar-slot">{toolbarSlot}</div> : null}
      </div>

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
          options={["all", ...countryOptions]}
          getLabel={(value) => (value === "all" ? "Todos" : value)}
          onChange={(value) => onFilterChange("country", value as "all" | string)}
        />
        {showStatusFilter ? (
          <SelectField
            label="Estado"
            value={filters.status}
            options={statusOptions}
            getLabel={(value) => (value === "all" ? "Todas" : statusLabels[value])}
            onChange={(value) => onFilterChange("status", value as "all" | ShirtStatus)}
          />
        ) : null}
        <SelectField
          label="Deporte"
          value={filters.sport}
          options={sportOptions}
          getLabel={(value) => (value === "all" ? "Todos" : sportLabels[value])}
          onChange={(value) => onFilterChange("sport", value as Sport | "all")}
        />
        <SelectField
          label="Tipo"
          value={filters.category}
          options={categoryOptions}
          getLabel={(value) => (value === "all" ? "Todos" : categoryLabels[value])}
          onChange={(value) => onFilterChange("category", value as ShirtCategory | "all")}
        />
        <SelectField
          label="Liga"
          value={filters.league}
          options={["all", ...leagueOptions]}
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
                  ×
                </button>
              ) : null}
              <button className="icon-button" type="button" onClick={handleCloseMobile} aria-label="Cerrar filtros">
                ×
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
                options={["all", ...countryOptions]}
                getLabel={(value) => (value === "all" ? "Todos" : value)}
                onChange={(value) => onFilterChange("country", value as "all" | string)}
              />
              {showStatusFilter ? (
                <SelectField
                  label="Estado"
                  value={filters.status}
                  options={statusOptions}
                  getLabel={(value) => (value === "all" ? "Todas" : statusLabels[value])}
                  onChange={(value) => onFilterChange("status", value as "all" | ShirtStatus)}
                />
              ) : null}
              <SelectField
                label="Deporte"
                value={filters.sport}
                options={sportOptions}
                getLabel={(value) => (value === "all" ? "Todos" : sportLabels[value])}
                onChange={(value) => onFilterChange("sport", value as Sport | "all")}
              />
              <SelectField
                label="Tipo"
                value={filters.category}
                options={categoryOptions}
                getLabel={(value) => (value === "all" ? "Todos" : categoryLabels[value])}
                onChange={(value) => onFilterChange("category", value as ShirtCategory | "all")}
              />
              <SelectField
                label="Liga"
                value={filters.league}
                options={["all", ...leagueOptions]}
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
