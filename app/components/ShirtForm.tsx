import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  categoryLabels,
  kitTypes,
  sizes,
  sportLabels,
  statusLabels,
} from "../lib/collection-data";
import type {
  Shirt,
  ShirtCategory,
  ShirtFormState,
  ShirtImage,
  ShirtStatus,
  Sport,
  TeamOption,
} from "../lib/types";
import { placeholderImages } from "../lib/collection-data";
import { createSmartAutofillPatch, parseSmartAutofillText } from "../lib/smart-autofill";
import { DatalistField, SelectField, TextAreaField, TextField } from "./FormControls";
import { supabase } from "../../lib/supabase-auth";
import { notify } from "../lib/notify";

type ShirtFormProps = {
  form: ShirtFormState;
  editingShirt: Shirt | undefined;
  typeOptions: ShirtCategory[];
  countryOptions: string[];
  leagueOptions: string[];
  allTeamOptions: TeamOption[];
  onSubmit: () => void;
  onCancel: () => void;
  onSportChange: (sport: Sport | "") => void;
  onCategoryChange: (category: ShirtCategory | "") => void;
  onCountryChange: (country: string) => void;
  onLeagueChange: (league: string) => void;
  onTeamSelect: (option: TeamOption) => void;
  onCustomTeam: (value: string) => void;
  onFieldChange: <K extends keyof ShirtFormState>(field: K, value: ShirtFormState[K]) => void;
};

const sportOptions: Sport[] = ["football", "basketball"];
const statusOptions: ShirtStatus[] = ["collection", "wishlist"];
const acceptedShirtImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxShirtImageSize = 8 * 1024 * 1024;
const createGoogleImageSearchQuery = (form: ShirtFormState) => {
  const team = form.team === "custom" ? form.customTeam : form.team;
  const query = [team, form.season, form.player, "football shirt front png"]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  return query;
};

