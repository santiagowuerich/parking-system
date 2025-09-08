'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';

interface Plaza {
    est_id: number;
    pla_numero: number;
    pla_estado: string;
    pla_zona: string | null;
    zona_id: number | null;
    catv_segmento: string;
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

export default function VisualizacionPlazasPage() {
    const router = useRouter();
    const [plazas, setPlazas] = useState<Plaza[]>([]);
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
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
        } catch (err) {
            console.error('Error cargando datos:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const configurarZona = (zonaNombre: string) => {
        // Redirigir a la página de configuración con el parámetro de zona
        router.push(`/configuracion-zona?zona=${encodeURIComponent(zonaNombre)}`);
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
    const plazasPorZona = plazas.reduce((acc, plaza) => {
        const zonaNombre = plaza.pla_zona || 'Sin Zona';
        if (!acc[zonaNombre]) {
            acc[zonaNombre] = [];
        }
        acc[zonaNombre].push(plaza);
        return acc;
    }, {} as Record<string, Plaza[]>);

    if (loading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Cargando plazas...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="text-red-500 text-lg mb-2">❌ Error</div>
                        <div className="text-gray-600">{error}</div>
                        <button
                            onClick={cargarDatos}
                            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">📊 Dashboard de Plazas</h1>
                    <p className="text-gray-600">Visualización completa del estado de todas las plazas</p>
                </div>

                {/* Estadísticas Generales */}
                {estadisticas && (
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
                                        : 0}%</p>
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
                                        : 0}%</p>
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
                            libres: plazasZona.filter(p => p.pla_estado === 'Libre').length,
                            ocupadas: plazasZona.filter(p => p.pla_estado === 'Ocupada').length,
                            reservadas: plazasZona.filter(p => p.pla_estado === 'Reservada').length
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
                                                    <div
                                                        key={plaza.pla_numero}
                                                        className={`
                                                        w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm
                                                        shadow-md transition-colors duration-200
                                                        ${getEstadoColor(plaza.pla_estado)}
                                                    `}
                                                        title={`Plaza ${plaza.pla_numero} - ${plaza.pla_estado} - ${plaza.catv_segmento}`}
                                                    >
                                                        <span className="text-xs">{plaza.pla_numero}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Información adicional de la zona */}
                                    <div className="mt-4 pt-4 border-t">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                        <div className="text-gray-400 text-6xl mb-4">🏗️</div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No hay plazas configuradas
                        </h3>
                        <p className="text-gray-600">
                            Aún no se han configurado plazas en el estacionamiento.
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
            </div>
        </DashboardLayout>
    );
}
