"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Building2,
    MapPin,
    Users,
    Car,
    Loader2,
    RefreshCw,
    AlertCircle
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface EstacionamientoDetalle {
    est_id: number;
    est_nombre: string;
    est_prov: string;
    est_locali: string;
    est_direc: string;
    est_capacidad: number;
    est_latitud?: number;
    est_longitud?: number;
    est_telefono?: string;
    est_email?: string;
    est_descripcion?: string;
    plazas_totales_reales: number;
    plazas_disponibles_reales: number;
    plazas_ocupadas: number;
}

interface ParkingStatusWidgetProps {
    className?: string;
    collapsed?: boolean;
}

export default function ParkingStatusWidget({ className, collapsed = false }: ParkingStatusWidgetProps) {
    const { estId, parkedVehicles, parkingCapacity } = useAuth();
    const [estacionamientoActual, setEstacionamientoActual] = useState<EstacionamientoDetalle | null>(null);
    const [loadingEstacionamiento, setLoadingEstacionamiento] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Función para cargar detalles del estacionamiento actual
    const cargarDetallesEstacionamiento = async () => {
        if (!estId) {
            setEstacionamientoActual(null);
            return;
        }

        try {
            setLoadingEstacionamiento(true);
            const response = await fetch(`/api/auth/list-parkings`);

            if (!response.ok) {
                throw new Error('Error al cargar detalles del estacionamiento');
            }

            const data = await response.json();

            if (data.estacionamientos && data.estacionamientos.length > 0) {
                const estacionamiento = data.estacionamientos.find(
                    (est: EstacionamientoDetalle) => est.est_id === estId
                );

                if (estacionamiento) {
                    setEstacionamientoActual(estacionamiento);
                } else {
                    setEstacionamientoActual(null);
                }
            } else {
                setEstacionamientoActual(null);
            }
        } catch (error) {
            console.error('Error cargando detalles del estacionamiento:', error);
            setEstacionamientoActual(null);
        } finally {
            setLoadingEstacionamiento(false);
        }
    };

    // Función para refrescar datos
    const handleRefresh = async () => {
        setRefreshing(true);
        await cargarDetallesEstacionamiento();
        setRefreshing(false);
    };

    // Cargar detalles del estacionamiento cuando estId cambie
    useEffect(() => {
        cargarDetallesEstacionamiento();
    }, [estId]);

    // Actualización automática cada 30 segundos
    useEffect(() => {
        if (!estId) return;

        const interval = setInterval(() => {
            cargarDetallesEstacionamiento();
        }, 30000); // 30 segundos

        return () => clearInterval(interval);
    }, [estId]);

    // Calcular estadísticas en tiempo real
    const totalSpaces = parkingCapacity ?
        (parkingCapacity.Auto || 0) + (parkingCapacity.Moto || 0) + (parkingCapacity.Camioneta || 0) : 0;
    const occupiedSpaces = parkedVehicles?.length || 0;
    const availableSpaces = Math.max(0, totalSpaces - occupiedSpaces);
    const occupancyRate = totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0;

    if (!estId) {
        return (
            <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0"></div>
                        <span className="text-sm text-gray-500">Sin estacionamiento</span>
                    </div>
                </div>
            </div>
        );
    }

    if (loadingEstacionamiento) {
        return (
            <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Loader2 className="h-1.5 w-1.5 animate-spin flex-shrink-0" />
                        <span className="text-sm text-gray-500">Cargando...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!estacionamientoActual) {
        return (
            <div className={`bg-white border border-red-200 rounded-lg ${className}`}>
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <MapPin className="h-3.5 w-3.5 text-red-400" />
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-300 flex-shrink-0"></div>
                        <span className="text-sm text-red-600">Error</span>
                    </div>
                </div>
            </div>
        );
    }

    const handleClick = () => {
        window.location.href = '/dashboard/parking';
    };

    return (
        <div
            className={`bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer ${className}`}
            onClick={handleClick}
        >
            <div className="flex items-center gap-2 px-2 py-1.5">
                <MapPin className="h-3.5 w-3.5 text-gray-600 flex-shrink-0" />
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${occupancyRate >= 90 ? 'bg-red-500' :
                        occupancyRate >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}></div>
                    <div className="text-sm font-medium text-gray-900 truncate">
                        {estacionamientoActual.est_nombre}
                    </div>
                </div>
            </div>
        </div>
    );
}
