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
    modoSeleccion: 'individual' | 'rango' | 'fila' | 'columna';
}

export const PlazasGrid: React.FC<PlazasGridProps> = ({
    zona,
    plazas,
    seleccion,
    onSeleccionChange,
    modoSeleccion
}) => {
    const [seleccionInicial, setSeleccionInicial] = useState<number | null>(null);
    const [arrastrando, setArrastrando] = useState(false);

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

    // Función para calcular la posición de una plaza en el grid
    const getPlazaPosition = useCallback((plazaNumero: number) => {
        const { rows, cols, numbering } = zona.grid;

        if (numbering === 'ROW_MAJOR') {
            // Numeración por filas: 1,2,3... en fila 1; 4,5,6... en fila 2
            const row = Math.floor((plazaNumero - 1) / cols);
            const col = (plazaNumero - 1) % cols;
            return { row, col };
        } else {
            // Numeración por columnas: 1,4,7... en columna 1; 2,5,8... en columna 2
            const col = Math.floor((plazaNumero - 1) / rows);
            const row = (plazaNumero - 1) % rows;
            return { row, col };
        }
    }, [zona.grid]);

    // Función para manejar el clic en una plaza
    const handlePlazaClick = useCallback((plazaNumero: number, event: React.MouseEvent) => {
        event.preventDefault();

        if (modoSeleccion === 'individual') {
            // Selección individual con Ctrl para múltiple
            if (event.ctrlKey || event.metaKey) {
                const nuevaSeleccion = new Set(seleccion);
                if (nuevaSeleccion.has(plazaNumero)) {
                    nuevaSeleccion.delete(plazaNumero);
                } else {
                    nuevaSeleccion.add(plazaNumero);
                }
                onSeleccionChange(nuevaSeleccion);
            } else {
                // Selección simple (reemplaza selección anterior)
                onSeleccionChange(new Set([plazaNumero]));
            }
        } else if (modoSeleccion === 'rango') {
            // Selección por rango
            if (!seleccionInicial) {
                setSeleccionInicial(plazaNumero);
                onSeleccionChange(new Set([plazaNumero]));
            } else {
                // Calcular rango entre selección inicial y actual
                const rango = calcularRangoPlazas(seleccionInicial, plazaNumero);
                onSeleccionChange(new Set(rango));
            }
        }
    }, [seleccion, onSeleccionChange, modoSeleccion, seleccionInicial]);

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
    const handleMouseDown = useCallback((plazaNumero: number) => {
        if (modoSeleccion === 'rango') {
            setSeleccionInicial(plazaNumero);
            setArrastrando(true);
        }
    }, [modoSeleccion]);

    // Función para manejar el movimiento del mouse durante el arrastre
    const handleMouseEnter = useCallback((plazaNumero: number) => {
        if (arrastrando && modoSeleccion === 'rango' && seleccionInicial) {
            const rango = calcularRangoPlazas(seleccionInicial, plazaNumero);
            onSeleccionChange(new Set(rango));
        }
    }, [arrastrando, modoSeleccion, seleccionInicial, calcularRangoPlazas, onSeleccionChange]);

    // Función para manejar el fin del arrastre
    const handleMouseUp = useCallback(() => {
        setArrastrando(false);
        setSeleccionInicial(null);
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
                                        w-6 h-6 border rounded cursor-pointer transition-all duration-150
                                        flex items-center justify-center text-[10px] font-medium
                                        hover:scale-110 hover:shadow-sm
                                        ${colorClass}
                                        ${isSelected ? 'ring-1 ring-blue-500 ring-offset-1' : ''}
                                        ${!plaza ? 'opacity-50' : ''}
                                    `}
                                    onClick={(e) => handlePlazaClick(plazaNumero, e)}
                                    onMouseDown={() => handleMouseDown(plazaNumero)}
                                    onMouseEnter={() => handleMouseEnter(plazaNumero)}
                                    onMouseUp={handleMouseUp}
                                >
                                    {plazaNumero}
                                    {isSelected && (
                                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-white"></div>
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
        <div className="flex flex-wrap gap-2 mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
                <span className="text-xs">Sin plantilla</span>
            </div>
            <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-blue-200 border border-blue-400 rounded"></div>
                <span className="text-xs">Auto</span>
            </div>
            <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
                <span className="text-xs">Moto</span>
            </div>
            <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-purple-200 border border-purple-400 rounded"></div>
                <span className="text-xs">Camioneta</span>
            </div>
            <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-red-200 border border-red-400 rounded"></div>
                <span className="text-xs">Ocupada</span>
            </div>
            <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-yellow-200 border border-yellow-400 rounded"></div>
                <span className="text-xs">Reservada</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Grid de plazas */}
            <div
                className="grid gap-0.5 p-3 bg-white border rounded-lg overflow-auto max-h-[400px]"
                style={{
                    gridTemplateColumns: `repeat(${zona.grid.cols}, 24px)`,
                    gridTemplateRows: `repeat(${zona.grid.rows}, 24px)`,
                    width: 'fit-content',
                    margin: '0 auto'
                }}
            >
                {renderGrid()}
            </div>

            {/* Información del modo de selección */}
            <div className="text-sm text-muted-foreground">
                <Badge variant="outline" className="mr-2">
                    Modo: {modoSeleccion === 'individual' ? 'Individual' :
                        modoSeleccion === 'rango' ? 'Rango' :
                            modoSeleccion === 'fila' ? 'Por fila' : 'Por columna'}
                </Badge>
                {modoSeleccion === 'individual' && (
                    <span>Mantén Ctrl para selección múltiple</span>
                )}
                {modoSeleccion === 'rango' && (
                    <span>Arrastra para seleccionar rango</span>
                )}
            </div>

            {/* Leyenda */}
            {renderLeyenda()}
        </div>
    );
};
