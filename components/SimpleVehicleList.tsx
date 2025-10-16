// components/SimpleVehicleList.tsx - Vista simple sin zonas configuradas
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Car, Bike, Truck, Settings } from "lucide-react";
import { formatTime } from "@/lib/utils";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface Vehicle {
    license_plate: string;
    type: 'Auto' | 'Moto' | 'Camioneta';
    entry_time: string;
    plaza_number: number;
}

interface AbonoInfo {
    abo_nro: number;
    abo_tipoabono: string;
    abo_fecha_inicio: string;
    abo_fecha_fin: string;
    abonado?: {
        abon_nombre: string;
        abon_apellido: string;
        abon_dni: string;
    };
}

interface Plaza {
    numero: number;
    ocupado: boolean;
    tipo: string;
    estado?: string;
    abono?: AbonoInfo | null;
}

interface SimpleVehicleListProps {
    stats: {
        total: number;
        ocupadas: number;
        libres: number;
    };
    plazas: Plaza[];
    vehiculos: Vehicle[];
    onPlazaClick?: (plaza: Plaza) => void;
    onConfigureZones?: () => void;
    showConfigureButton?: boolean;
}

export function SimpleVehicleList({
    stats,
    plazas,
    vehiculos,
    onPlazaClick,
    onConfigureZones,
    showConfigureButton = false
}: SimpleVehicleListProps) {

    const getVehicleIcon = (type: string) => {
        switch (type) {
            case 'Auto': return <Car className="w-4 h-4" />;
            case 'Moto': return <Bike className="w-4 h-4" />;
            case 'Camioneta': return <Truck className="w-4 h-4" />;
            default: return <Car className="w-4 h-4" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Auto': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'Moto': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'Camioneta': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
        }
    };

    const getPlazaEstado = (plaza: Plaza) => {
        if (plaza.estado) return plaza.estado;
        return plaza.ocupado ? 'Ocupada' : 'Libre';
    };

    const getPlazaColorClasses = (plaza: Plaza) => {
        if (plaza.estado === 'Abonado' && !plaza.ocupado) {
            return 'bg-orange-500 hover:bg-orange-600';
        }
        return plaza.ocupado ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';
    };

    const formatDuration = (entryTime: string) => {
        // Los datos en BD están en UTC (timestamp without time zone)
        // Interpretar como UTC y luego convertir a zona local para cálculo
        const now = dayjs();
        const entry = dayjs.utc(entryTime).local();
        const diffMs = now.diff(entry);

        // Evitar tiempos negativos
        if (diffMs < 0) {
            return '0m';
        }

        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours > 0) {
            return `${diffHours}h ${diffMinutes}m`;
        }
        return `${diffMinutes}m`;
    };

    return (
        <div className="space-y-6">
            {/* Estadísticas Generales */}
            <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-xl dark:text-zinc-100">Estado General del Estacionamiento</CardTitle>
                    <CardDescription className="dark:text-zinc-400">
                        {stats.total} plazas totales • {stats.ocupadas} ocupadas • {stats.libres} libres
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
                            <div className="text-sm text-blue-600 dark:text-blue-400">Total</div>
                        </div>
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.ocupadas}</div>
                            <div className="text-sm text-red-600 dark:text-red-400">Ocupadas</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.libres}</div>
                            <div className="text-sm text-green-600 dark:text-green-400">Libres</div>
                        </div>
                    </div>

                    {showConfigureButton && (
                        <div className="mt-4 text-center">
                            <Button
                                onClick={onConfigureZones}
                                variant="outline"
                                className="dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <Settings className="w-4 h-4 mr-2" />
                                Configurar Zonas
                            </Button>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                                Organiza las plazas en zonas para una mejor gestión
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Lista de Vehículos Estacionados */}
            {vehiculos.length > 0 && (
                <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-xl dark:text-zinc-100">Vehículos Estacionados</CardTitle>
                        <CardDescription className="dark:text-zinc-400">
                            {vehiculos.length} vehículo{vehiculos.length !== 1 ? 's' : ''} actualmente en el estacionamiento
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {vehiculos.map((vehiculo, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border dark:border-zinc-700"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            {getVehicleIcon(vehiculo.type)}
                                            <span className="font-mono font-semibold text-lg dark:text-zinc-100">
                                                {vehiculo.license_plate}
                                            </span>
                                        </div>
                                        <Badge className={getTypeColor(vehiculo.type)}>
                                            {vehiculo.type}
                                        </Badge>
                                        <Badge variant="outline" className="dark:border-zinc-600 dark:text-zinc-300">
                                            Plaza {vehiculo.plaza_number}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                        <Clock className="w-4 h-4" />
                                        <span>{formatTime(new Date(vehiculo.entry_time))}</span>
                                        <span>({formatDuration(vehiculo.entry_time)})</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Grid de Plazas */}
            <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-xl dark:text-zinc-100">Todas las Plazas</CardTitle>
                    <CardDescription className="dark:text-zinc-400">
                        Vista general de todas las plazas del estacionamiento
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Leyenda */}
                    <div className="flex items-center justify-center gap-4 mb-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-4 h-4 rounded bg-green-600"></div>
                            <span className="dark:text-zinc-300">Libre</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-4 h-4 rounded bg-red-600"></div>
                            <span className="dark:text-zinc-300">Ocupado</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-4 h-4 rounded bg-orange-500"></div>
                            <span className="dark:text-zinc-300">Abonado</span>
                        </div>
                    </div>

                    {/* Grid de plazas */}
                    <TooltipProvider>
                        <div className="grid grid-cols-10 sm:grid-cols-12 md:grid-cols-15 lg:grid-cols-20 gap-2">
                            {plazas.map((plaza) => {
                                const estado = getPlazaEstado(plaza);
                                const esAbonadaLibre = estado === 'Abonado' && !plaza.ocupado;
                                const abono = plaza.abono || null;
                                const mostrarTooltipAbono = esAbonadaLibre && abono;

                                const titular = abono?.abonado
                                    ? `${abono.abonado.abon_nombre || ''} ${abono.abonado.abon_apellido || ''}`.trim()
                                    : null;
                                const fechaInicio = abono?.abo_fecha_inicio
                                    ? new Date(abono.abo_fecha_inicio).toLocaleDateString('es-AR')
                                    : null;
                                const fechaFin = abono?.abo_fecha_fin
                                    ? new Date(abono.abo_fecha_fin).toLocaleDateString('es-AR')
                                    : null;

                                return (
                                    <Tooltip key={plaza.numero}>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => onPlazaClick?.(plaza)}
                                                className={`
                          w-8 h-8 flex items-center justify-center rounded text-white font-bold text-xs
                          transition-transform duration-150 hover:scale-110
                          ${getPlazaColorClasses(plaza)}
                        `}
                                                title={`Plaza ${plaza.numero} - ${estado} - ${plaza.tipo}`}
                                            >
                                                {plaza.numero}
                                            </button>
                                        </TooltipTrigger>
                                        {mostrarTooltipAbono && (
                                            <TooltipContent side="top" className="max-w-xs">
                                                <div className="space-y-1 text-sm">
                                                    <div className="font-semibold text-orange-600">Abono asignado</div>
                                                    {titular && (
                                                        <div>
                                                            <span className="font-medium">Titular:</span> {titular}
                                                        </div>
                                                    )}
                                                    {abono?.abonado?.abon_dni && (
                                                        <div>
                                                            <span className="font-medium">DNI:</span> {abono.abonado.abon_dni}
                                                        </div>
                                                    )}
                                                    {abono?.abo_tipoabono && (
                                                        <div>
                                                            <span className="font-medium">Tipo:</span> {abono.abo_tipoabono}
                                                        </div>
                                                    )}
                                                    {(fechaInicio || fechaFin) && (
                                                        <div>
                                                            <span className="font-medium">Vigencia:</span>{' '}
                                                            {fechaInicio || 'N/A'} &rarr; {fechaFin || 'N/A'}
                                                        </div>
                                                    )}
                                                </div>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </TooltipProvider>

                    <div className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        Click en una plaza libre para seleccionarla al registrar entrada
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
