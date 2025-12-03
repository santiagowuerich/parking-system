// components/Plaza.tsx
'use client';
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PlazaProps {
    numero: number;
    ocupado: boolean;
    abonado?: boolean; // Nuevo prop para estado abonado
    tipo?: string; // Tipo de plaza (Auto, Moto, Camioneta)
    caracteristicas?: Record<string, string[]>; // Características de la plaza
    plantilla?: {
        plantilla_id?: number;
        nombre_plantilla?: string;
        catv_segmento?: string;
        caracteristicas?: Record<string, string[]>;
    }; // Información completa de la plantilla
    onClick: () => void;
    selected?: boolean; // Nuevo prop para indicar si la plaza está seleccionada
}

export function Plaza({ numero, ocupado, abonado = false, tipo = 'Auto', caracteristicas, plantilla, onClick, selected = false }: PlazaProps) {

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
            // Estado Libre: verde con borde verde para plazas con plantilla
            return "bg-green-700 hover:bg-green-800 cursor-pointer border-2 border-green-400";
        }
    };

    const handleClick = () => {
        // Solo permitir click si está libre (no ocupado ni abonado)
        if (!ocupado && !abonado) {
            onClick();
        }
    };

    const getTooltipText = () => {
        // Usar características de la plantilla si están disponibles, sino usar las pasadas directamente
        // Manejar null, undefined y objetos vacíos
        const caracteristicasPlantilla = plantilla?.caracteristicas;
        const caracteristicasMostrar =
            caracteristicasPlantilla && typeof caracteristicasPlantilla === "object" && Object.keys(caracteristicasPlantilla).length > 0
                ? caracteristicasPlantilla
                : caracteristicas && typeof caracteristicas === "object" && Object.keys(caracteristicas).length > 0
                    ? caracteristicas
                    : null;

        return (
            <div className="space-y-2">
                <div className="font-semibold text-gray-900">Plaza #{numero}</div>
                {plantilla && plantilla.nombre_plantilla && (
                    <div>
                        <div className="text-sm font-medium text-gray-900 mb-2">{plantilla.nombre_plantilla}</div>
                        {plantilla.catv_segmento && (
                            <div className="text-xs text-gray-600 mb-2">
                                Tipo: {plantilla.catv_segmento}
                            </div>
                        )}
                    </div>
                )}
                {caracteristicasMostrar && Object.keys(caracteristicasMostrar).length > 0 && (
                    <div className="border-t border-gray-200 pt-2 mt-2">
                        <div className="text-sm font-medium text-gray-900 mb-2">Características</div>
                        {Object.entries(caracteristicasMostrar).map(([categoria, valores]) => (
                            <div key={categoria} className="text-sm text-gray-700 mb-1">
                                <span className="font-medium">{categoria}:</span> {Array.isArray(valores) ? valores.join(', ') : String(valores)}
                            </div>
                        ))}
                    </div>
                )}
                {(!plantilla || !plantilla.nombre_plantilla) && (!caracteristicasMostrar || Object.keys(caracteristicasMostrar).length === 0) && (
                    <div className="text-sm text-gray-500 italic">Sin información de plantilla disponible</div>
                )}
            </div>
        );
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    className="relative"
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
            >
                <span className="text-sm font-bold">{numero}</span>
                {(plantilla?.plantilla_id || (caracteristicas && Object.keys(caracteristicas).length > 0)) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">P</span>
                    </div>
                )}
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

                </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs bg-white text-gray-900 border border-gray-200 shadow-lg">
                {getTooltipText()}
            </TooltipContent>
        </Tooltip>
    );
}





