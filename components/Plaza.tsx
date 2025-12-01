// components/Plaza.tsx
'use client';
import { cn } from "@/lib/utils";

interface PlazaProps {
    numero: number;
    ocupado: boolean;
    abonado?: boolean; // Nuevo prop para estado abonado
    tipo?: string; // Tipo de plaza (Auto, Moto, Camioneta)
    onClick: () => void;
    selected?: boolean; // Nuevo prop para indicar si la plaza está seleccionada
}

export function Plaza({ numero, ocupado, abonado = false, tipo = 'Auto', onClick, selected = false }: PlazaProps) {
    const getButtonStyles = () => {
        if (selected) {
            // Estado Seleccionado: azul brillante con outline interno para evitar desplazamiento
            return "bg-blue-600 hover:bg-blue-600 cursor-pointer";
        } else if (abonado) {
            // Estado Abonado: gris, no clickeable
            return "bg-gray-500 hover:bg-gray-500 cursor-not-allowed opacity-75";
        } else if (ocupado) {
            // Estado Ocupada: rojo, no clickeable
            return "bg-red-600 hover:bg-red-600 cursor-not-allowed";
        } else {
            // Estado Libre: verde, clickeable sin efecto de escala
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
        if (selected) {
            return `Plaza ${numero} - ${tipo} (Seleccionada)`;
        } else if (abonado) {
            return `Plaza ${numero} - ${tipo} (Abonada)`;
        } else if (ocupado) {
            return `Plaza ${numero} - ${tipo} (Ocupada)`;
        } else {
            return `Plaza ${numero} - ${tipo} (Libre)`;
        }
    };

    return (
        <div 
            className="relative group" 
            style={{ 
                transform: 'none !important',
                position: 'relative', 
                width: '100%', 
                height: '100%',
                contain: 'layout style paint'
            }}
        >
            <button
                onClick={handleClick}
                className={cn(
                    "w-full h-full flex items-center justify-center rounded-md text-white font-bold text-base transition-colors duration-150 border-2",
                    "box-border", // Asegurar que el border esté incluido en el tamaño
                    selected 
                        ? "border-blue-300" 
                        : ocupado 
                            ? "border-red-800" 
                            : abonado 
                                ? "border-gray-600" 
                                : "border-green-800",
                    getButtonStyles()
                )}
                style={{ 
                    transform: 'none !important',
                    willChange: 'auto',
                    backfaceVisibility: 'visible',
                    position: 'relative',
                    margin: 0,
                    padding: 0,
                    boxSizing: 'border-box',
                    width: '100%',
                    height: '100%',
                    flexShrink: 0,
                    contain: 'layout style paint'
                }}
                onMouseEnter={(e) => {
                    const btn = e.currentTarget;
                    btn.style.transform = 'none';
                    btn.style.margin = '0';
                    btn.style.padding = '0';
                    btn.style.width = '100%';
                    btn.style.height = '100%';
                    btn.style.boxShadow = 'none';
                }}
                onMouseLeave={(e) => {
                    const btn = e.currentTarget;
                    btn.style.transform = 'none';
                    btn.style.margin = '0';
                    btn.style.padding = '0';
                    btn.style.width = '100%';
                    btn.style.height = '100%';
                    btn.style.boxShadow = 'none';
                }}
            >
                {numero}
            </button>
            
            {/* Sombra azul para seleccionado - usando pseudo-elemento para no afectar layout */}
            {selected && (
                <div 
                    className="absolute inset-0 rounded-md pointer-events-none"
                    style={{
                        boxShadow: 'inset 0 0 0 2px rgba(147, 197, 253, 0.5)',
                        zIndex: 1,
                        margin: 0,
                        padding: 0
                    }}
                />
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[9999]">
                {getTooltipText()}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
        </div>
    );
}





