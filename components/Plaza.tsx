// components/Plaza.tsx
'use client';
import { cn } from "@/lib/utils";

interface PlazaProps {
    numero: number;
    ocupado: boolean;
    abonado?: boolean; // Nuevo prop para estado abonado
    tipo?: string; // Tipo de plaza (Auto, Moto, Camioneta)
    onClick: () => void;
}

export function Plaza({ numero, ocupado, abonado = false, tipo = 'Auto', onClick }: PlazaProps) {
    const getButtonStyles = () => {
        if (abonado) {
            // Estado Abonado: gris, no clickeable
            return "bg-gray-500 hover:bg-gray-500 cursor-not-allowed opacity-75";
        } else if (ocupado) {
            // Estado Ocupada: rojo, no clickeable
            return "bg-red-600 hover:bg-red-700 cursor-not-allowed";
        } else {
            // Estado Libre: verde, clickeable
            return "bg-green-600 hover:bg-green-700 cursor-pointer";
        }
    };

    const handleClick = () => {
        // Solo permitir click si está libre (no ocupado ni abonado)
        if (!ocupado && !abonado) {
            onClick();
        }
    };

    const getTooltipText = () => {
        if (abonado) {
            return `Plaza ${numero} - ${tipo} (Abonada)`;
        } else if (ocupado) {
            return `Plaza ${numero} - ${tipo} (Ocupada)`;
        } else {
            return `Plaza ${numero} - ${tipo} (Libre)`;
        }
    };

    return (
        <div className="relative group z-20">
            <button
                onClick={handleClick}
                className={cn(
                    "w-12 h-12 flex items-center justify-center rounded-md text-white font-bold text-sm transition-transform duration-150",
                    getButtonStyles(),
                    !ocupado && !abonado && "hover:scale-110" // Solo hover effect para plazas libres
                )}
            >
                {numero}
            </button>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {getTooltipText()}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
        </div>
    );
}





