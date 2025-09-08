'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
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

interface ZonePickerProps {
    zonaActual: Zona | null;
    onZonaChange: (zonaId: number) => void;
    estId: number;
}

export const ZonePicker: React.FC<ZonePickerProps> = ({
    zonaActual,
    onZonaChange,
    estId
}) => {
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [loading, setLoading] = useState(false);

    // Cargar zonas disponibles
    useEffect(() => {
        cargarZonas();
    }, [estId]);


    const cargarZonas = async () => {
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


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Zona y Configuración
                </CardTitle>
                <CardDescription>
                    Selecciona la zona a configurar y ajusta el layout del grid
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Selector de zona */}
                <div className="space-y-2">
                    <Label htmlFor="zona-select">Zona</Label>
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

                {/* Información de la zona seleccionada */}
                {zonaActual && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-800">
                            <strong>{zonaActual.zona_nombre}</strong>
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                            Grid: {zonaActual.grid.rows} × {zonaActual.grid.cols} plazas
                            <br />
                            Numeración: {zonaActual.grid.numbering === 'ROW_MAJOR' ? 'Por filas' : 'Por columnas'}
                        </div>
                    </div>
                )}

                {/* Información del grid (solo lectura) */}
                {zonaActual && (
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Configuración del Grid</Label>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-sm text-blue-800 space-y-1">
                                <div className="font-medium">📐 Layout configurado:</div>
                                <div>• Filas: {zonaActual.grid.rows}</div>
                                <div>• Columnas: {zonaActual.grid.cols}</div>
                                <div>• Total plazas: {zonaActual.grid.rows * zonaActual.grid.cols}</div>
                                <div>• Numeración: {zonaActual.grid.numbering === 'ROW_MAJOR' ? 'Por filas' : 'Por columnas'}</div>
                            </div>
                            <div className="text-xs text-blue-600 mt-2">
                                💡 Esta configuración se definió al crear la zona
                            </div>
                        </div>
                    </div>
                )}

                {/* Información adicional */}
                {!zonaActual && zonas.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                        💡 Selecciona una zona para ver su configuración actual
                    </div>
                )}

                {zonas.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                        📝 No hay zonas disponibles. Crea zonas primero desde el menú de configuración.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
