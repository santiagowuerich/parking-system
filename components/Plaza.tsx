// components/Plaza.tsx
'use client';
import { cn } from "@/lib/utils";

interface PlazaProps {
    numero: number;
    ocupado: boolean;
    onClick: () => void;
}

export function Plaza({ numero, ocupado, onClick }: PlazaProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-12 h-12 flex items-center justify-center rounded-md text-white font-bold text-sm transition-transform duration-150 hover:scale-110",
                ocupado ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
            )}
        >
            {numero}
        </button>
    );
}




