"use client";

import { useEffect, useRef, useState } from "react";
import type { Shirt } from "../lib/types";
import { placeholderImages } from "../lib/collection-data";

type ImageGalleryModalProps = {
  shirt: Shirt;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (shirt: Shirt) => void;
  onDelete: (id: string) => void;
};

export function ImageGalleryModal({
  shirt,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset index cuando se abre un nuevo shirt
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen, shirt.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        handlePrev();
      } else if (event.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handlePrev = () => {
    if (shirt.images.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? shirt.images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    if (shirt.images.length <= 1) return;
    setCurrentIndex((prev) => (prev === shirt.images.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchEnd(e.changedTouches[0].clientX);
    handleSwipe();
  };

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  if (!isOpen) return null;

  const placeholderImage = {
    id: "placeholder",
    url: placeholderImages[shirt.sport] || placeholderImages.default,
    label: "Placeholder",
  };
  const currentImage = shirt.images[currentIndex] || shirt.images[0] || placeholderImage;

  return (
    <div className="gallery-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="gallery-modal-shell gallery-shell-premium" onClick={(e) => e.stopPropagation()}>
        <button
          className="gallery-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar galería"
        >
          ✕
        </button>

        <div className="gallery-premium-container">
          {/* Thumbnails vertical on the left */}
          {shirt.images.length > 1 && (
            <div className="gallery-thumbnails-vertical">
              {shirt.images.map((image, index) => (
                <button
                  key={image.id}
                  className={`gallery-thumbnail-vertical ${index === currentIndex ? "is-active" : ""}`}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Imagen ${index + 1}`}
                >
                  <img src={image.url} alt={`Thumbnail ${index + 1}`} />
                </button>
              ))}
            </div>
          )}

          {/* Main image viewer centered */}
          <div className="gallery-premium-viewer">
            <div
              className="gallery-image-container"
              ref={containerRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={currentImage.url}
                alt={`${shirt.team} ${currentIndex + 1}`}
                className="gallery-main-image"
              />

              {shirt.images.length > 1 && (
                <>
                  <button
                    className="gallery-nav-btn gallery-nav-prev"
                    onClick={handlePrev}
                    aria-label="Imagen anterior"
                  >
                    ◀
                  </button>
                  <button
                    className="gallery-nav-btn gallery-nav-next"
                    onClick={handleNext}
                    aria-label="Imagen siguiente"
                  >
                    ▶
                  </button>
                  <div className="gallery-counter">
                    {currentIndex + 1} / {shirt.images.length}
                  </div>
                </>
              )}
            </div>

            {/* Header with metadata at top right */}
            <div className="gallery-premium-header">
              <div className="gallery-meta-compact">
                <p>{shirt.season} • {shirt.team}</p>
                <p>
                  {shirt.player || "Sin nombre"}
                  {shirt.number ? ` • #${shirt.number}` : ""}
                </p>
              </div>
              <div className="gallery-header-actions">
                <button
                  className="gallery-icon-button"
                  type="button"
                  onClick={() => onEdit(shirt)}
                  aria-label="Editar camiseta"
                >
                  ✎
                </button>
                <button
                  className="gallery-icon-button"
                  type="button"
                  onClick={() => onDelete(shirt.id)}
                  aria-label="Eliminar camiseta"
                >
                  🗑
                </button>
              </div>
            </div>

            {/* Details section below */}
            <div className="gallery-details-compact">
              <div className="detail-compact-item">
                <span className="detail-label">Equipación</span>
                <span className="detail-value">{shirt.kitType}</span>
              </div>
              <div className="detail-compact-item">
                <span className="detail-label">Talla</span>
                <span className="detail-value">{shirt.size}</span>
              </div>
              <div className="detail-compact-item">
                <span className="detail-label">País</span>
                <span className="detail-value">{shirt.country}</span>
              </div>
              <div className="detail-compact-item">
                <span className="detail-label">Liga</span>
                <span className="detail-value">{shirt.league}</span>
              </div>
              {shirt.notes ? (
                <div className="detail-compact-item">
                  <span className="detail-label">Notas</span>
                  <span className="detail-value">{shirt.notes}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
