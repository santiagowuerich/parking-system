'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MousePointer, Square, Rows, Columns, X } from 'lucide-react';

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

interface SelectionToolbarProps {
    seleccion: Set<number>;
    setSeleccion: (seleccion: Set<number>) => void;
    modoSeleccion: 'individual' | 'rango' | 'fila' | 'columna';
    setModoSeleccion: (modo: 'individual' | 'rango' | 'fila' | 'columna') => void;
    zonaActual: Zona | null;
    plazas: Map<number, Plaza>;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
    seleccion,
    setSeleccion,
    modoSeleccion,
    setModoSeleccion,
    zonaActual,
    plazas
}) => {
    // Función para seleccionar toda una fila
    const seleccionarFila = (filaIndex: number) => {
        if (!zonaActual) return;

        const { rows, cols, numbering } = zonaActual.grid;
        const plazasSeleccionadas: number[] = [];

        for (let col = 0; col < cols; col++) {
            let plazaNumero: number;
            if (numbering === 'ROW_MAJOR') {
                plazaNumero = filaIndex * cols + col + 1;
            } else {
                plazaNumero = col * rows + filaIndex + 1;
            }

            if (plazas.has(plazaNumero)) {
                plazasSeleccionadas.push(plazaNumero);
            }
        }

        setSeleccion(new Set(plazasSeleccionadas));
    };

    // Función para seleccionar toda una columna
    const seleccionarColumna = (colIndex: number) => {
        if (!zonaActual) return;

        const { rows, cols, numbering } = zonaActual.grid;
        const plazasSeleccionadas: number[] = [];

        for (let row = 0; row < rows; row++) {
            let plazaNumero: number;
            if (numbering === 'ROW_MAJOR') {
                plazaNumero = row * cols + colIndex + 1;
            } else {
                plazaNumero = colIndex * rows + row + 1;
            }

            if (plazas.has(plazaNumero)) {
                plazasSeleccionadas.push(plazaNumero);
            }
        }

        setSeleccion(new Set(plazasSeleccionadas));
    };

    // Función para limpiar selección
    const limpiarSeleccion = () => {
        setSeleccion(new Set());
    };

    // Función para seleccionar todas las plazas
    const seleccionarTodas = () => {
        const todasLasPlazas = Array.from(plazas.keys());
        setSeleccion(new Set(todasLasPlazas));
    };

    // Función para seleccionar plazas por tipo de vehículo
    const seleccionarPorTipo = (tipoVehiculo: string) => {
        const plazasFiltradas = Array.from(plazas.entries())
            .filter(([_, plaza]) => plaza.tipo_vehiculo === tipoVehiculo)
            .map(([numero, _]) => numero);
        setSeleccion(new Set(plazasFiltradas));
    };

    // Función para seleccionar plazas sin plantilla
    const seleccionarSinPlantilla = () => {
        const plazasFiltradas = Array.from(plazas.entries())
            .filter(([_, plaza]) => !plaza.plantilla_actual)
            .map(([numero, _]) => numero);
        setSeleccion(new Set(plazasFiltradas));
    };

    // Función para seleccionar plazas por plantilla
    const seleccionarPorPlantilla = (plantillaId: number) => {
        const plazasFiltradas = Array.from(plazas.entries())
            .filter(([_, plaza]) => plaza.plantilla_actual?.plantilla_id === plantillaId)
            .map(([numero, _]) => numero);
        setSeleccion(new Set(plazasFiltradas));
    };

    // Obtener estadísticas de selección
    const getEstadisticasSeleccion = () => {
        const plazasSeleccionadas = Array.from(seleccion).map(num => plazas.get(num)).filter(Boolean);
        const stats = {
            total: plazasSeleccionadas.length,
            ocupadas: plazasSeleccionadas.filter(p => p!.estado === 'Ocupada').length,
            libres: plazasSeleccionadas.filter(p => p!.estado === 'Libre').length,
            conPlantilla: plazasSeleccionadas.filter(p => p!.plantilla_actual).length,
            sinPlantilla: plazasSeleccionadas.filter(p => !p!.plantilla_actual).length,
            tipos: {} as { [key: string]: number }
        };

        plazasSeleccionadas.forEach(plaza => {
            const tipo = plaza!.tipo_vehiculo;
            stats.tipos[tipo] = (stats.tipos[tipo] || 0) + 1;
        });

        return stats;
    };

    const stats = getEstadisticasSeleccion();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MousePointer className="h-5 w-5" />
                    Herramientas de Selección
                </CardTitle>
                <CardDescription>
                    Elige cómo seleccionar plazas para aplicar cambios
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Modos de selección */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Modo de selección</label>
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant={modoSeleccion === 'individual' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setModoSeleccion('individual')}
                            className="flex items-center gap-2"
                        >
                            <MousePointer className="h-4 w-4" />
                            Individual
                        </Button>
                        <Button
                            variant={modoSeleccion === 'rango' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setModoSeleccion('rango')}
                            className="flex items-center gap-2"
                        >
                            <Square className="h-4 w-4" />
                            Rango
                        </Button>
                        <Button
                            variant={modoSeleccion === 'fila' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setModoSeleccion('fila')}
                            className="flex items-center gap-2"
                        >
                            <Rows className="h-4 w-4" />
                            Por fila
                        </Button>
                        <Button
                            variant={modoSeleccion === 'columna' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setModoSeleccion('columna')}
                            className="flex items-center gap-2"
                        >
                            <Columns className="h-4 w-4" />
                            Por columna
                        </Button>
                    </div>
                </div>

                {/* Controles rápidos de selección */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Selección rápida</label>
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={seleccionarTodas}
                            disabled={!zonaActual}
                        >
                            Todas las plazas
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={seleccionarSinPlantilla}
                            disabled={!zonaActual}
                        >
                            Sin plantilla
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => seleccionarPorTipo('AUT')}
                            disabled={!zonaActual}
                        >
                            Solo autos
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => seleccionarPorTipo('MOT')}
                            disabled={!zonaActual}
                        >
                            Solo motos
                        </Button>
                    </div>
                </div>

                {/* Selección por fila/columna (solo cuando está activado el modo correspondiente) */}
                {(modoSeleccion === 'fila' || modoSeleccion === 'columna') && zonaActual && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Seleccionar {modoSeleccion === 'fila' ? 'fila' : 'columna'}
                        </label>
                        <div className="grid grid-cols-4 gap-1">
                            {Array.from(
                                { length: modoSeleccion === 'fila' ? zonaActual.grid.rows : zonaActual.grid.cols },
                                (_, index) => (
                                    <Button
                                        key={index}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => {
                                            if (modoSeleccion === 'fila') {
                                                seleccionarFila(index);
                                            } else {
                                                seleccionarColumna(index);
                                            }
                                        }}
                                    >
                                        {index + 1}
                                    </Button>
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* Información de selección actual */}
                {seleccion.size > 0 && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-800">
                            <strong>{seleccion.size} plazas seleccionadas</strong>
                        </div>
                        <div className="text-xs text-blue-600 mt-1 space-y-1">
                            <div>📊 Estadísticas:</div>
                            <div>• Libres: {stats.libres} | Ocupadas: {stats.ocupadas}</div>
                            <div>• Con plantilla: {stats.conPlantilla} | Sin plantilla: {stats.sinPlantilla}</div>
                            {Object.keys(stats.tipos).length > 0 && (
                                <div>• Tipos: {Object.entries(stats.tipos).map(([tipo, count]) => `${tipo}: ${count}`).join(', ')}</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Botón para limpiar selección */}
                {seleccion.size > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={limpiarSeleccion}
                        className="w-full flex items-center gap-2"
                    >
                        <X className="h-4 w-4" />
                        Limpiar selección ({seleccion.size})
                    </Button>
                )}

                {/* Información del modo actual */}
                <div className="text-xs text-muted-foreground space-y-1">
                    <div><strong>Modo actual:</strong> {modoSeleccion}</div>
                    {modoSeleccion === 'individual' && (
                        <div>• Mantén Ctrl para selección múltiple</div>
                    )}
                    {modoSeleccion === 'rango' && (
                        <div>• Arrastra para seleccionar un rango</div>
                    )}
                    {(modoSeleccion === 'fila' || modoSeleccion === 'columna') && (
                        <div>• Haz clic en el número de {modoSeleccion} para seleccionar toda la {modoSeleccion}</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
