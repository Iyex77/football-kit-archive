import React, { useRef } from "react";
import type { Shirt } from "../lib/types";
import { placeholderImages, statusLabels } from "../lib/collection-data";

type ShirtCardProps = {
  shirt: Shirt;
  onCardClick: (id: string) => void;
  onEdit: (shirt: Shirt) => void;
  onDelete: (id: string) => void;
  onToggleWishlist: (id: string) => void;
  isSelectModeActive?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  readOnly?: boolean;
};

export function ShirtCard({
  shirt,
  onCardClick,
  onEdit,
  onDelete,
  onToggleWishlist,
  isSelectModeActive = false,
  isSelected = false,
  onToggleSelect,
  readOnly = false,
}: ShirtCardProps) {
  const isWishlist = shirt.status === "wishlist";
  const mainImage = shirt.images.find((img) => img.id === shirt.mainImageId) || shirt.images[0];
  const imageUrl = mainImage?.url || placeholderImages[shirt.sport] || placeholderImages.default;
  const touchTimerRef = useRef<number | null>(null);
  const playerLabel = shirt.player.trim() || "Sin nombre";
  const playerNumberLabel = shirt.number.trim() ? `${playerLabel} · #${shirt.number.trim()}` : playerLabel;
  const locationLabel = [shirt.league.trim(), shirt.country.trim()].filter(Boolean).join(" · ");

  const handleBadgeClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!readOnly && isWishlist) {
      onToggleWishlist(shirt.id);
    }
  };

  const handleToggleSelect = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!readOnly) {
      onToggleSelect?.(shirt.id);
    }
  };

  const handleTouchStart = () => {
    if (readOnly) return;
    touchTimerRef.current = window.setTimeout(() => {
      onToggleSelect?.(shirt.id);
    }, 350);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  return (
    <article
      className={`shirt-card ${isSelectModeActive ? "selection-active" : ""} ${isSelected ? "is-selected" : ""}`}
      onClick={() => onCardClick(shirt.id)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="shirt-image-wrap">
        {!readOnly ? (
          <button
            className={`select-checkbox ${isSelected ? "checked" : ""}`}
            type="button"
            aria-pressed={isSelected}
            aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
            onClick={handleToggleSelect}
          >
            {isSelected ? "✓" : ""}
          </button>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${shirt.team} ${shirt.season}`}
          className="shirt-card-image"
          loading="lazy"
        />

        {!readOnly ? (
          <div className="shirt-card-actions">
            <button
              className="shirt-card-action-icon"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(shirt);
              }}
              aria-label="Editar camiseta"
            >
              ✎
            </button>
            <button
              className="shirt-card-action-icon"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(shirt.id);
              }}
              aria-label="Eliminar camiseta"
            >
              ×
            </button>
          </div>
        ) : null}
      </div>

      <div className="shirt-card-footer">
        <div className="shirt-card-info">
          <p className="shirt-card-team">{shirt.team} - {shirt.season}</p>
          <p className="shirt-card-player">{playerNumberLabel}</p>
          <p className="shirt-card-meta">{locationLabel || "Sin liga"}</p>
        </div>
        <button
          className={`shirt-card-badge ${isWishlist ? "badge-wishlist" : "badge-collection"}`}
          type="button"
          onClick={handleBadgeClick}
          aria-label={isWishlist ? "Mover a coleccion" : "Estado coleccion"}
          disabled={readOnly || !isWishlist}
        >
          {statusLabels[shirt.status]}
        </button>
      </div>
    </article>
  );
}
