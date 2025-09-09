'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Plaza {
    est_id: number;
    pla_numero: number;
    pla_estado: string;
    pla_zona: string | null;
    zona_id: number | null;
    catv_segmento: string;
    plantilla_id: number | null;
    plantillas?: {
        plantilla_id: number;
        nombre_plantilla: string;
        catv_segmento: string;
    } | null;
}

interface Zona {
    zona_id: number;
    zona_nombre: string;
    zona_capacidad: number | null;
}

interface Estadisticas {
    total_plazas: number;
    plazas_libres: number;
    plazas_ocupadas: number;
    ocupacion_porcentaje: number;
}

interface EstadisticasPlantillas {
    totalPlazas: number;
    plazasConPlantilla: number;
    plazasSinPlantilla: number;
    porcentajeConPlantilla: string;
    plantillasUnicas: number;
}

export default function VisualizacionPlazasPage() {
    const router = useRouter();
    const [plazas, setPlazas] = useState<Plaza[]>([]);
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
    const [estadisticasPlantillas, setEstadisticasPlantillas] = useState<EstadisticasPlantillas | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/plazas');

            if (!response.ok) {
                throw new Error('Error al cargar los datos');
            }

            const data = await response.json();
            setPlazas(data.plazas || []);
            setZonas(data.zonas || []);
            setEstadisticas(data.estadisticas || null);

            // Calcular estadísticas de plantillas
            const plazasData = data.plazas || [];
            const estadisticasPlantillas = {
                totalPlazas: plazasData.length,
                plazasConPlantilla: plazasData.filter((p: Plaza) => p.plantillas).length,
                plazasSinPlantilla: plazasData.filter((p: Plaza) => !p.plantillas).length,
                porcentajeConPlantilla: plazasData.length > 0 ? ((plazasData.filter((p: Plaza) => p.plantillas).length / plazasData.length) * 100).toFixed(1) : '0',
                plantillasUnicas: [...new Set(plazasData.filter((p: Plaza) => p.plantillas).map((p: Plaza) => p.plantillas?.nombre_plantilla || ''))].length
            };
            setEstadisticasPlantillas(estadisticasPlantillas);
        } catch (err) {
            console.error('Error cargando datos:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const configurarZona = (zonaNombre: string) => {
        router.push(`/dashboard/configuracion-zona?zona=${encodeURIComponent(zonaNombre)}`);
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'Libre': return 'bg-green-500';
            case 'Ocupada': return 'bg-red-500';
            case 'Reservada': return 'bg-yellow-500';
            case 'Mantenimiento': return 'bg-gray-500';
            default: return 'bg-gray-400';
        }
    };

    const getEstadoIcon = (estado: string) => {
        switch (estado) {
            case 'Libre': return '🟢';
            case 'Ocupada': return '🔴';
            case 'Reservada': return '🟡';
            case 'Mantenimiento': return '⚫';
            default: return '❓';
        }
    };

    // Agrupar plazas por zona
    const plazasPorZona = plazas.reduce((acc: Record<string, Plaza[]>, plaza: Plaza) => {
        const zonaNombre = plaza.pla_zona || 'Sin Zona';
        if (!acc[zonaNombre]) {
            acc[zonaNombre] = [];
        }
        acc[zonaNombre].push(plaza);
        return acc;
    }, {} as Record<string, Plaza[]>);

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-gray-50">
                <div className="p-6 space-y-6">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold">📊 Dashboard de Plazas</h1>
                        <p className="text-gray-600">Visualización completa del estado de todas las plazas</p>
                    </div>


                    {/* Estados de carga y error dentro del dashboard */}
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <span>Cargando plazas...</span>
                            </div>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="text-red-500 text-lg mb-2">❌ Error</div>
                                <div className="text-gray-600 mb-4">{error}</div>
                                <button
                                    onClick={cargarDatos}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                >
                                    Reintentar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Solo mostrar contenido si no hay error y no está cargando */}
                    {!loading && !error && (
                        <>
                            {/* Estadísticas Generales */}
                            {estadisticas && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-gray-600">
                                                    Total Plazas
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">{estadisticas.total_plazas}</div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-green-600">
                                                    Plazas Libres
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-green-600">
                                                    {estadisticas.plazas_libres}
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    {estadisticas.total_plazas > 0
                                                        ? ((estadisticas.plazas_libres / estadisticas.total_plazas) * 100).toFixed(1)
                                                        : 0}%
                                                </p>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-red-600">
                                                    Plazas Ocupadas
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-red-600">
                                                    {estadisticas.plazas_ocupadas}
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    {estadisticas.total_plazas > 0
                                                        ? ((estadisticas.plazas_ocupadas / estadisticas.total_plazas) * 100).toFixed(1)
                                                        : 0}%
                                                </p>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-blue-600">
                                                    Porcentaje Ocupación
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-blue-600">
                                                    {estadisticas.ocupacion_porcentaje.toFixed(1)}%
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Estadísticas de Plantillas */}
                                    {estadisticasPlantillas && (
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                            <Card>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium text-blue-600">
                                                        Plazas con Plantilla
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold text-blue-600">
                                                        {estadisticasPlantillas.plazasConPlantilla}
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        {estadisticasPlantillas.porcentajeConPlantilla}%
                                                    </p>
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium text-gray-600">
                                                        Plazas sin Plantilla
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold text-gray-600">
                                                        {estadisticasPlantillas.plazasSinPlantilla}
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        {(100 - parseFloat(estadisticasPlantillas.porcentajeConPlantilla)).toFixed(1)}%
                                                    </p>
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium text-purple-600">
                                                        Plantillas Únicas
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold text-purple-600">
                                                        {estadisticasPlantillas.plantillasUnicas}
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        Tipos diferentes
                                                    </p>
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium text-green-600">
                                                        Cobertura
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold text-green-600">
                                                        {estadisticasPlantillas.porcentajeConPlantilla}%
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        Plazas configuradas
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}

                                    {/* Zonas y Plazas */}
                                    <div className="space-y-6">
                                        {Object.entries(plazasPorZona).map(([zonaNombre, plazasZona]) => {
                                            const plazasPorFila = 10;
                                            const filas = [];

                                            // Ordenar plazas por número
                                            plazasZona.sort((a, b) => a.pla_numero - b.pla_numero);

                                            for (let i = 0; i < plazasZona.length; i += plazasPorFila) {
                                                filas.push(plazasZona.slice(i, i + plazasPorFila));
                                            }

                                            const estadisticasZona = {
                                                total: plazasZona.length,
                                                libres: plazasZona.filter((p: Plaza) => p.pla_estado === 'Libre').length,
                                                ocupadas: plazasZona.filter((p: Plaza) => p.pla_estado === 'Ocupada').length,
                                                reservadas: plazasZona.filter((p: Plaza) => p.pla_estado === 'Reservada').length,
                                                conPlantilla: plazasZona.filter((p: Plaza) => p.plantillas).length,
                                                sinPlantilla: plazasZona.filter((p: Plaza) => !p.plantillas).length
                                            };

                                            return (
                                                <Card key={zonaNombre}>
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center justify-between">
                                                            <span>🏗️ {zonaNombre}</span>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline">
                                                                    {estadisticasZona.libres}/{estadisticasZona.total} libres
                                                                </Badge>
                                                                <Badge variant="outline">
                                                                    {((estadisticasZona.ocupadas / estadisticasZona.total) * 100).toFixed(0)}% ocupadas
                                                                </Badge>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => configurarZona(zonaNombre)}
                                                                    className="flex items-center gap-1"
                                                                >
                                                                    <Settings className="h-3 w-3" />
                                                                    Configurar
                                                                </Button>
                                                            </div>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-2">
                                                            {filas.map((fila, filaIndex) => (
                                                                <div key={filaIndex} className="flex gap-2 justify-center">
                                                                    {fila.map(plaza => (
                                                                        <Tooltip key={plaza.pla_numero}>
                                                                            <TooltipTrigger asChild>
                                                                                <div
                                                                                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md transition-colors duration-200 relative cursor-pointer ${getEstadoColor(plaza.pla_estado)} ${plaza.plantillas ? 'ring-2 ring-blue-300' : ''}`}
                                                                                >
                                                                                    <span className="text-xs">{plaza.pla_numero}</span>
                                                                                    {plaza.plantillas && (
                                                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                                                                            <span className="text-white text-xs font-bold">P</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="top" className="max-w-xs">
                                                                                <div className="space-y-2">
                                                                                    <div className="font-semibold">Plaza #{plaza.pla_numero}</div>
                                                                                    <div className="text-sm">
                                                                                        <span className="font-medium">Estado:</span> {plaza.pla_estado}
                                                                                    </div>
                                                                                    <div className="text-sm">
                                                                                        <span className="font-medium">Tipo:</span> {plaza.catv_segmento}
                                                                                    </div>
                                                                                    <div className="text-sm">
                                                                                        <span className="font-medium">Zona:</span> {plaza.pla_zona || 'Sin zona'}
                                                                                    </div>
                                                                                    {plaza.plantillas && (
                                                                                        <div className="border-t pt-2 mt-2">
                                                                                            <div className="text-sm font-medium text-blue-600 mb-1">📋 Plantilla Asignada</div>
                                                                                            <div className="text-sm">
                                                                                                <span className="font-medium">Nombre:</span> {plaza.plantillas.nombre_plantilla}
                                                                                            </div>
                                                                                            <div className="text-sm">
                                                                                                <span className="font-medium">Tipo Vehículo:</span> {plaza.plantillas.catv_segmento}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Información adicional de la zona */}
                                                        <div className="mt-4 pt-4 border-t">
                                                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                                                                <div>
                                                                    <span className="font-medium">Total:</span> {estadisticasZona.total}
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-green-600">Libres:</span> {estadisticasZona.libres}
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-red-600">Ocupadas:</span> {estadisticasZona.ocupadas}
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-yellow-600">Reservadas:</span> {estadisticasZona.reservadas}
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-blue-600">Con Plantilla:</span> {estadisticasZona.conPlantilla}
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-gray-600">Sin Plantilla:</span> {estadisticasZona.sinPlantilla}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>

                                    {/* Mensaje si no hay plazas */}
                                    {Object.keys(plazasPorZona).length === 0 && (
                                        <div className="text-center py-12">
                                            <div className="text-gray-400 text-6xl mb-4">
                                                {plazas.length === 0 ? '🏗️' : '🔍'}
                                            </div>
                                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                                {plazas.length === 0
                                                    ? 'No hay plazas configuradas'
                                                    : 'No hay plazas que coincidan con los filtros'
                                                }
                                            </h3>
                                            <p className="text-gray-600">
                                                {plazas.length === 0
                                                    ? 'Aún no se han configurado plazas en el estacionamiento.'
                                                    : 'Prueba ajustando los filtros de plantilla para ver más resultados.'
                                                }
                                            </p>
                                        </div>
                                    )}

                                    {/* Botón de recarga */}
                                    <div className="mt-6 text-center">
                                        <button
                                            onClick={cargarDatos}
                                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                        >
                                            🔄 Actualizar Datos
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
}