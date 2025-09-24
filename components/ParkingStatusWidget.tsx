"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    const router = useRouter();
    const { estId, parkedVehicles, parkingCapacity, userRole, roleLoading, parkings, fetchParkings } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const [estacionamientoActual, setEstacionamientoActual] = useState<any>(null);

    // Cargar datos del estacionamiento actual
    useEffect(() => {
        if (!estId) {
            setEstacionamientoActual(null);
            return;
        }

        // Primero intentar encontrar en parkings
        const fromParkings = parkings.find(p => p.est_id === estId);
        if (fromParkings) {
            console.log('✅ Estacionamiento encontrado en parkings:', fromParkings);
            setEstacionamientoActual(fromParkings);
            return;
        }

        // Si no está en parkings, intentar cargar datos directamente desde API
        const cargarNombreEstacionamiento = async () => {
            try {
                console.log('🔄 Cargando nombre del estacionamiento desde API...');
                const response = await fetch(`/api/auth/list-parkings`);
                const data = await response.json();

                if (data.estacionamientos && data.estacionamientos.length > 0) {
                    const estacionamiento = data.estacionamientos.find(e => e.est_id === estId);
                    if (estacionamiento) {
                        console.log('✅ Estacionamiento encontrado vía API:', estacionamiento.est_nombre);
                        setEstacionamientoActual(estacionamiento);
                        return;
                    }
                }
            } catch (error) {
                console.error('❌ Error cargando nombre del estacionamiento:', error);
            }

            // Fallback si no se puede obtener el nombre real
            console.log('⚠️ Usando fallback para estacionamiento', estId);
            setEstacionamientoActual({
                est_id: estId,
                est_nombre: `Estacionamiento ${estId}`,
                est_prov: '',
                est_locali: '',
                est_direc: ''
            });
        };

        cargarNombreEstacionamiento();
    }, [estId, parkings, parkingCapacity]);

    // Función para refrescar datos
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchParkings();
        } catch (error) {
            console.error('Error refrescando datos del estacionamiento:', error);
        } finally {
            setRefreshing(false);
        }
    };

    // Desactivar polling automático para evitar loops
    // useEffect(() => {
    //     if (!estId) return;
    //     const interval = setInterval(() => {
    //         cargarDetallesEstacionamiento();
    //     }, 30000);
    //     return () => clearInterval(interval);
    // }, [estId]);

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

    // No necesitamos estado de carga separado ya que los datos vienen del AuthContext

    // Si tenemos estId pero no estacionamientoActual ni capacidad, mostrar estado de carga
    if (estId && !estacionamientoActual && !parkingCapacity) {
        return (
            <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" />
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0"></div>
                        <span className="text-sm text-gray-500">Cargando...</span>
                    </div>
                </div>
            </div>
        );
    }

    const handleClick = () => {
        router.push('/dashboard/parking');
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
                        {estacionamientoActual?.est_nombre || `Estacionamiento ${estId}`}
                    </div>
                </div>
            </div>
        </div>
    );
}
