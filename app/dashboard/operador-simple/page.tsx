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

    // Datos completos para visualización rica
    const [plazasCompletas, setPlazasCompletas] = useState<any[]>([]);
    const [loadingPlazasCompletas, setLoadingPlazasCompletas] = useState(true);

    // Inicializar datos del parking
    useEffect(() => {
        if (parkedVehicles && parkingCapacity && estId) {
            setParking({
                capacity: parkingCapacity,
                parkedVehicles: parkedVehicles,
                rates: rates || {},
                history: [] // Se puede cargar después si es necesario
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
                    .select('*')
                    .eq('est_id', estId);

                if (error) throw error;

                setRates(data || []);
            } catch (error) {
                console.error("Error al cargar tarifas:", error);
            }
        };

        loadRates();
    }, [estId]);

    // Cargar estado de plazas (básico para operaciones)
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

    // Cargar datos completos para visualización rica
    const fetchPlazasCompletas = async () => {
        if (!estId) return;

        try {
            setLoadingPlazasCompletas(true);
            const response = await fetch(`/api/plazas?est_id=${estId}`);

            if (response.ok) {
                const data = await response.json();
                console.log('📊 Plazas completas cargadas:', data.plazas?.length || 0);
                setPlazasCompletas(data.plazas || []);
            } else {
                console.error("Error al cargar datos completos de plazas");
            }
        } catch (error) {
            console.error("Error al cargar datos completos de plazas:", error);
        } finally {
            setLoadingPlazasCompletas(false);
        }
    };

    // Cargar estado inicial
    useEffect(() => {
        const initializeData = async () => {
            setLoading(true);
            await Promise.all([
                fetchPlazasStatus(),
                fetchPlazasCompletas()
            ]);
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
    const registerEntry = async (vehicleData: Omit<Vehicle, "entry_time"> & {
        pla_numero?: number | null,
        duracion_tipo?: string,
        precio_acordado?: number,
        fecha_limite?: string
    }) => {
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

            // Mapeo de tipos de vehículo del frontend a códigos de BD
            const vehicleTypeMapping = {
                'Auto': 'AUT',
                'Moto': 'MOT',
                'Camioneta': 'CAM'
            };

            const dbVehicleType = vehicleTypeMapping[vehicleData.type as keyof typeof vehicleTypeMapping] || 'AUT';

            // Verificar si el vehículo ya existe, si no, crearlo
            const { data: existingVehicle, error: vehicleCheckError } = await supabase
                .from('vehiculos')
                .select('veh_patente')
                .eq('veh_patente', vehicleData.license_plate)
                .single();

            if (vehicleCheckError && vehicleCheckError.code !== 'PGRST116') { // PGRST116 es "not found"
                throw vehicleCheckError;
            }

            // Si el vehículo no existe, crearlo
            if (!existingVehicle) {
                const { error: createVehicleError } = await supabase
                    .from('vehiculos')
                    .insert({
                        veh_patente: vehicleData.license_plate,
                        catv_segmento: dbVehicleType
                    });

                if (createVehicleError) throw createVehicleError;
            }

            // Calcular precio basado en la duración seleccionada y tarifas disponibles
            let precioCalculado = 0;
            if (vehicleData.duracion_tipo && vehicleData.duracion_tipo !== 'hora') {
                // Buscar tarifa para la duración seleccionada
                const { data: tarifas } = await supabase
                    .from('tarifas')
                    .select('*')
                    .eq('est_id', estId)
                    .order('tar_f_desde', { ascending: false });

                if (tarifas && tarifas.length > 0) {
                    // Mapear duración a tiptar_nro
                    const duracionMap: { [key: string]: number } = {
                        'hora': 1,
                        'dia': 2,
                        'semana': 4,
                        'mes': 3
                    };

                    const tiptarNro = duracionMap[vehicleData.duracion_tipo] || 1;
                    const tarifaEncontrada = tarifas.find(t => t.tiptar_nro === tiptarNro);

                    if (tarifaEncontrada) {
                        precioCalculado = tarifaEncontrada.tar_precio;
                    }
                }
            }

            // Registrar la ocupación
            const { error: ocupacionError } = await supabase
                .from('ocupacion')
                .insert({
                    est_id: estId,
                    veh_patente: vehicleData.license_plate,
                    ocu_fh_entrada: new Date().toISOString(),
                    pla_numero: vehicleData.pla_numero,
                    ocu_duracion_tipo: vehicleData.duracion_tipo || 'hora',
                    ocu_precio_acordado: precioCalculado,
                    ocu_fecha_limite: vehicleData.fecha_limite || null
                });

            if (ocupacionError) throw ocupacionError;

            // Si se asignó una plaza específica, actualizarla como ocupada
            if (vehicleData.pla_numero) {
                const { error: plazaUpdateError } = await supabase
                    .from('plazas')
                    .update({ pla_estado: 'Ocupada' })
                    .eq('pla_numero', vehicleData.pla_numero)
                    .eq('est_id', estId);

                if (plazaUpdateError) {
                    console.warn('Error actualizando estado de plaza:', plazaUpdateError);
                    // No lanzar error aquí porque la ocupación ya se registró exitosamente
                }
            }

            await refreshParkedVehicles();
            await Promise.all([
                fetchPlazasStatus(),
                fetchPlazasCompletas()
            ]);

            toast({
                title: "Entrada registrada",
                description: `${vehicleData.license_plate} registrado por ${vehicleData.duracion_tipo || 'hora'}${precioCalculado > 0 ? ` - $${precioCalculado.toFixed(2)}` : ''}`
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

            // Buscar la ocupación activa del vehículo usando la vista
            const { data: ocupacion, error: ocupacionError } = await supabase
                .from('vw_ocupacion_actual')
                .select('*')
                .eq('license_plate', licensePlate)
                .eq('est_id', estId)
                .single();

            if (ocupacionError || !ocupacion) {
                throw new Error("Vehículo no encontrado o ya ha salido");
            }

            // Calcular tarifa
            const entryTime = new Date(ocupacion.entry_time);
            const exitTime = new Date();
            const durationMs = exitTime.getTime() - entryTime.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);

            // Calcular tarifa basada en las tarifas configuradas
            let fee = 0;
            if (rates && rates.length > 0) {
                // Buscar tarifa por tipo de vehículo usando catv_segmento
                const vehicleRate = rates.find((r: any) => {
                    const rateSegmento = r.catv_segmento;
                    return rateSegmento === ocupacion.type;
                });

                if (vehicleRate) {
                    // Calcular tarifa: precio base + (horas * precio por fracción)
                    const basePrice = parseFloat(vehicleRate.tar_precio) || 0;
                    const hourlyRate = parseFloat(vehicleRate.tar_fraccion) || 0;

                    if (durationHours <= 1) {
                        fee = basePrice;
                    } else {
                        fee = basePrice + (hourlyRate * (durationHours - 1));
                    }
                }
            }

            // Actualizar la ocupación marcando la salida
            const { error: updateError } = await supabase
                .from('ocupacion')
                .update({
                    ocu_fh_salida: exitTime.toISOString()
                })
                .eq('est_id', estId)
                .eq('veh_patente', licensePlate)
                .eq('ocu_fh_entrada', ocupacion.entry_time)
                .is('ocu_fh_salida', null);

            if (updateError) throw updateError;

            // Si había una plaza asignada, liberarla
            if (ocupacion.plaza_number) {
                const { error: plazaUpdateError } = await supabase
                    .from('plazas')
                    .update({ pla_estado: 'Libre' })
                    .eq('pla_numero', ocupacion.plaza_number)
                    .eq('est_id', estId);

                if (plazaUpdateError) {
                    console.warn('Error liberando plaza:', plazaUpdateError);
                    // No lanzar error aquí porque la salida ya se registró exitosamente
                }
            }

            // Actualizar datos
            await refreshParkedVehicles();
            await refreshParkingHistory();
            await Promise.all([
                fetchPlazasStatus(),
                fetchPlazasCompletas()
            ]);

            // Mostrar información de salida
            setExitInfo({
                vehicle: {
                    license_plate: ocupacion.license_plate,
                    type: ocupacion.type,
                    entry_time: ocupacion.entry_time,
                    plaza_number: ocupacion.plaza_number
                },
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

    // Funciones auxiliares para visualización de plazas
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
            <div className="p-6 space-y-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Panel de Operador</h1>
                    <p className="text-gray-600 mt-1">
                        Gestiona entradas y salidas de vehículos con visualización de zonas
                    </p>
                </div>

                {/* Panel de Operador Original */}
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
                    // Nuevas props para visualización rica
                    plazasCompletas={plazasCompletas}
                    loadingPlazasCompletas={loadingPlazasCompletas}
                    getEstadoColor={getEstadoColor}
                    getEstadoIcon={getEstadoIcon}
                />

            </div>
        </DashboardLayout>
    );
}
