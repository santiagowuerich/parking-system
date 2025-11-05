'use client';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth-context';

dayjs.extend(utc);
dayjs.extend(timezone);

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
    abono?: {
        abo_nro: number;
        pla_numero: number;
        est_id: number;
        abo_fecha_inicio: string;
        abo_fecha_fin: string;
        abo_tipoabono: string;
        abonado: {
            abon_id: number;
            abon_nombre: string;
            abon_apellido: string;
            abon_dni: string;
        };
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
    const { estId } = useAuth();
    const [plazas, setPlazas] = useState<Plaza[]>([]);
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
    const [estadisticasPlantillas, setEstadisticasPlantillas] = useState<EstadisticasPlantillas | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (estId) {
            cargarDatos();
        }
    }, [estId]);


    const cargarDatos = async () => {
        if (!estId) {
            console.log('No hay estacionamiento disponible, omitiendo carga de datos');
            return;
        }

        try {
            setLoading(true);
            console.log(`Cargando datos para estacionamiento ${estId}`);
            const response = await fetch(`/api/plazas?est_id=${estId}`);

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


    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'Libre': return 'bg-green-500';
            case 'Ocupada': return 'bg-red-500';
            case 'Reservada': return 'bg-yellow-500';
            case 'Abonado': return 'bg-orange-500';
            case 'Mantenimiento': return 'bg-gray-500';
            default: return 'bg-gray-400';
        }
    };

    const getEstadoIcon = (estado: string) => {
        switch (estado) {
            case 'Libre': return '🟢';
            case 'Ocupada': return '🔴';
            case 'Reservada': return '🟡';
            case 'Abonado': return '🟠';
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
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold">Visualización de Plazas</h1>
                                <p className="text-gray-600">Visualización completa del estado de todas las plazas</p>
                            </div>
                            <Button
                                onClick={cargarDatos}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                Actualizar Datos
                            </Button>
                        </div>
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

                    {/* Mensaje cuando no hay estacionamiento disponible */}
                    {!loading && !estId && (
                        <div className="text-center py-12">
                            <div className="text-blue-500 text-6xl mb-4">
                                🏢
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                No hay estacionamiento disponible
                            </h3>
                            <p className="text-gray-600">
                                Configura un estacionamiento desde el panel de administrador para visualizar las plazas.
                            </p>
                        </div>
                    )}

                    {/* Solo mostrar contenido si no hay error, no está cargando y hay estId disponible */}
                    {!loading && !error && estId && (
                        <>
                            {/* Estadísticas Generales */}
                            {estadisticas && (
                                <>
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
                                                abonadas: plazasZona.filter((p: Plaza) => p.pla_estado === 'Abonado').length,
                                                conPlantilla: plazasZona.filter((p: Plaza) => p.plantillas).length,
                                                sinPlantilla: plazasZona.filter((p: Plaza) => !p.plantillas).length
                                            };

                                            return (
                                                <Card key={zonaNombre}>
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center justify-between">
                                                            <span>{zonaNombre}</span>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline">
                                                                    {estadisticasZona.libres}/{estadisticasZona.total} libres
                                                                </Badge>
                                                                <Badge variant="outline">
                                                                    {((estadisticasZona.ocupadas / estadisticasZona.total) * 100).toFixed(0)}% ocupadas
                                                                </Badge>
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
                                                                                    {plaza.pla_estado === 'Abonado' && plaza.abono && (
                                                                                        <div className="border-t pt-2 mt-2">
                                                                                            <div className="text-sm font-medium text-orange-600 mb-1">🎫 Abono Asignado</div>
                                                                                            <div className="text-sm">
                                                                                                <span className="font-medium">Titular:</span> {plaza.abono.abonado.abon_nombre} {plaza.abono.abonado.abon_apellido}
                                                                                            </div>
                                                                                            <div className="text-sm">
                                                                                                <span className="font-medium">DNI:</span> {plaza.abono.abonado.abon_dni}
                                                                                            </div>
                                                                                            <div className="text-sm">
                                                                                                <span className="font-medium">Tipo:</span> {plaza.abono.abo_tipoabono}
                                                                                            </div>
                                                                                            <div className="text-sm">
                                                                                                <span className="font-medium">Inicio:</span> {dayjs.utc(plaza.abono.abo_fecha_inicio).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY')}
                                                                                            </div>
                                                                                            <div className="text-sm">
                                                                                                <span className="font-medium">Fin:</span> {dayjs.utc(plaza.abono.abo_fecha_fin).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY')}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
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
                                                            <div className="grid grid-cols-2 md:grid-cols-7 gap-4 text-sm">
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
                                                                    <span className="font-medium text-orange-600">Abonadas:</span> {estadisticasZona.abonadas}
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
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
}
