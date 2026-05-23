import React, { useRef } from "react";
import type { Shirt } from "../lib/types";
import { placeholderImages } from "../lib/collection-data";

type ShirtCardProps = {
  shirt: Shirt;
  onCardClick: (id: string) => void; // click behaviour delegated to parent (open or select)
  onEdit: (shirt: Shirt) => void;
  onDelete: (id: string) => void;
  onToggleWishlist: (id: string) => void;
  // multi-select props
  isSelectModeActive?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
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
}: ShirtCardProps) {
  const isWishlist = shirt.status === "wishlist";
  const mainImage = shirt.images.find((img) => img.id === shirt.mainImageId) || shirt.images[0];
  const imageUrl = mainImage?.url || placeholderImages[shirt.sport] || placeholderImages.default;

  const handleBadgeClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    // Solo permitir Wishlist → Colección, no al revés
    if (isWishlist) {
      onToggleWishlist(shirt.id);
    }
  };

  const handleCardClick = () => {
    // if long-press triggered selection, skip opening
    onCardClick?.(shirt.id);
  };

  const handleToggleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(shirt.id);
  };

  // long-press support for touch devices to enter selection mode
  const touchTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    longPressedRef.current = false;
    touchTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      onToggleSelect?.(shirt.id);
    }, 350);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  return (
    <article
      className={`shirt-card ${isSelectModeActive ? "selection-active" : ""} ${isSelected ? "is-selected" : ""}`}
      onClick={handleCardClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="shirt-image-wrap">
        <button
          className={`select-checkbox ${isSelected ? "checked" : ""}`}
          type="button"
          aria-pressed={isSelected}
          aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
          onClick={handleToggleSelect}
        >
          {isSelected ? "✓" : ""}
        </button>
        {/* image here */}
        
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${shirt.team} ${shirt.season}`}
          className="shirt-card-image"
          loading="lazy"
        />

        <div className="shirt-card-actions">
          <button
            className="shirt-card-action-icon"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(shirt);
            }}
            aria-label="Editar camiseta"
          >
            ✎
          </button>
          <button
            className="shirt-card-action-icon"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(shirt.id);
            }}
            aria-label="Eliminar camiseta"
          >
            🗑
          </button>
        </div>
      </div>

      <div className="shirt-card-footer">
        <div className="shirt-card-info">
          <p className="shirt-card-team">{shirt.team}</p>
          <p className="shirt-card-player">
            {shirt.player || "Sin nombre"}
            {shirt.number ? ` • #${shirt.number}` : ""}
          </p>
        </div>
        <button
          className={`shirt-card-badge ${isWishlist ? "badge-wishlist" : "badge-collection"}`}
          type="button"
          onClick={handleBadgeClick}
          aria-label={isWishlist ? "Mover a colección" : "Estado colección"}
          disabled={!isWishlist}
        >
          {isWishlist ? "☆ Wishlist" : "✓ Colección"}
        </button>
      </div>
    </article>
  );
}
