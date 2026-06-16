"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Shirt } from "../lib/types";
import { placeholderImages } from "../lib/collection-data";

type ImageGalleryModalProps = {
  shirt: Shirt;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (shirt: Shirt) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
};

export function ImageGalleryModal({
  shirt,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  readOnly = false,
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStart = useRef(0);

  const safeCurrentIndex = currentIndex >= shirt.images.length ? 0 : currentIndex;

  const handlePrev = useCallback(() => {
    if (shirt.images.length <= 1) return;
    setCurrentIndex((current) => (current === 0 ? shirt.images.length - 1 : current - 1));
  }, [shirt.images.length]);

  const handleNext = useCallback(() => {
    if (shirt.images.length <= 1) return;
    setCurrentIndex((current) => (current === shirt.images.length - 1 ? 0 : current + 1));
  }, [shirt.images.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") handlePrev();
      if (event.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, isOpen, onClose]);

  if (!isOpen) return null;

  const placeholderImage = {
    id: "placeholder",
    url: placeholderImages[shirt.sport] || placeholderImages.default,
    label: "Placeholder",
  };
  const currentImage = shirt.images[safeCurrentIndex] || shirt.images[0] || placeholderImage;

  return (
    <div className="gallery-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="gallery-modal-shell gallery-shell-premium" onClick={(event) => event.stopPropagation()}>
        <button className="gallery-modal-close" type="button" onClick={onClose} aria-label="Cerrar galería">
          ×
        </button>

        <div className="gallery-premium-container">
          {shirt.images.length > 1 ? (
            <div className="gallery-thumbnails-vertical">
              {shirt.images.map((image, index) => (
                <button
                  key={image.id}
                  className={`gallery-thumbnail-vertical ${index === safeCurrentIndex ? "is-active" : ""}`}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Imagen ${index + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={`Thumbnail ${index + 1}`} />
                </button>
              ))}
            </div>
          ) : null}

          <div className="gallery-premium-viewer">
            <div
              className="gallery-image-container"
              onTouchStart={(event) => {
                touchStart.current = event.targetTouches[0].clientX;
              }}
              onTouchEnd={(event) => {
                const distance = touchStart.current - event.changedTouches[0].clientX;
                if (distance > 50) handleNext();
                if (distance < -50) handlePrev();
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage.url}
                alt={`${shirt.team} ${safeCurrentIndex + 1}`}
                className="gallery-main-image"
              />

              {shirt.images.length > 1 ? (
                <>
                  <button className="gallery-nav-btn gallery-nav-prev" onClick={handlePrev} aria-label="Imagen anterior">
                    ‹
                  </button>
                  <button className="gallery-nav-btn gallery-nav-next" onClick={handleNext} aria-label="Imagen siguiente">
                    ›
                  </button>
                  <div className="gallery-counter">
                    {safeCurrentIndex + 1} / {shirt.images.length}
                  </div>
                </>
              ) : null}
            </div>

            <div className="gallery-premium-header">
              <div className="gallery-meta-compact">
                <p>
                  {shirt.season} · {shirt.team}
                </p>
                <p>
                  {shirt.player || "Sin nombre"}
                  {shirt.number ? ` · #${shirt.number}` : ""}
                </p>
              </div>

              {!readOnly ? (
                <div className="gallery-header-actions">
                  <button
                    className="gallery-icon-button"
                    type="button"
                    onClick={() => onEdit(shirt)}
                    aria-label="Editar camiseta"
                  >
                    Editar
                  </button>
                  <button
                    className="gallery-icon-button"
                    type="button"
                    onClick={() => onDelete(shirt.id)}
                    aria-label="Eliminar camiseta"
                  >
                    Eliminar
                  </button>
                </div>
              ) : null}
            </div>

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
