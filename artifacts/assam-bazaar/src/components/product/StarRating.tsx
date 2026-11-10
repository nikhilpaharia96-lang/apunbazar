/**
 * components/product/StarRating.tsx
 *
 * Extracted from ProductCard to follow DRY principle.
 * The original codebase rendered stars inline in every product display component.
 * This component is now the single source of truth for star rendering.
 */

import { Star } from "lucide-react";
import { memo } from "react";

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: number;
  color?: string;
}

export const StarRating = memo(function StarRating({
  rating,
  reviewCount,
  size = 11,
  color = "#774813",
}: StarRatingProps) {
  const roundedRating = Math.round(rating);

  return (
    <div
      className="flex items-center gap-0.5 mt-0.5"
      aria-label={`Rating: ${rating.toFixed(1)} out of 5${reviewCount ? `, ${reviewCount} reviews` : ""}`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= roundedRating ? color : "none"}
          stroke={color}
          aria-hidden
        />
      ))}
      <span
        className="font-semibold ml-1"
        style={{ fontSize: size + 1, color }}
      >
        {rating.toFixed(1)}
      </span>
      {reviewCount !== undefined && reviewCount > 0 && (
        <span className="text-gray-600 ml-0.5" style={{ fontSize: size }}>
          ({reviewCount})
        </span>
      )}
    </div>
  );
});
