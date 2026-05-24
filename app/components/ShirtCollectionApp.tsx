"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase-auth";
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

type SortBy =
  | "recent"
  | "oldest"
  | "team-asc"
  | "team-desc"
  | "player-asc"
  | "player-desc"
  | "number-asc"
  | "number-desc"
  | "season-desc"
  | "sport"
  | "wishlist-first";

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

interface ShirtCollectionAppProps {
  onLogout?: () => Promise<void> | void;
}

export function ShirtCollectionApp({ onLogout }: ShirtCollectionAppProps) {
  const [shirts, setShirts] = useState<Shirt[]>(initialShirts);
  const [form, setForm] = useState<ShirtFormState>(defaultForm);
  const [filters, setFilters] = useState<ShirtFilters>(emptyFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingShirtId, setViewingShirtId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<
    | { type: "single"; id: string }
    | { type: "multiple"; count: number }
    | null
  >(null);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    loadShirts();
  }, []);

  useEffect(() => {
    if (!isSortOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSortOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isSortOpen]);

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
  const getIdTimestamp = (id: string) => {
    const [, timestamp] = id.split("-");
    const value = Number(timestamp);
    return Number.isNaN(value) ? 0 : value;
  };

  const numberValue = (value: string | number | undefined) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };

  const sortedShirts = (() => {
    const list = [...filteredShirts];
    switch (sortBy) {
      case "recent":
        return list.sort((a, b) => getIdTimestamp(b.id) - getIdTimestamp(a.id));
      case "oldest":
        return list.sort((a, b) => getIdTimestamp(a.id) - getIdTimestamp(b.id));
      case "team-asc":
        return list.sort((a, b) => a.team.localeCompare(b.team, undefined, { sensitivity: "base" }));
      case "team-desc":
        return list.sort((a, b) => b.team.localeCompare(a.team, undefined, { sensitivity: "base" }));
      case "player-asc":
        return list.sort((a, b) =>
          (a.player || "").localeCompare(b.player || "", undefined, { sensitivity: "base" }),
        );
      case "player-desc":
        return list.sort((a, b) =>
          (b.player || "").localeCompare(a.player || "", undefined, { sensitivity: "base" }),
        );
      case "number-asc":
        return list.sort((a, b) => numberValue(a.number) - numberValue(b.number));
      case "number-desc":
        return list.sort((a, b) => {
          const left = numberValue(a.number);
          const right = numberValue(b.number);
          if (left === Number.NEGATIVE_INFINITY && right === Number.NEGATIVE_INFINITY) return 0;
          if (left === Number.NEGATIVE_INFINITY) return -1;
          if (right === Number.NEGATIVE_INFINITY) return -1;
          return right - left;
        });
      case "season-desc":
        return list.sort((a, b) =>
          (b.season || "").localeCompare(a.season || "", undefined, { sensitivity: "base" }),
        );
      case "sport":
        return list.sort((a, b) => a.sport.localeCompare(b.sport, undefined, { sensitivity: "base" }));
      case "wishlist-first":
        return list.sort((a, b) => (a.status === b.status ? 0 : a.status === "wishlist" ? -1 : 1));
      default:
        return list;
    }
  })();
  const filterOptions = getFilterOptions(shirts, filters);

  const collectionCount = shirts.filter((shirt) => shirt.status === "collection").length;
  const wishlistCount = shirts.filter((shirt) => shirt.status === "wishlist").length;

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("No hay sesión activa");
    return;
    }

    const payload: any = {
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
      user_id: user.id,
    };


    let result;

    if (editingId) {
      result = await supabase
        .from("shirts")
        .update(payload)
        .eq("id", editingId)
        .select();
    } else {
      result = await supabase
        .from("shirts")
        .insert([payload])
        .select();
    }


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

  const handleDeleteRequested = (id: string) => {
    setDeleteConfirmation({ type: "single", id });
  };

  const handleDeleteMultipleRequested = () => {
    if (selectedIds.length === 0) return;
    setDeleteConfirmation({ type: "multiple", count: selectedIds.length });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.type === "single") {
      await handleDelete(deleteConfirmation.id);
    } else {
      setShirts((current) => current.filter((shirt) => !selectedIds.includes(shirt.id)));
      clearSelection();
    }

    setDeleteConfirmation(null);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const handleDelete = async (id: string) => {
    const shirt = shirts.find((s) => s.id === id);

    if (!shirt) return;

    // BORRAR IMÁGENES STORAGE
    if (shirt.images?.length) {

      const filesToDelete = shirt.images
        .map((img) => {

          console.log("RAW URL:", img.url);

          if (!img.url.includes("/storage/v1/object/public/shirts/")) {
            return null;
          }

          return img.url.split(
            "/storage/v1/object/public/shirts/"
          )[1];

        })
        .filter((file): file is string => Boolean(file))

      if (filesToDelete.length) {

        console.log("SHIRT IMAGES:", shirt.images);

        console.log(
          "FILES TO DELETE:",
          filesToDelete
        );
      
        const result =
          await supabase.storage
            .from("shirts")
            .remove(filesToDelete);
      
        console.log(
          "STORAGE DELETE RESULT:",
          result
        );
      }
    }

    // BORRAR ROW BD
    const { error } = await supabase
      .from("shirts")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadShirts();

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

          {onLogout ? (
            <div className="mt-6 sm:mt-0">
              <button
                type="button"
                className="rounded-full border border-slate-600 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-900"
                onClick={onLogout}
              >
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </header>

        <section className="space-y-7">
          <FiltersBar
            filters={filters}
            leagues={filterOptions.leagues}
            onFilterChange={handleFilterChange}
            onReset={() => setFilters(emptyFilters)}
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
                  onDelete={handleDeleteRequested}
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

      <div className="floating-actions">
        <button className="floating-add" type="button" onClick={openCreateForm}>
          + Añadir camiseta
        </button>

        <div className="sort-control" ref={sortDropdownRef}>
          <button
            type="button"
            className="sort-icon-button"
            aria-haspopup="menu"
            aria-expanded={isSortOpen}
            onClick={() => setIsSortOpen((current) => !current)}
            title="Ordenar por"
          >
            ⇅
          </button>

          {isSortOpen && (
            <div className="sort-dropdown floating-up" role="menu">
              <button type="button" role="menuitem" onClick={() => { setSortBy("recent"); setIsSortOpen(false); }}>
                Más recientes
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("oldest"); setIsSortOpen(false); }}>
                Más antiguas
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("team-asc"); setIsSortOpen(false); }}>
                Equipo A-Z
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("team-desc"); setIsSortOpen(false); }}>
                Equipo Z-A
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("player-asc"); setIsSortOpen(false); }}>
                Jugador A-Z
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("player-desc"); setIsSortOpen(false); }}>
                Jugador Z-A
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("number-asc"); setIsSortOpen(false); }}>
                Dorsal menor a mayor
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("number-desc"); setIsSortOpen(false); }}>
                Dorsal mayor a menor
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("season-desc"); setIsSortOpen(false); }}>
                Temporada
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("sport"); setIsSortOpen(false); }}>
                Deporte
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("wishlist-first"); setIsSortOpen(false); }}>
                Wishlist primero
              </button>
            </div>
          )}
        </div>

        {(filters.search.trim() !== "" || filters.sport !== "all" || filters.league !== "all" || filters.status !== "all") && (
          <button
            className="floating-reset-button"
            type="button"
            onClick={() => setFilters(emptyFilters)}
            aria-label="Restablecer filtros"
          >
            ✕
          </button>
        )}
      </div>

      {isSelectModeActive && (
        <div className="floating-selection-bar" role="toolbar" aria-label="Acciones selección">
          <div className="selection-count">✓ {selectedIds.length} seleccionadas</div>
          <div className="selection-actions">
            <button className="ghost-button" type="button" onClick={handleDeleteMultipleRequested}>
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
          onDelete={handleDeleteRequested}
        />
      )}

      {deleteConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-8 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/90 to-slate-900 opacity-90"></div>
          <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/85 p-7 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition duration-300 ease-out hover:-translate-y-1">
            <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm shadow-slate-950/20 backdrop-blur-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-red-500/15 text-red-300 ring-1 ring-red-400/20">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Acción destructiva</p>
                <h3 className="text-lg font-semibold text-white">Eliminar camiseta</h3>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <p className="text-2xl font-semibold leading-tight text-white">¿Seguro que quieres eliminar {deleteConfirmation.type === "multiple" ? `${deleteConfirmation.count} camisetas` : "esta camiseta"}?</p>
              <p className="text-sm leading-6 text-slate-400">
                Esta acción no se puede deshacer. Las imágenes vinculadas también se eliminarán permanentemente.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="group rounded-3xl border border-slate-700/80 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-200 shadow-sm shadow-slate-950/20 transition duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-3xl bg-gradient-to-r from-red-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
              >
                Eliminar ahora
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-700/60 bg-slate-900/70 px-4 py-4 text-sm text-slate-400 shadow-inner shadow-slate-950/20">
              <p className="font-medium text-slate-200">Consejo:</p>
              <p className="mt-1 leading-6">Si prefieres conservar la camiseta, selecciona <span className="font-semibold text-slate-100">Cancelar</span> y revisa tu colección.</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
