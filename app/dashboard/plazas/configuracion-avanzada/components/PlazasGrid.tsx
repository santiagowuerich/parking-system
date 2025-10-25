'use client';

import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Plaza {
    numero: number;
    estado: string;
    tipo_vehiculo: string;
    plantilla_actual: {
        plantilla_id: number;
        nombre_plantilla: string;
        catv_segmento: string;
    } | null;
    zona_id: number;
    zona_nombre: string;
}

interface Zona {
    zona_id: number;
    zona_nombre: string;
    grid: {
        rows: number;
        cols: number;
        numbering: string;
    };
}

interface PlazasGridProps {
    zona: Zona;
    plazas: Map<number, Plaza>;
    seleccion: Set<number>;
    onSeleccionChange: (seleccion: Set<number>) => void;
}

export const PlazasGrid: React.FC<PlazasGridProps> = ({
    zona,
    plazas,
    seleccion,
    onSeleccionChange
}) => {
    const [seleccionInicial, setSeleccionInicial] = useState<number | null>(null);
    const [arrastrando, setArrastrando] = useState(false);
    const [mouseMovido, setMouseMovido] = useState(false);

    // Función para obtener el color según la plantilla
    const getPlazaColor = useCallback((plaza: Plaza | undefined) => {
        if (!plaza) return 'bg-gray-200 border-gray-300';

        // Estados de ocupación
        if (plaza.estado === 'Ocupada') return 'bg-red-200 border-red-400';
        if (plaza.estado === 'Reservada') return 'bg-yellow-200 border-yellow-400';
        if (plaza.estado === 'Mantenimiento') return 'bg-orange-200 border-orange-400';

        // Plantillas asignadas
        if (plaza.plantilla_actual && plaza.plantilla_actual.catv_segmento) {
            switch (plaza.plantilla_actual.catv_segmento) {
                case 'AUT': return 'bg-blue-200 border-blue-400';
                case 'MOT': return 'bg-green-200 border-green-400';
                case 'CAM': return 'bg-purple-200 border-purple-400';
                default: return 'bg-indigo-200 border-indigo-400';
            }
        }

        // Sin plantilla asignada
        return 'bg-gray-100 border-gray-300';
    }, []);

    // Función para obtener el texto del tooltip
    const getTooltipText = useCallback((plaza: Plaza | undefined) => {
        if (!plaza) return 'Plaza no encontrada';

        let texto = `Plaza #${plaza.numero || 'N/A'}\n`;
        texto += `Estado: ${plaza.estado || 'Desconocido'}\n`;
        texto += `Tipo: ${plaza.tipo_vehiculo || 'N/A'}\n`;

        if (plaza.plantilla_actual && plaza.plantilla_actual.nombre_plantilla) {
            texto += `Plantilla: ${plaza.plantilla_actual.nombre_plantilla}\n`;
            texto += `Categoría: ${plaza.plantilla_actual.catv_segmento || 'N/A'}`;
        } else {
            texto += 'Sin plantilla asignada';
        }

        return texto;
    }, []);

    // Función para manejar el clic en una plaza (modo toggle siempre activo)
    const handlePlazaClick = useCallback((plazaNumero: number, event: React.MouseEvent) => {
        event.preventDefault();

        // Solo hacer toggle si NO hubo movimiento del mouse (no fue arrastre)
        if (mouseMovido) return;

        // Modo toggle: si está seleccionada, deseleccionar; si no, seleccionar
        const nuevaSeleccion = new Set(seleccion);
        if (nuevaSeleccion.has(plazaNumero)) {
            nuevaSeleccion.delete(plazaNumero);
        } else {
            nuevaSeleccion.add(plazaNumero);
        }
        onSeleccionChange(nuevaSeleccion);
    }, [seleccion, onSeleccionChange, mouseMovido]);

    // Función para calcular rango de plazas
    const calcularRangoPlazas = useCallback((inicio: number, fin: number) => {
        const plazasRango: number[] = [];
        const min = Math.min(inicio, fin);
        const max = Math.max(inicio, fin);

        for (let i = min; i <= max; i++) {
            if (plazas.has(i)) {
                plazasRango.push(i);
            }
        }

        return plazasRango;
    }, [plazas]);

    // Función para manejar el inicio del arrastre
    const handleMouseDown = useCallback((plazaNumero: number, event: React.MouseEvent) => {
        event.preventDefault();
        setSeleccionInicial(plazaNumero);
        setMouseMovido(false); // Resetear el flag de movimiento
        // NO activar arrastrando aquí, esperar al movimiento del mouse
    }, []);

    // Función para manejar el movimiento del mouse durante el arrastre
    const handleMouseEnter = useCallback((plazaNumero: number) => {
        if (seleccionInicial !== null && seleccionInicial !== plazaNumero) {
            // Si hay selección inicial y nos movemos a otra plaza, activar arrastre
            if (!arrastrando) {
                setArrastrando(true);
                setMouseMovido(true);
            }
            const rango = calcularRangoPlazas(seleccionInicial, plazaNumero);
            onSeleccionChange(new Set(rango));
        }
    }, [seleccionInicial, arrastrando, calcularRangoPlazas, onSeleccionChange]);

    // Función para manejar el fin del arrastre
    const handleMouseUp = useCallback(() => {
        setArrastrando(false);
        setSeleccionInicial(null);
        // Resetear mouseMovido después de un pequeño delay para permitir que el click se procese
        setTimeout(() => setMouseMovido(false), 10);
    }, []);

    // Crear el grid de plazas
    const renderGrid = () => {
        const { rows, cols } = zona.grid;
        const gridItems: React.JSX.Element[] = [];

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Calcular el número de plaza basado en la posición y tipo de numeración
                let plazaNumero: number;
                if (zona.grid.numbering === 'ROW_MAJOR') {
                    plazaNumero = row * cols + col + 1;
                } else {
                    plazaNumero = col * rows + row + 1;
                }

                const plaza = plazas.get(plazaNumero);
                const isSelected = seleccion.has(plazaNumero);
                const colorClass = getPlazaColor(plaza);

                gridItems.push(
                    <TooltipProvider key={plazaNumero}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className={`
                                        relative w-12 h-12 rounded cursor-pointer transition-all duration-150
                                        flex items-center justify-center text-sm font-semibold
                                        hover:scale-105 hover:shadow-md
                                        ${colorClass}
                                        ${isSelected
                                            ? 'border-4 border-blue-600 dark:border-blue-400 shadow-lg scale-105'
                                            : 'border-2'
                                        }
                                        ${!plaza ? 'opacity-50' : ''}
                                    `}
                                    onClick={(e) => handlePlazaClick(plazaNumero, e)}
                                    onMouseDown={(e) => handleMouseDown(plazaNumero, e)}
                                    onMouseEnter={() => handleMouseEnter(plazaNumero)}
                                    onMouseUp={handleMouseUp}
                                >
                                    {plazaNumero}
                                    {isSelected && (
                                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 dark:bg-blue-400 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-sm whitespace-pre-line">
                                    {getTooltipText(plaza)}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            }
        }

        return gridItems;
    };

    // Leyenda de colores
    const renderLeyenda = () => (
        <div className="flex flex-wrap gap-3 mt-4 p-4 bg-gray-50 dark:bg-zinc-900 rounded-lg border dark:border-zinc-800">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-100 border-2 border-gray-300 rounded"></div>
                <span className="text-sm">Sin plantilla</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-200 border-2 border-blue-400 rounded"></div>
                <span className="text-sm">Auto</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-200 border-2 border-green-400 rounded"></div>
                <span className="text-sm">Moto</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-200 border-2 border-purple-400 rounded"></div>
                <span className="text-sm">Camioneta</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-200 border-2 border-red-400 rounded"></div>
                <span className="text-sm">Ocupada</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-yellow-200 border-2 border-yellow-400 rounded"></div>
                <span className="text-sm">Reservada</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Grid de plazas */}
            <div
                className="grid gap-1 p-6 bg-white dark:bg-zinc-950 border rounded-lg overflow-auto"
                style={{
                    gridTemplateColumns: `repeat(${zona.grid.cols}, 48px)`,
                    gridTemplateRows: `repeat(${zona.grid.rows}, 48px)`,
                    width: 'fit-content',
                    margin: '0 auto',
                    maxHeight: 'calc(100vh - 300px)'
                }}
                onMouseLeave={handleMouseUp}
            >
                {renderGrid()}
            </div>

            {/* Leyenda */}
            {renderLeyenda()}
        </div>
    );
};