const smartAutofillLabels: Partial<Record<keyof ShirtFormState, string>> = {
  sport: "deporte",
  category: "tipo",
  country: "país",
  league: "liga",
  team: "equipo",
  customTeam: "equipo",
  season: "temporada",
  player: "jugador",
  number: "dorsal",
  kitType: "equipación",
  size: "talla",
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

type TeamAutocompleteProps = {
  value: string;
  options: TeamOption[];
  onSelect: (option: TeamOption) => void;
  onCustom: (value: string) => void;
};

function TeamAutocomplete({ value, options, onSelect, onCustom }: TeamAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const query = value;
  const normalizedQuery = normalize(query);
  const matches = normalizedQuery
    ? options
        .filter((option) => normalize(option.team).includes(normalizedQuery))
        .slice(0, 8)
    : options.slice(0, 6);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (value: string) => {
    onCustom(value);
    setIsOpen(true);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (wrapperRef.current && document.activeElement && !wrapperRef.current.contains(document.activeElement)) {
        setIsOpen(false);
      }
    }, 0);
  };

  const handleSelect = (option: TeamOption) => {
    onSelect(option);
    setIsOpen(false);
  };

  const handleCustom = () => {
    onCustom(query);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="team-autocomplete sm:col-span-2">
      <label className="field">
        <span>Equipo *</span>
        <input
          autoComplete="off"
          value={query}
          placeholder="Busca por equipo: atleti, realm, liver..."
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onChange={(event) => handleInputChange(event.target.value)}
          aria-required="true"
        />
      </label>

      {isOpen ? (
        <div className="team-suggestions">
          {matches.length > 0 ? (
            matches.map((option) => (
              <button
                key={option.id}
                type="button"
                className="team-suggestion-item"
                onClick={() => handleSelect(option)}
              >
                <strong>{option.team}</strong>
                <span>
                  {option.country} • {option.league} • {sportLabels[option.sport]}
                </span>
              </button>
            ))
          ) : (
            <div className="team-suggestion-empty">No hay resultados para esa búsqueda</div>
          )}

          <button type="button" className="custom-team-option" onClick={handleCustom}>
            <strong>Otro equipo</strong>
            <span>Escribe un equipo personalizado</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ShirtForm({
  form,
  editingShirt,
  typeOptions,
  countryOptions,
  leagueOptions,
  allTeamOptions,
  onSubmit,
  onCancel,
  onSportChange,
  onCategoryChange,
  onCountryChange,
  onLeagueChange,
  onTeamSelect,
  onCustomTeam,
  onFieldChange,
}: ShirtFormProps) {
  const isCustomTeam = form.team === "custom";
  const [isDragging, setIsDragging] = useState(false);
  const [smartAutofillText, setSmartAutofillText] = useState("");
  const [suggestedImageSearch, setSuggestedImageSearch] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isImportingImage, setIsImportingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragStart = (_event: DragStartEvent) => {
    setIsDragging(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = form.images.findIndex((i) => i.id === String(active.id));
      const newIndex = form.images.findIndex((i) => i.id === String(over.id));
      if (oldIndex >= 0 && newIndex >= 0) {
        const newImages = arrayMove(form.images, oldIndex, newIndex);
        onFieldChange("images", newImages);
      }
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notify.error("Inicia sesión para subir imágenes.");
      return;
    }

    for (const file of Array.from(files)) {
      if (!acceptedShirtImageTypes.includes(file.type)) {
        notify.error("La imagen debe ser JPG, PNG o WebP.");
        continue;
      }

      if (file.size > maxShirtImageSize) {
        notify.error("La imagen no puede superar los 8 MB.");
        continue;
      }

      const extension = file.name.split(".").pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const result = await supabase.storage
        .from("shirts")
        .upload(fileName, file, { contentType: file.type });

      const uploadError = result.error;

      if (uploadError) {
        console.error("UPLOAD ERROR:", uploadError);
        notify.error("Error subiendo imagen. Intenta otra vez.");
        continue;
      }

      const { data } = supabase.storage
        .from("shirts")
        .getPublicUrl(fileName);

      const newImage: ShirtImage = {
        id: `img-${crypto.randomUUID()}`,
        url: data.publicUrl,
        label: "",
      };

      const updatedImages = [...form.images, newImage];

      onFieldChange("images", updatedImages);

      if (!form.mainImageId) {
        onFieldChange("mainImageId", newImage.id);
      }
    }
  };


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleRemoveImage = (imageId: string) => {
    const newImages = form.images.filter((img) => img.id !== imageId);
    onFieldChange("images", newImages);

    if (form.mainImageId === imageId) {
      onFieldChange("mainImageId", newImages[0]?.id || "");
    }
  };

  const handleSetMainImage = (imageId: string) => {
    onFieldChange("mainImageId", imageId);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handleSmartAutofill = () => {
    const sourceText = smartAutofillText.trim();
    if (!sourceText) {
      notify.error("Pega o escribe un texto para autorrellenar.");
      return;
    }

    const parsed = parseSmartAutofillText(sourceText, allTeamOptions);
    const patch = createSmartAutofillPatch(form, parsed);
    const fields = Object.keys(patch) as (keyof ShirtFormState)[];
    const parsedUsefulData = Boolean(
      parsed.teamOption ||
        parsed.customTeam ||
        parsed.country ||
        parsed.league ||
        parsed.season ||
        parsed.player,
    );
    const nextForm = { ...form, ...patch };

    if (fields.length > 0 || parsedUsefulData) {
      setSuggestedImageSearch(createGoogleImageSearchQuery(nextForm));
    }

    if (fields.length === 0) {
      notify.error("No se han encontrado campos nuevos para rellenar.");
      return;
    }

    fields.forEach((field) => {
      onFieldChange(field, patch[field] as ShirtFormState[typeof field]);
    });

    const fieldList = fields
      .map((field) => smartAutofillLabels[field])
      .filter(Boolean)
      .filter((label, index, labels) => labels.indexOf(label) === index)
      .join(", ");

    notify.success(`Autorrellenado: ${fieldList}.`);
  };

  const handleGoogleImageSearch = () => {
    const query = suggestedImageSearch.trim();
    if (!query) return;

    window.open(
      `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleImportImageUrl = async () => {
    const sourceUrl = imageUrl.trim();
    if (!sourceUrl) {
      notify.error("Pega una URL directa de imagen.");
      return;
    }

    setIsImportingImage(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/import-image", {
        method: "POST",
        headers,
        body: JSON.stringify({ imageUrl: sourceUrl }),
      });
      const data = (await response.json().catch(() => null)) as {
        id?: string;
        label?: string;
        path?: string;
        publicUrl?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.publicUrl) {
        notify.error(data?.error ?? "No se pudo importar esta imagen. Prueba con otra URL directa.");
        return;
      }

      const newImage: ShirtImage = {
        id: data.id ?? `img-${crypto.randomUUID()}`,
        url: data.publicUrl,
        label: data.label ?? "",
      };

      onFieldChange("images", [...form.images, newImage]);

      if (!form.mainImageId) {
        onFieldChange("mainImageId", newImage.id);
      }

      setImageUrl("");
      notify.success("Imagen importada correctamente.");
    } catch {
      notify.error("Error importando la imagen.");
    } finally {
      setIsImportingImage(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <p>{editingShirt ? "Edición" : "Nueva pieza"}</p>
          <h2>{editingShirt ? "Editar camiseta" : "Nueva camiseta"}</h2>
        </div>
        <button className="icon-button" type="button" aria-label="Cerrar formulario" onClick={onCancel}>
          x
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="smart-autofill sm:col-span-2">
          <div className="smart-autofill-row">
            <label className="field">
              <span>Autorrellenar desde texto</span>
              <textarea
                value={smartAutofillText}
                placeholder="Ej: Atlético de Madrid 2020/21 Koke 6 Local 4XL"
                rows={2}
                onChange={(event) => setSmartAutofillText(event.target.value)}
              />
            </label>
            <div className="smart-actions">
              <button className="smart-autofill-button" type="button" onClick={handleSmartAutofill}>
                Autorrellenar
              </button>
              {suggestedImageSearch ? (
                <button className="smart-secondary-button" type="button" onClick={handleGoogleImageSearch}>
                  Buscar imagen en Google
                </button>
              ) : null}
            </div>
          </div>

          <div className="smart-autofill-row">
            <label className="field">
              <span>URL de imagen</span>
              <input
                type="url"
                value={imageUrl}
                placeholder="https://..."
                onChange={(event) => setImageUrl(event.target.value)}
              />
            </label>
            <button
              className="smart-autofill-button"
              type="button"
              onClick={handleImportImageUrl}
              disabled={isImportingImage}
            >
              {isImportingImage ? "Importando..." : "Importar"}
            </button>
          </div>
        </div>

        <TeamAutocomplete
          value={isCustomTeam ? form.customTeam : form.team}
          options={allTeamOptions}
          onSelect={onTeamSelect}
          onCustom={onCustomTeam}
        />

        {isCustomTeam ? (
          <>
            <SelectField
              label="Deporte"
              value={form.sport}
              options={sportOptions}
              placeholder="Selecciona deporte"
              getLabel={(value) => sportLabels[value]}
              onChange={onSportChange}
            />
            <SelectField
              label="Tipo"
              value={form.category}
              options={typeOptions}
              placeholder="Selecciona tipo"
              getLabel={(value) => categoryLabels[value]}
              onChange={onCategoryChange}
            />
            <DatalistField
              label="País"
              value={form.country}
              options={countryOptions}
              listId="shirt-country-options"
              placeholder="País del club o selección"
              onChange={onCountryChange}
            />
            <DatalistField
              label="Liga"
              value={form.league}
              options={leagueOptions}
              listId="shirt-league-options"
              placeholder="Liga o competición"
              onChange={onLeagueChange}
            />
          </>
        ) : form.team ? (
          <div className="auto-summary sm:col-span-2">
            <span>{sportLabels[form.sport as keyof typeof sportLabels] || "-"}</span>
            <span>{categoryLabels[form.category as keyof typeof categoryLabels] || "-"}</span>
            <span>{form.country || "-"}</span>
            <span>{form.league || "-"}</span>
          </div>
        ) : (
          <div className="auto-summary auto-summary-hint sm:col-span-2">
            Elige un equipo del listado para rellenar deporte, tipo, país y liga.
          </div>
        )}

        <div className="image-upload sm:col-span-2">
          <div
            className={`image-dropzone ${isDragging ? "is-dragging" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <div className="image-drop-content">
              <strong>
                {form.images.length > 0 ? "Añadir más imágenes" : "Arrastra o selecciona imágenes"}
              </strong>
              <span>
                {form.images.length > 0
                  ? "Toca para seleccionar más imágenes desde tu dispositivo."
                  : "PNG, JPG o WebP desde PC o móvil. Múltiples archivos permitidos."}
              </span>
            </div>
          </div>

          {form.images.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={form.images.map((i) => i.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div
                  className="image-gallery"
                  style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", overflowX: "auto" }}
                >
                  {form.images.map((image) => {
                    function SortableThumb() {
                      const { attributes, listeners, setNodeRef, transform, transition, isDragging: itemDragging } = useSortable({ id: image.id });
                      const style: React.CSSProperties = {
                        transform: CSS.Transform.toString(transform) || undefined,
                        transition,
                        zIndex: itemDragging ? 40 : undefined,
                        cursor: "default",
                        minWidth: 100,
                        width: 100,
                        flex: "0 0 100px",
                        position: "relative",
                      };

                      const handleStyle: React.CSSProperties = {
                        position: "absolute",
                        top: 6,
                        left: 6,
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.35)",
                        color: "white",
                        cursor: "grab",
                        zIndex: 45,
                        border: "1px solid rgba(255,255,255,0.06)",
                      };

                      return (
                        <div
                          ref={setNodeRef}
                          style={style}
                          className={`gallery-item ${image.id === form.mainImageId ? "is-main" : ""}`}
                        >
                          <button
                            type="button"
                            aria-label="Reordenar imagen"
                            title="Arrastrar para reordenar"
                            style={handleStyle}
                            {...attributes}
                            {...listeners}
                            onClick={(e) => e.stopPropagation()}
                          >
                            ☰
                          </button>

                          <img src={image.url} alt="Imagen camiseta" />
                          <div className="gallery-item-actions">
                            {image.id !== form.mainImageId && (
                              <button
                                type="button"
                                className="gallery-action-btn gallery-main-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetMainImage(image.id);
                                }}
                                title="Establecer como imagen principal"
                              >
                                ★
                              </button>
                            )}
                            <button
                              type="button"
                              className="gallery-action-btn gallery-remove-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveImage(image.id);
                              }}
                              title="Eliminar imagen"
                            >
                              ✕
                            </button>
                          </div>
                          {image.id === form.mainImageId && <span className="main-badge">Principal</span>}
                        </div>
                      );
                    }

                    return <SortableThumb key={image.id} />;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="image-placeholder-card">
              <img
                src={placeholderImages[form.sport || "football"] || placeholderImages.default}
                alt="Placeholder camiseta"
              />
              <p className="image-helper">
                Esta camiseta no tiene imágenes. Se usará un placeholder según el deporte.
              </p>
            </div>
          )}
        </div>

        <TextField
          required
          label="Temporada *"
          value={form.season}
          placeholder="2025/26"
          onChange={(value) => onFieldChange("season", value)}
        />
        <SelectField
          label="Ubicación"
          value={form.status}
          options={statusOptions}
          placeholder="Selecciona ubicación"
          getLabel={(value) => statusLabels[value]}
          onChange={(value) => onFieldChange("status", value)}
        />
        <TextField
          label="Jugador"
          value={form.player}
          placeholder="Nombre o camiseta sin nombre"
          onChange={(value) => onFieldChange("player", value)}
        />
        <TextField
          label="Dorsal"
          value={form.number}
          placeholder="10"
          onChange={(value) => onFieldChange("number", value)}
        />
        <SelectField
          label="Equipación *"
          value={form.kitType}
          options={kitTypes}
          placeholder="Selecciona equipación"
          required
          onChange={(value) => onFieldChange("kitType", value)}
        />
        <SelectField
          label="Talla"
          value={form.size}
          options={sizes}
          placeholder="Selecciona talla"
          onChange={(value) => onFieldChange("size", value)}
        />
        <TextAreaField
          label="Notas"
          value={form.notes}
          placeholder="Parche, versión, tienda o detalles especiales..."
          onChange={(value) => onFieldChange("notes", value)}
        />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="ghost-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button" type="submit">
          {editingShirt ? "Guardar cambios" : "Añadir camiseta"}
        </button>
      </div>
    </form>
  );
}
