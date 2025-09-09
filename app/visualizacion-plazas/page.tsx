'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Settings, Building2, ChevronDown, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

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

interface Estacionamiento {
    est_id: number;
    est_nombre: string;
    est_prov: string;
    est_locali: string;
    est_direc: string;
    est_capacidad: number;
    plazas_totales_reales: number;
    plazas_disponibles_reales: number;
    plazas_ocupadas: number;
}

export default function VisualizacionPlazasPage() {
    const router = useRouter();
    const [plazas, setPlazas] = useState<Plaza[]>([]);
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
    const [estadisticasPlantillas, setEstadisticasPlantillas] = useState<EstadisticasPlantillas | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Estados para estacionamientos
    const [estacionamientos, setEstacionamientos] = useState<Estacionamiento[]>([]);
    const [estacionamientoSeleccionado, setEstacionamientoSeleccionado] = useState<Estacionamiento | null>(null);
    const [loadingEstacionamientos, setLoadingEstacionamientos] = useState(false);
    const [errorEstacionamientos, setErrorEstacionamientos] = useState<string | null>(null);

    useEffect(() => {
        cargarEstacionamientos();
    }, []);

    useEffect(() => {
        if (estacionamientoSeleccionado) {
            cargarDatos();
            // Guardar en localStorage
            localStorage.setItem('visualizacion_estacionamiento_seleccionado', JSON.stringify(estacionamientoSeleccionado));
        }
    }, [estacionamientoSeleccionado]);

    const cargarEstacionamientos = async () => {
        try {
            setLoadingEstacionamientos(true);
            const response = await fetch('/api/auth/list-parkings');

            if (!response.ok) {
                throw new Error('Error al cargar estacionamientos');
            }

            const data = await response.json();

            if (data.estacionamientos && data.estacionamientos.length > 0) {
                setEstacionamientos(data.estacionamientos);

                // Intentar recuperar el estacionamiento seleccionado del localStorage
                const estacionamientoGuardado = localStorage.getItem('visualizacion_estacionamiento_seleccionado');
                if (estacionamientoGuardado) {
                    try {
                        const estacionamientoParsed = JSON.parse(estacionamientoGuardado);
                        const estacionamientoEncontrado = data.estacionamientos.find(
                            (est: Estacionamiento) => est.est_id === estacionamientoParsed.est_id
                        );
                        if (estacionamientoEncontrado) {
                            setEstacionamientoSeleccionado(estacionamientoEncontrado);
                            return; // No seleccionar automáticamente si hay uno guardado
                        }
                    } catch (error) {
                        console.warn('Error parsing estacionamiento guardado:', error);
                    }
                }

                // Si no hay estacionamiento guardado, seleccionar el primero
                setEstacionamientoSeleccionado(data.estacionamientos[0]);
            } else {
                setError('No tienes estacionamientos asociados');
            }
        } catch (err) {
            console.error('Error cargando estacionamientos:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar estacionamientos';
            setErrorEstacionamientos(errorMessage);
            setError(errorMessage); // También actualizar el error general para mostrar en la UI
        } finally {
            setLoadingEstacionamientos(false);
        }
    };

    const cargarDatos = async () => {
        if (!estacionamientoSeleccionado) {
            console.log('No hay estacionamiento seleccionado, omitiendo carga de datos');
            return;
        }

        try {
            setLoading(true);
            console.log(`Cargando datos para estacionamiento ${estacionamientoSeleccionado.est_id}: ${estacionamientoSeleccionado.est_nombre}`);
            const response = await fetch(`/api/plazas?est_id=${estacionamientoSeleccionado.est_id}`);

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

    const cambiarEstacionamiento = (estacionamiento: Estacionamiento) => {
        if (estacionamientoSeleccionado?.est_id !== estacionamiento.est_id) {
            console.log(`Cambiando a estacionamiento: ${estacionamiento.est_id} - ${estacionamiento.est_nombre}`);
            setEstacionamientoSeleccionado(estacionamiento);
        }
    };

    const recargarEstacionamientos = () => {
        console.log('Recargando lista de estacionamientos...');
        cargarEstacionamientos();
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
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold">📊 Dashboard de Plazas</h1>
                                <p className="text-gray-600">Visualización completa del estado de todas las plazas</p>
                            </div>

                            {/* Dropdown de estacionamientos */}
                            {estacionamientos.length > 0 && (
                                <div className="flex items-center gap-4">
                                    {loadingEstacionamientos && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Cargando estacionamientos...
                                        </div>
                                    )}

                                    {!loadingEstacionamientos && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4" />
                                                    {estacionamientoSeleccionado ? (
                                                        <span className="max-w-48 truncate">
                                                            {estacionamientoSeleccionado.est_nombre}
                                                        </span>
                                                    ) : (
                                                        'Seleccionar estacionamiento'
                                                    )}
                                                    <ChevronDown className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-80">
                                                <div className="px-2 py-1.5 text-sm font-medium text-gray-500 flex items-center justify-between">
                                                    <span>Seleccionar Estacionamiento</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={recargarEstacionamientos}
                                                        disabled={loadingEstacionamientos}
                                                        className="h-6 w-6 p-0"
                                                        title="Recargar estacionamientos"
                                                    >
                                                        {loadingEstacionamientos ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <Settings className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </div>
                                                <DropdownMenuSeparator />
                                                {estacionamientos.length === 0 ? (
                                                    <div className="px-2 py-4 text-center text-sm text-gray-500">
                                                        {errorEstacionamientos ? (
                                                            <div>
                                                                <div className="text-red-500 mb-1">Error al cargar estacionamientos</div>
                                                                <div className="text-xs">{errorEstacionamientos}</div>
                                                            </div>
                                                        ) : (
                                                            'No hay estacionamientos disponibles'
                                                        )}
                                                    </div>
                                                ) : (
                                                    estacionamientos.map((estacionamiento) => (
                                                        <DropdownMenuItem
                                                            key={estacionamiento.est_id}
                                                            onClick={() => cambiarEstacionamiento(estacionamiento)}
                                                            className={`flex flex-col items-start p-3 cursor-pointer ${estacionamientoSeleccionado?.est_id === estacionamiento.est_id
                                                                    ? 'bg-blue-50 text-blue-700'
                                                                    : ''
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="font-medium flex items-center gap-2">
                                                                    {estacionamientoSeleccionado?.est_id === estacionamiento.est_id && (
                                                                        <Check className="h-4 w-4 text-blue-600" />
                                                                    )}
                                                                    {estacionamiento.est_nombre}
                                                                </span>
                                                                <Badge variant="outline" className="ml-2">
                                                                    ID: {estacionamiento.est_id}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {estacionamiento.est_prov}, {estacionamiento.est_locali}
                                                            </div>
                                                            <div className="text-xs text-gray-600 mt-1">
                                                                {estacionamiento.plazas_totales_reales} plazas totales
                                                                ({estacionamiento.plazas_disponibles_reales} disponibles)
                                                            </div>
                                                        </DropdownMenuItem>
                                                    ))
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Información del estacionamiento seleccionado */}
                        {estacionamientoSeleccionado && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <h3 className="font-medium text-blue-900">
                                            {estacionamientoSeleccionado.est_nombre}
                                        </h3>
                                        <p className="text-sm text-blue-700">
                                            {estacionamientoSeleccionado.est_direc} • {estacionamientoSeleccionado.est_prov}, {estacionamientoSeleccionado.est_locali}
                                        </p>
                                        <div className="flex items-center gap-4 mt-2 text-sm">
                                            <span className="text-blue-600">
                                                💰 Capacidad: {estacionamientoSeleccionado.est_capacidad}
                                            </span>
                                            <span className="text-green-600">
                                                🟢 Disponibles: {estacionamientoSeleccionado.plazas_disponibles_reales}
                                            </span>
                                            <span className="text-red-600">
                                                🔴 Ocupadas: {estacionamientoSeleccionado.plazas_ocupadas}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Estado de carga inicial cuando no hay estacionamiento seleccionado */}
                    {loadingEstacionamientos && (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <span>Cargando estacionamientos...</span>
                            </div>
                        </div>
                    )}

                    {/* Mensaje cuando no hay estacionamiento seleccionado */}
                    {!loadingEstacionamientos && !estacionamientoSeleccionado && estacionamientos.length > 0 && (
                        <div className="text-center py-12">
                            <div className="text-blue-500 text-6xl mb-4">
                                🏢
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Selecciona un Estacionamiento
                            </h3>
                            <p className="text-gray-600">
                                Usa el dropdown superior para seleccionar el estacionamiento que quieres visualizar.
                            </p>
                        </div>
                    )}

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

                    {/* Solo mostrar contenido si no hay error, no está cargando y hay estacionamiento seleccionado */}
                    {!loading && !error && estacionamientoSeleccionado && (
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