"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import OperatorPanel from "@/components/operator-panel";
import { useAuth } from "@/lib/auth-context";
import { createBrowserClient } from "@supabase/ssr";
import type { Parking, Vehicle, VehicleType, ParkingHistory } from "@/lib/types";
import { calculateFee, formatDuration } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import dayjs from "dayjs";

type ExitInfo = {
    vehicle: Vehicle;
    fee: number;
    exitTime: Date;
    duration: string;
};

export default function OperadorSimplePage() {
    const { user, estId, parkedVehicles, parkingCapacity, refreshParkedVehicles, refreshParkingHistory, refreshCapacity } = useAuth();
    const [parking, setParking] = useState<Parking | null>(null);
    const [rates, setRates] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exitInfo, setExitInfo] = useState<ExitInfo | null>(null);
    const [plazasData, setPlazasData] = useState<any>(null);
    const [loadingPlazas, setLoadingPlazas] = useState(true);

    // Inicializar datos del parking
    useEffect(() => {
        if (parkedVehicles && parkingCapacity && estId) {
            setParking({
                id: estId,
                name: `Estacionamiento ${estId}`,
                capacity: parkingCapacity,
                parkedVehicles: parkedVehicles,
                rates: rates || {}
            });
        }
    }, [parkedVehicles, parkingCapacity, estId, rates]);

    // Cargar tarifas
    useEffect(() => {
        const loadRates = async () => {
            if (!estId) return;

            try {
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                const { data, error } = await supabase
                    .from('tarifas')
                    .select(`
                        *,
                        cat_vehiculo!inner(catv_descripcion)
                    `)
                    .eq('est_id', estId);

                if (error) throw error;

                setRates(data || []);
            } catch (error) {
                console.error("Error al cargar tarifas:", error);
            }
        };

        loadRates();
    }, [estId]);

    // Cargar estado de plazas
    const fetchPlazasStatus = async () => {
        if (!estId) return;

        try {
            setLoadingPlazas(true);
            const response = await fetch(`/api/plazas/status?est_id=${estId}`);

            if (response.ok) {
                const data = await response.json();
                setPlazasData(data);
            } else {
                console.error("Error al cargar estado de plazas");
            }
        } catch (error) {
            console.error("Error al cargar estado de plazas:", error);
        } finally {
            setLoadingPlazas(false);
        }
    };

    // Cargar estado inicial
    useEffect(() => {
        const initializeData = async () => {
            setLoading(true);
            await fetchPlazasStatus();
            setLoading(false);
        };

        initializeData();
    }, [estId]);

    // Calcular espacios disponibles
    const getAvailableSpaces = () => {
        if (!parkingCapacity || !parkedVehicles) {
            return {
                Auto: 0,
                Moto: 0,
                Camioneta: 0,
                total: { capacity: 0, occupied: 0 }
            };
        }

        const occupied = {
            Auto: parkedVehicles.filter(v => v.type === 'Auto').length,
            Moto: parkedVehicles.filter(v => v.type === 'Moto').length,
            Camioneta: parkedVehicles.filter(v => v.type === 'Camioneta').length
        };

        return {
            Auto: parkingCapacity.Auto - occupied.Auto,
            Moto: parkingCapacity.Moto - occupied.Moto,
            Camioneta: parkingCapacity.Camioneta - occupied.Camioneta,
            total: {
                capacity: parkingCapacity.Auto + parkingCapacity.Moto + parkingCapacity.Camioneta,
                occupied: parkedVehicles.length
            }
        };
    };

    // Registrar entrada de vehículo
    const registerEntry = async (vehicleData: Omit<Vehicle, "entry_time"> & { pla_numero?: number | null }) => {
        if (!estId || !user?.id) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se puede registrar entrada sin estacionamiento seleccionado"
            });
            return;
        }

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            // Primero verificar si el vehículo existe, si no, crearlo
            const vehicleTypeMap: { [key: string]: string } = {
                'Auto': 'AUT',
                'Moto': 'MOT',
                'Camioneta': 'CAM'
            };

            const vehicleSegment = vehicleTypeMap[vehicleData.type] || 'AUT';

            // Verificar si el vehículo ya existe
            const { data: existingVehicle } = await supabase
                .from('vehiculos')
                .select('*')
                .eq('veh_patente', vehicleData.license_plate)
                .single();

            if (!existingVehicle) {
                // Crear el vehículo si no existe
                const { error: vehicleError } = await supabase
                    .from('vehiculos')
                    .insert({
                        veh_patente: vehicleData.license_plate,
                        catv_segmento: vehicleSegment
                    });

                if (vehicleError) throw vehicleError;
            }

            // Registrar la ocupación
            const { error } = await supabase
                .from('ocupacion')
                .insert({
                    veh_patente: vehicleData.license_plate,
                    est_id: estId,
                    ocu_fh_entrada: new Date().toISOString(),
                    pla_numero: vehicleData.pla_numero
                });

            if (error) throw error;

            await refreshParkedVehicles();
            await fetchPlazasStatus();

            toast({
                title: "Entrada registrada",
                description: `${vehicleData.license_plate} ha sido registrado exitosamente`
            });
        } catch (error) {
            console.error("Error al registrar entrada:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo registrar la entrada del vehículo"
            });
        }
    };

    // Registrar salida de vehículo
    const handleExit = async (licensePlate: string) => {
        if (!estId || !user?.id) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se puede registrar salida sin estacionamiento seleccionado"
            });
            return;
        }

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            // Buscar el vehículo en ocupación activa
            const { data: vehicle, error: vehicleError } = await supabase
                .from('ocupacion')
                .select(`
                    *,
                    vehiculos!inner(veh_patente, catv_segmento)
                `)
                .eq('veh_patente', licensePlate)
                .eq('est_id', estId)
                .is('ocu_fh_salida', null)
                .single();

            if (vehicleError || !vehicle) {
                throw new Error("Vehículo no encontrado");
            }

            // Convertir el tipo de vehículo para compatibilidad
            const vehicleTypeMap: { [key: string]: string } = {
                'AUT': 'Auto',
                'MOT': 'Moto',
                'CAM': 'Camioneta'
            };

            const mappedVehicle = {
                ...vehicle,
                type: vehicleTypeMap[vehicle.vehiculos.catv_segmento] || 'Auto'
            };

            // Calcular tarifa
            const entryTime = new Date(vehicle.ocu_fh_entrada);
            const exitTime = new Date();
            const durationMs = exitTime.getTime() - entryTime.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);

            // Calcular tarifa basada en las tarifas configuradas
            let fee = 0;
            if (rates && rates.length > 0) {
                const vehicleSegment = vehicle.vehiculos.catv_segmento;
                const vehicleRate = rates.find((r: any) => r.catv_segmento === vehicleSegment);

                if (vehicleRate) {
                    // Calcular tarifa: precio base + fracción por hora
                    const basePrice = vehicleRate.tar_precio;
                    const fractionPrice = vehicleRate.tar_fraccion;
                    const effectiveHours = Math.ceil(durationHours);

                    // Si la duración es menor o igual a 1 hora, cobrar precio base
                    // Si es mayor, cobrar precio base + fracción por hora adicional
                    if (effectiveHours <= 1) {
                        fee = basePrice;
                    } else {
                        fee = basePrice + (fractionPrice * (effectiveHours - 1));
                    }
                }
            }

            // Actualizar la ocupación con la hora de salida
            const { error: updateError } = await supabase
                .from('ocupacion')
                .update({
                    ocu_fh_salida: exitTime.toISOString()
                })
                .eq('ocu_id', vehicle.ocu_id);

            if (updateError) throw updateError;

            // Crear registro en el historial (si es necesario)
            // Nota: La vista vw_historial_estacionamiento probablemente se genera automáticamente
            // desde la tabla ocupacion cuando ocu_fh_salida no es NULL

            // Actualizar datos
            await refreshParkedVehicles();
            await refreshParkingHistory();
            await fetchPlazasStatus();

            // Mostrar información de salida
            setExitInfo({
                vehicle: mappedVehicle,
                fee: fee,
                exitTime: exitTime,
                duration: formatDuration(durationMs)
            });

            toast({
                title: "Salida registrada",
                description: `${licensePlate} ha salido exitosamente. Tarifa: $${fee.toFixed(2)}`
            });

        } catch (error) {
            console.error("Error al registrar salida:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo registrar la salida del vehículo"
            });
        }
    };

    // Función para configurar zonas (redirige al panel de administrador)
    const handleConfigureZones = () => {
        toast({
            title: "Configurar Zonas",
            description: "Ve al Panel de Administrador para configurar las zonas del estacionamiento"
        });
        // Redirigir al panel de administrador
        window.location.href = '/dashboard/panel-administrador';
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="p-6">
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                            <p className="text-gray-600">Cargando panel de operador...</p>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!estId) {
        return (
            <DashboardLayout>
                <div className="p-6">
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Panel de Operador</h2>
                        <p className="text-gray-600 mb-6">
                            Selecciona un estacionamiento para acceder al panel de operador
                        </p>
                        <button
                            onClick={() => window.location.href = '/dashboard/parking'}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Ir a Mis Estacionamientos
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!parking) {
        return (
            <DashboardLayout>
                <div className="p-6">
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Panel de Operador</h2>
                        <p className="text-gray-600 mb-6">
                            Cargando datos del estacionamiento...
                        </p>
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Panel de Operador</h1>
                    <p className="text-gray-600 mt-1">
                        Gestiona entradas y salidas de vehículos en tiempo real
                    </p>
                </div>

                <OperatorPanel
                    parking={parking}
                    availableSpaces={getAvailableSpaces()}
                    onRegisterEntry={registerEntry}
                    onRegisterExit={handleExit}
                    exitInfo={exitInfo}
                    setExitInfo={setExitInfo}
                    plazasData={plazasData}
                    loadingPlazas={loadingPlazas}
                    fetchPlazasStatus={fetchPlazasStatus}
                    onConfigureZones={handleConfigureZones}
                />
            </div>
        </DashboardLayout>
    );
}
