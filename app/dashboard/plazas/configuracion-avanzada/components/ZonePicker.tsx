'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Zona {
    zona_id: number;
    zona_nombre: string;
    grid: {
        rows: number;
        cols: number;
        numbering: string;
    };
}

interface Plantilla {
    plantilla_id: number;
    nombre_plantilla: string;
    catv_segmento: string;
    caracteristicas: { [tipo: string]: string[] };
}

interface ZonePickerProps {
    zonaActual: Zona | null;
    onZonaChange: (zonaId: number) => void;
    estId: number | null;
    plantillas: Plantilla[];
    plantillaSeleccionada: number | null;
    setPlantillaSeleccionada: (id: number | null) => void;
    onAplicarPlantilla: () => void;
    onLimpiarPlantillas: () => void;
    seleccion: Set<number>;
}

export const ZonePicker: React.FC<ZonePickerProps> = ({
    zonaActual,
    onZonaChange,
    estId,
    plantillas,
    plantillaSeleccionada,
    setPlantillaSeleccionada,
    onAplicarPlantilla,
    onLimpiarPlantillas,
    seleccion
}) => {
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [loading, setLoading] = useState(false);

    // Cargar zonas disponibles
    useEffect(() => {
        cargarZonas();
    }, [estId]);


    const cargarZonas = async () => {
        if (!estId) {
            console.error('No hay estacionamiento asignado para cargar zonas');
            return;
        }

        try {
            const response = await fetch(`/api/zonas?est_id=${estId}`);
            if (response.ok) {
                const data = await response.json();
                // Filtrar zonas válidas y agregar validaciones defensivas
                const zonasValidas = (data.zonas || []).filter((zona: any) =>
                    zona &&
                    zona.zona_id !== null &&
                    zona.zona_id !== undefined &&
                    zona.zona_nombre &&
                    typeof zona.zona_id === 'number' &&
                    typeof zona.zona_nombre === 'string'
                ).map((zona: any) => ({
                    zona_id: zona.zona_id,
                    zona_nombre: zona.zona_nombre,
                    grid: {
                        rows: 1,
                        cols: 1,
                        numbering: 'ROW_MAJOR'
                    }
                }));
                setZonas(zonasValidas);
            }
        } catch (error) {
            console.error('Error cargando zonas:', error);
            toast.error('Error al cargar las zonas');
        }
    };

    const handleZonaChange = (zonaId: string) => {
        const id = parseInt(zonaId);
        if (id && !isNaN(id)) {
            onZonaChange(id);
        }
    };

    // Función para obtener el color de la plantilla
    const getPlantillaColor = (catv_segmento: string) => {
        switch (catv_segmento) {
            case 'AUT': return 'bg-blue-100 border-blue-300 text-blue-800';
            case 'MOT': return 'bg-green-100 border-green-300 text-green-800';
            case 'CAM': return 'bg-purple-100 border-purple-300 text-purple-800';
            default: return 'bg-gray-100 border-gray-300 text-gray-800';
        }
    };

    // Función para obtener el nombre del tipo de vehículo
    const getTipoVehiculoNombre = (catv_segmento: string) => {
        switch (catv_segmento) {
            case 'AUT': return 'Automóvil';
            case 'MOT': return 'Motocicleta';
            case 'CAM': return 'Camioneta';
            default: return catv_segmento;
        }
    };

    // Función para manejar la aplicación de plantilla
    const handleAplicarPlantilla = () => {
        if (!plantillaSeleccionada) {
            toast.error('Selecciona una plantilla primero');
            return;
        }

        if (seleccion.size === 0) {
            toast.error('Selecciona al menos una plaza');
            return;
        }

        onAplicarPlantilla();
    };

    // Función para manejar la limpieza de plantillas
    const handleLimpiarPlantillas = () => {
        if (seleccion.size === 0) {
            toast.error('Selecciona al menos una plaza');
            return;
        }

        onLimpiarPlantillas();
    };

    // Obtener información de la plantilla seleccionada
    const plantillaActual = plantillas.find(p => p.plantilla_id === plantillaSeleccionada);

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                {/* Selector de zona */}
                <div className="space-y-2">
                    <Label htmlFor="zona-select">Seleccionar zona</Label>
                    <Select
                        value={zonaActual?.zona_id?.toString() || ''}
                        onValueChange={handleZonaChange}
                    >
                        <SelectTrigger id="zona-select">
                            <SelectValue placeholder="Selecciona una zona" />
                        </SelectTrigger>
                        <SelectContent>
                            {zonas
                                .filter((zona) => zona && zona.zona_id && zona.zona_nombre)
                                .map((zona) => (
                                    <SelectItem key={zona.zona_id} value={zona.zona_id.toString()}>
                                        {zona.zona_nombre}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>

                <Separator />

                {/* Selector de plantilla */}
                <div className="space-y-2">
                    <Label htmlFor="plantilla-select">Seleccionar plantilla</Label>
                    <Select
                        value={plantillaSeleccionada?.toString() || ''}
                        onValueChange={(value) => setPlantillaSeleccionada(value ? parseInt(value) : null)}
                    >
                        <SelectTrigger id="plantilla-select">
                            <SelectValue placeholder="Elige una plantilla..." />
                        </SelectTrigger>
                        <SelectContent>
                            {plantillas
                                .filter(plantilla => plantilla && plantilla.plantilla_id && plantilla.nombre_plantilla)
                                .map((plantilla) => (
                                    <SelectItem
                                        key={plantilla.plantilla_id}
                                        value={plantilla.plantilla_id.toString()}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${getPlantillaColor(plantilla.catv_segmento || 'AUT')}`}
                                            >
                                                {plantilla.catv_segmento || 'AUT'}
                                            </Badge>
                                            {plantilla.nombre_plantilla || 'Sin nombre'}
                                        </div>
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Información de la plantilla seleccionada */}
                {plantillaActual && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className={getPlantillaColor(plantillaActual.catv_segmento)}>
                                {getTipoVehiculoNombre(plantillaActual.catv_segmento)}
                            </Badge>
                            <span className="font-medium text-sm">{plantillaActual.nombre_plantilla}</span>
                        </div>

                        {Object.keys(plantillaActual.caracteristicas).length > 0 && (
                            <div className="text-xs text-blue-700 dark:text-blue-300">
                                <div className="font-medium mb-1">Características:</div>
                                {Object.entries(plantillaActual.caracteristicas).map(([tipo, valores]) => (
                                    <div key={tipo} className="mb-1">
                                        <span className="font-medium">{tipo}:</span> {valores.join(', ')}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <Separator />

                {/* Botones de acción */}
                <div className="space-y-3">
                    {/* Aplicar plantilla */}
                    <Button
                        onClick={handleAplicarPlantilla}
                        disabled={!plantillaSeleccionada || seleccion.size === 0}
                        className="w-full flex items-center gap-2"
                    >
                        <CheckCircle className="h-4 w-4" />
                        Aplicar plantilla
                        {seleccion.size > 0 && ` (${seleccion.size} plazas)`}
                    </Button>

                    {/* Limpiar plantillas */}
                    <Button
                        variant="outline"
                        onClick={handleLimpiarPlantillas}
                        disabled={seleccion.size === 0}
                        className="w-full flex items-center gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Limpiar plantillas
                        {seleccion.size > 0 && ` (${seleccion.size} plazas)`}
                    </Button>
                </div>

                {/* Información de estado */}
                <div className="space-y-2 text-sm">
                    {seleccion.size === 0 && (
                        <div className="text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Selecciona plazas para aplicar cambios
                        </div>
                    )}

                    {seleccion.size > 0 && !plantillaSeleccionada && (
                        <div className="text-muted-foreground text-xs">
                            Selecciona una plantilla para aplicar a las {seleccion.size} plazas seleccionadas
                        </div>
                    )}

                    {seleccion.size > 0 && plantillaSeleccionada && (
                        <div className="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-2 rounded border border-green-200 dark:border-green-800 text-xs">
                            Listo para aplicar "{plantillaActual?.nombre_plantilla}" a {seleccion.size} plazas
                        </div>
                    )}
                </div>

                {/* Información adicional */}
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t dark:border-zinc-700">
                    <div>• Click en plaza: seleccionar/deseleccionar</div>
                    <div>• Arrastrar: selección por rango</div>
                    <div>• Las plazas ocupadas no se verán afectadas</div>
                </div>
            </CardContent>
        </Card>
    );
};
