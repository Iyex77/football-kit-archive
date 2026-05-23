"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  catalog,
  defaultForm,
  emptyFilters,
  initialShirts,
} from "../lib/collection-data";
import type {
  Shirt,
  ShirtCategory,
  ShirtFilters,
  ShirtFormState,
  ShirtStatus,
  Sport,
  TeamOption,
} from "../lib/types";
import { FiltersBar } from "./FiltersBar";
import { ImageGalleryModal } from "./ImageGalleryModal";
import { ShirtCard } from "./ShirtCard";
import { ShirtForm } from "./ShirtForm";

const createId = () => `shirt-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const unique = (values: string[]) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

function createTeamOptions() {
  const options: TeamOption[] = [];

  (Object.keys(catalog) as Sport[]).forEach((sport) => {
    (Object.keys(catalog[sport]) as ShirtCategory[]).forEach((category) => {
      Object.entries(catalog[sport][category]).forEach(([country, leagues]) => {
        Object.entries(leagues).forEach(([league, teams]) => {
          teams.forEach((team) => {
            options.push({
              id: `${sport}-${category}-${country}-${league}-${team}`,
              team,
              sport,
              category,
              country,
              league,
            });
          });
        });
      });
    });
  });

  return options;
}

const allTeamOptions = createTeamOptions();

function getTypeOptions(sport: string) {
  if (!sport || !(sport in catalog)) {
    return [] as ShirtCategory[];
  }

  return Object.keys(catalog[sport as Sport]) as ShirtCategory[];
}

function getCountryOptions(sport: string, category: string) {
  if (!sport || !category || !(sport in catalog)) {
    return [];
  }

  const sportCatalog = catalog[sport as Sport];
  return category in sportCatalog ? Object.keys(sportCatalog[category as ShirtCategory]) : [];
}

function getLeagueOptions(sport: string, category: string, country: string) {
  if (!sport || !category || !country || !(sport in catalog)) {
    return [];
  }

  const sportCatalog = catalog[sport as Sport];
  const categoryCatalog = category in sportCatalog ? sportCatalog[category as ShirtCategory] : undefined;
  return country && categoryCatalog && country in categoryCatalog ? Object.keys(categoryCatalog[country]) : [];
}

function getTeamOptions(sport: string, category: string, country: string, league: string) {
  if (!sport || !category || !country || !league || !(sport in catalog)) {
    return [];
  }

  const sportCatalog = catalog[sport as Sport];
  const categoryCatalog = category in sportCatalog ? sportCatalog[category as ShirtCategory] : undefined;
  const countryCatalog = country && categoryCatalog && country in categoryCatalog ? categoryCatalog[country] : undefined;
  return league && countryCatalog && league in countryCatalog ? countryCatalog[league] : [];
}

function formFromShirt(shirt: Shirt): ShirtFormState {
  const teams = getTeamOptions(shirt.sport, shirt.category, shirt.country, shirt.league);
  const team = teams.includes(shirt.team) ? shirt.team : "custom";

  return {
    ...shirt,
    team,
    customTeam: team === "custom" ? shirt.team : "",
  };
}

function getFilterOptions(shirts: Shirt[], filters: ShirtFilters) {
  const bySport = shirts.filter((shirt) => filters.sport === "all" || shirt.sport === filters.sport);
  const byCountry = bySport.filter(
    (shirt) => filters.country === "all" || shirt.country === filters.country,
  );
  const byLeague = byCountry.filter(
    (shirt) => filters.league === "all" || shirt.league === filters.league,
  );

  return {
    countries: unique(bySport.map((shirt) => shirt.country)),
    leagues: unique(byCountry.map((shirt) => shirt.league)),
    teams: unique(byLeague.map((shirt) => shirt.team)),
  };
}

function matchesFilters(shirt: Shirt, filters: ShirtFilters) {
  const haystack = [
    shirt.team,
    shirt.player,
    shirt.number,
    shirt.season,
    shirt.country,
    shirt.league,
    shirt.kitType,
    shirt.notes,
  ]
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes(filters.search.trim().toLowerCase()) &&
    (filters.sport === "all" || shirt.sport === filters.sport) &&
    (filters.status === "all" || shirt.status === filters.status) &&
    (filters.country === "all" || shirt.country === filters.country) &&
    (filters.league === "all" || shirt.league === filters.league) &&
    (filters.team === "all" || shirt.team === filters.team)
  );
}

export function ShirtCollectionApp() {
  const [shirts, setShirts] = useState<Shirt[]>(initialShirts);
  const [form, setForm] = useState<ShirtFormState>(defaultForm);
  const [filters, setFilters] = useState<ShirtFilters>(emptyFilters);
  type SortBy =
    | "recent"
    | "oldest"
    | "team-asc"
    | "team-desc"
    | "player-asc"
    | "season-desc"
    | "sport"
    | "wishlist-first";
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingShirtId, setViewingShirtId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    loadShirts();
  }, []);

  async function loadShirts() {
    const { data, error } = await supabase
      .from("shirts")
      .select("*")
      .order("created_at", {
        ascending: false,
      });
    if (!error && data) {
      setShirts(data as Shirt[]);
    }
  }

  const editingShirt = shirts.find((shirt) => shirt.id === editingId);
  const viewingShirt = shirts.find((shirt) => shirt.id === viewingShirtId);
  const typeOptions = getTypeOptions(form.sport);
  const countryOptions = getCountryOptions(form.sport, form.category);
  const leagueOptions = getLeagueOptions(form.sport, form.category, form.country);
  const filteredShirts = shirts.filter((shirt) => matchesFilters(shirt, filters));
  const filterOptions = getFilterOptions(shirts, filters);

  const sortedShirts = (() => {
    const list = filteredShirts.slice();

    const seasonValue = (s: string) => {
      const m = String(s).match(/(\d{4})/);
      return m ? parseInt(m[1], 10) : 0;
    };

    switch (sortBy) {
      case "recent":
        return list; // already in recent-first order
      case "oldest":
        return list.reverse();
      case "team-asc":
        return list.sort((a, b) => a.team.localeCompare(b.team, undefined, { sensitivity: "base" }));
      case "team-desc":
        return list.sort((a, b) => b.team.localeCompare(a.team, undefined, { sensitivity: "base" }));
      case "player-asc":
        return list.sort((a, b) => (a.player || "").localeCompare(b.player || "", undefined, { sensitivity: "base" }));
      case "season-desc":
        return list.sort((a, b) => seasonValue(b.season) - seasonValue(a.season));
      case "sport":
        return list.sort((a, b) => {
          const order = { football: 0, basketball: 1 } as Record<string, number>;
          return (order[a.sport] || 99) - (order[b.sport] || 99);
        });
      case "wishlist-first":
        return list.sort((a, b) => (a.status === b.status ? 0 : a.status === "wishlist" ? -1 : 1));
      default:
        return list;
    }
  })();

  const collectionCount = shirts.filter((shirt) => shirt.status === "collection").length;
  const wishlistCount = shirts.filter((shirt) => shirt.status === "wishlist").length;
  const [isSortOpen, setIsSortOpen] = useState(false);

  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSortOpen(false);
      }
    };

    if (isSortOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isSortOpen]);

  const closeForm = () => {
    setEditingId(null);
    setForm(defaultForm);
    setIsFormOpen(false);
  };

  const clearSelection = () => setSelectedIds([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [id, ...current]));
  };

  const isSelectModeActive = selectedIds.length > 0;

  const openCreateForm = () => {
    setEditingId(null);
    setForm(defaultForm);
    setIsFormOpen(true);
  };

  const handleSportChange = (sport: Sport | "") => {
    setForm((current) => ({
      ...current,
      sport,
      category: "",
      country: "",
      league: "",
      team: current.team === "custom" ? "custom" : "",
      customTeam: current.team === "custom" ? current.customTeam : "",
    }));
  };

  const handleCategoryChange = (category: ShirtCategory | "") => {
    setForm((current) => ({
      ...current,
      category,
      country: "",
      league: "",
      team: current.team === "custom" ? "custom" : "",
      customTeam: current.team === "custom" ? current.customTeam : "",
    }));
  };

  const handleCountryChange = (country: string) => {
    setForm((current) => ({
      ...current,
      country,
      league: "",
      team: current.team === "custom" ? "custom" : "",
      customTeam: current.team === "custom" ? current.customTeam : "",
    }));
  };

  const handleLeagueChange = (league: string) => {
    setForm((current) => ({
      ...current,
      league,
      team: current.team === "custom" ? "custom" : "",
      customTeam: current.team === "custom" ? current.customTeam : "",
    }));
  };

  const handleFieldChange = <K extends keyof ShirtFormState>(
    field: K,
    value: ShirtFormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleTeamSelect = (option: TeamOption) => {
    setForm((current) => ({
      ...current,
      sport: option.sport,
      category: option.category,
      country: option.country,
      league: option.league,
      team: option.team,
      customTeam: "",
    }));
  };

  const handleCustomTeam = (value: string) => {
    setForm((current) => ({
      ...current,
      team: "custom",
      customTeam: value,
    }));
  };

  const handleSubmit = async () => {
    const team = form.team === "custom" ? form.customTeam.trim() : form.team;

    if (!team || !form.season.trim() || !form.kitType) {
      return;
    }

    const payload: Shirt = {
      id: editingId || crypto.randomUUID(),
      sport: (form.sport || "football") as Sport,
      category: (form.category || "club") as ShirtCategory,
      country: form.country,
      league: form.league,
      team,
      season: form.season.trim(),
      player: form.player.trim(),
      number: form.number.trim(),
      kitType: form.kitType,
      size: form.size,
      status: (form.status || "collection") as ShirtStatus,
      images: form.images,
      mainImageId: form.mainImageId || form.images[0]?.id || "",
      notes: form.notes.trim(),
    };

    let result;

    if (editingId) {
      result = await supabase
        .from("shirts")
        .update(payload)
        .eq("id", editingId);
    } else {
      result = await supabase
        .from("shirts")
        .insert([payload]);
    }

    console.log("SUPABASE RESULT:", result);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    await loadShirts();
    closeForm();
  };

  const handleEdit = (shirt: Shirt) => {
    setEditingId(shirt.id);
    setForm(formFromShirt(shirt));
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    setShirts((current) => current.filter((shirt) => shirt.id !== id));
    if (editingId === id) {
      closeForm();
    }
  };

  const handleToggleWishlist = (id: string) => {
    setShirts((current) =>
      current.map((shirt) =>
        shirt.id === id
          ? {
              ...shirt,
              status: shirt.status === "wishlist" ? "collection" : "wishlist",
            }
          : shirt,
      ),
    );
  };

  const handleCardClick = (id: string) => {
    if (isSelectModeActive) {
      toggleSelect(id);
      return;
    }
    setViewingShirtId(id);
  };

  const handleDeleteMultiple = () => {
    if (selectedIds.length === 0) return;
    setShirts((current) => current.filter((s) => !selectedIds.includes(s.id)));
    clearSelection();
  };

  const handleMoveToCollection = () => {
    if (selectedIds.length === 0) return;
    setShirts((current) => current.map((s) => (selectedIds.includes(s.id) ? { ...s, status: "collection" } : s)));
    clearSelection();
  };

  const handleFilterChange = <K extends keyof ShirtFilters>(field: K, value: ShirtFilters[K]) => {
    setFilters((current) => {
      if (field === "sport") {
        return {
          ...current,
          sport: value as ShirtFilters["sport"],
          country: "all",
          league: "all",
          team: "all",
        };
      }

      if (field === "country") {
        return { ...current, country: value as string, league: "all", team: "all" };
      }

      if (field === "league") {
        return { ...current, league: value as string, team: "all" };
      }

      return { ...current, [field]: value };
    });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#142f2d_0,#090d13_36rem,#05070b_100%)] px-4 py-7 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1560px] space-y-8">
        <header className="hero-panel">
          <div>
            <p className="eyebrow">Vitrina privada</p>
            <h1>Camisetas deportivas</h1>
            <p>
              Una colección visual para piezas de fútbol y baloncesto, con wishlist y edición
              rápida cuando la necesitas.
            </p>
          </div>
          <div className="hero-stats" aria-label="Resumen de la coleccion">
            <span>{shirts.length} piezas</span>
            <span>{collectionCount} en colección</span>
            <span>{wishlistCount} wishlist</span>
          </div>
        </header>

        <section className="space-y-7">
          <FiltersBar
            filters={filters}
            leagues={filterOptions.leagues}
            onFilterChange={handleFilterChange}
            onReset={() => setFilters(emptyFilters)}
            sortBy={sortBy}
            onSortChange={(v) => setSortBy(v as SortBy)}
          />

          <div className="collection-heading">
            <div>
              <p className="eyebrow">Colección</p>
              <h2>{filteredShirts.length} camisetas visibles</h2>
            </div>
          </div>

          {sortedShirts.length > 0 ? (
            <div className="collection-grid">
              {sortedShirts.map((shirt) => (
                <ShirtCard
                  key={shirt.id}
                  shirt={shirt}
                  onCardClick={handleCardClick}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleWishlist={handleToggleWishlist}
                  isSelectModeActive={isSelectModeActive}
                  isSelected={selectedIds.includes(shirt.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No hay camisetas con esos filtros</h3>
              <p>Ajusta la búsqueda o añade una nueva pieza a la vitrina.</p>
            </div>
          )}
        </section>
      </div>

      <div className="floating-actions" ref={sortDropdownRef}>
        <button className="floating-add" type="button" onClick={openCreateForm}>
          + Añadir camiseta
        </button>

        <div className="sort-control">
          <button
            type="button"
            className="sort-icon-button"
            aria-haspopup="menu"
            aria-expanded={isSortOpen}
            onClick={() => setIsSortOpen((s) => !s)}
            title="Ordenar por"
          >
            ⇅
          </button>

          {isSortOpen && (
            <div className="sort-dropdown floating-up" role="menu">
              <button type="button" role="menuitem" onClick={() => { setSortBy("recent"); setIsSortOpen(false); }}>Más recientes</button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("oldest"); setIsSortOpen(false); }}>Más antiguas</button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("team-asc"); setIsSortOpen(false); }}>Equipo A-Z</button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("team-desc"); setIsSortOpen(false); }}>Equipo Z-A</button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("player-asc"); setIsSortOpen(false); }}>Jugador A-Z</button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("season-desc"); setIsSortOpen(false); }}>Temporada</button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("sport"); setIsSortOpen(false); }}>Deporte</button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("wishlist-first"); setIsSortOpen(false); }}>Wishlist primero</button>
            </div>
          )}
        </div>
      </div>

      {isSelectModeActive && (
        <div className="floating-selection-bar" role="toolbar" aria-label="Acciones selección">
          <div className="selection-count">✓ {selectedIds.length} seleccionadas</div>
          <div className="selection-actions">
            <button className="ghost-button" type="button" onClick={handleDeleteMultiple}>
              Eliminar seleccionadas
            </button>
            <button className="primary-button" type="button" onClick={handleMoveToCollection}>
              Mover a Colección
            </button>
            <button className="ghost-button" type="button" onClick={clearSelection}>
              Cancelar selección
            </button>
          </div>
        </div>
      )}

      {isFormOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Formulario camiseta">
          <div className="modal-shell">
            <ShirtForm
              form={form}
              editingShirt={editingShirt}
              typeOptions={typeOptions}
              countryOptions={countryOptions}
              leagueOptions={leagueOptions}
              allTeamOptions={allTeamOptions}
              onSubmit={handleSubmit}
              onCancel={closeForm}
              onSportChange={handleSportChange}
              onCategoryChange={handleCategoryChange}
              onCountryChange={handleCountryChange}
              onLeagueChange={handleLeagueChange}
              onTeamSelect={handleTeamSelect}
              onCustomTeam={handleCustomTeam}
              onFieldChange={handleFieldChange}
            />
          </div>
        </div>
      ) : null}

      {viewingShirt && (
        <ImageGalleryModal
          shirt={viewingShirt}
          isOpen={!!viewingShirtId}
          onClose={() => setViewingShirtId(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </main>
  );
}
