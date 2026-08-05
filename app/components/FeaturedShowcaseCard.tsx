import { useTilt } from "../lib/useTilt";
import { ShirtCard } from "./ShirtCard";
import type { Shirt } from "../lib/types";

type FeaturedShowcaseCardProps = {
  shirt: Shirt;
  order: number;
  isPrimary: boolean;
  onCardClick: (id: string) => void;
  onEdit: (shirt: Shirt) => void;
  onDelete: (id: string) => void;
  onToggleWishlist: (id: string) => void;
  isSelectModeActive?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  readOnly?: boolean;
};

export function FeaturedShowcaseCard({
  shirt,
  order,
  isPrimary,
  ...shirtCardProps
}: FeaturedShowcaseCardProps) {
  const tiltRef = useTilt<HTMLDivElement>();

  return (
    <div ref={tiltRef} className={`featured-card-shell ${isPrimary ? "is-primary" : ""}`}>
      <span className="featured-card-order">{isPrimary ? "#1 destacada" : `#${order}`}</span>
      <div className="featured-card-pedestal" aria-hidden="true" />
      <ShirtCard shirt={shirt} {...shirtCardProps} />
      <div className="featured-card-sheen" aria-hidden="true" />
    </div>
  );
}
