"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { StarRatingProps } from "@/lib/types/valoraciones";

const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
};

export function StarRating({ 
    rating, 
    onRatingChange, 
    readonly = false, 
    size = "md" 
}: StarRatingProps) {
    const stars = [1, 2, 3, 4, 5];

    const handleClick = (e: React.MouseEvent, value: number) => {
        e.stopPropagation();
        e.preventDefault();
        if (!readonly && onRatingChange) {
            onRatingChange(value);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, value: number) => {
        if (!readonly && onRatingChange && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onRatingChange(value);
        }
    };

    return (
        <div className="flex items-center gap-0.5" role="group" aria-label="Calificación">
            {stars.map((starValue) => {
                const isFilled = starValue <= rating;
                
                return (
                    <button
                        key={starValue}
                        type="button"
                        onClick={(e) => handleClick(e, starValue)}
                        onKeyDown={(e) => handleKeyDown(e, starValue)}
                        disabled={readonly}
                        className={cn(
                            "transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 rounded",
                            !readonly && "cursor-pointer hover:scale-110",
                            readonly && "cursor-default"
                        )}
                        aria-label={`${starValue} estrella${starValue > 1 ? 's' : ''}`}
                        aria-pressed={isFilled}
                    >
                        <Star
                            className={cn(
                                sizeClasses[size],
                                "transition-colors duration-150",
                                isFilled 
                                    ? "fill-yellow-400 text-yellow-400" 
                                    : "fill-transparent text-gray-300",
                                !readonly && !isFilled && "hover:text-yellow-300"
                            )}
                        />
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Componente de solo lectura para mostrar rating promedio
 */
export function StarRatingDisplay({ 
    rating, 
    size = "sm",
    showValue = true 
}: { 
    rating: number; 
    size?: 'sm' | 'md' | 'lg';
    showValue?: boolean;
}) {
    const roundedRating = Math.round(rating);
    
    return (
        <div className="flex items-center gap-1.5">
            <StarRating rating={roundedRating} readonly size={size} />
            {showValue && (
                <span className={cn(
                    "font-medium text-gray-700",
                    size === 'sm' && "text-sm",
                    size === 'md' && "text-base",
                    size === 'lg' && "text-lg"
                )}>
                    {rating.toFixed(1)}
                </span>
            )}
        </div>
    );
}

