"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import AdminPanel from "@/components/admin-panel";
import { useAuth } from "@/lib/auth-context";
import { createBrowserClient } from "@supabase/ssr";
import type { ParkingHistory, VehicleType } from "@/lib/types";
import { toast } from "@/components/ui/use-toast";

export default function PanelAdministradorPage() {
    const { user, estId, parkedVehicles, parkingCapacity, refreshCapacity } = useAuth();
    const [history, setHistory] = useState<ParkingHistory[]>([]);
    const [loading, setLoading] = useState(true);

    // Calcular espacios disponibles
    const availableSpaces = {
        Auto: (parkingCapacity?.Auto || 0) - (parkedVehicles?.filter(v => v.type === 'Auto').length || 0),
        Moto: (parkingCapacity?.Moto || 0) - (parkedVehicles?.filter(v => v.type === 'Moto').length || 0),
        Camioneta: (parkingCapacity?.Camioneta || 0) - (parkedVehicles?.filter(v => v.type === 'Camioneta').length || 0),
        total: {
            capacity: (parkingCapacity?.Auto || 0) + (parkingCapacity?.Moto || 0) + (parkingCapacity?.Camioneta || 0),
            occupied: parkedVehicles?.length || 0
        }
    };

    // Función para actualizar capacidad
    const handleUpdateCapacity = async (type: VehicleType, value: number) => {
        if (!estId || !user?.id) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se puede actualizar la capacidad sin estacionamiento seleccionado"
            });
            return;
        }

        try {
            const response = await fetch(`/api/capacity?est_id=${estId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    capacity: { ...parkingCapacity, [type]: value }
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Error al actualizar la capacidad");
            }

            await refreshCapacity();
            toast({
                title: "Capacidad actualizada",
                description: `Capacidad de ${type} actualizada a ${value} espacios`
            });
        } catch (error) {
            console.error("Error al actualizar capacidad:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo actualizar la capacidad"
            });
        }
    };

    // Función para eliminar entrada del historial
    const handleDeleteHistoryEntry = async (id: string) => {
        // No permitir eliminación de registros históricos por razones de auditoría
        toast({
            variant: "destructive",
            title: "Operación no permitida",
            description: "No se pueden eliminar registros históricos para mantener la integridad de los datos"
        });
        throw new Error("Eliminación de registros históricos no permitida");
    };

    // Función para actualizar entrada del historial
    const handleUpdateHistoryEntry = async (id: string, data: Partial<ParkingHistory>) => {
        // No permitir actualización de registros históricos por razones de auditoría
        toast({
            variant: "destructive",
            title: "Operación no permitida",
            description: "No se pueden modificar registros históricos para mantener la integridad de los datos"
        });
        throw new Error("Actualización de registros históricos no permitida");
    };

    // Función para reingresar vehículo
    const handleReenterVehicle = async (entry: ParkingHistory) => {
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

            const dbVehicleType = vehicleTypeMapping[entry.type as keyof typeof vehicleTypeMapping] || 'AUT';

            // Verificar si el vehículo ya existe, si no, crearlo
            const { data: existingVehicle, error: vehicleCheckError } = await supabase
                .from('vehiculos')
                .select('veh_patente')
                .eq('veh_patente', entry.license_plate)
                .single();

            if (vehicleCheckError && vehicleCheckError.code !== 'PGRST116') { // PGRST116 es "not found"
                throw vehicleCheckError;
            }

            // Si el vehículo no existe, crearlo
            if (!existingVehicle) {
                const { error: createVehicleError } = await supabase
                    .from('vehiculos')
                    .insert({
                        veh_patente: entry.license_plate,
                        catv_segmento: dbVehicleType
                    });

                if (createVehicleError) throw createVehicleError;
            }

            // Registrar la nueva ocupación
            const { error: ocupacionError } = await supabase
                .from('ocupacion')
                .insert({
                    est_id: estId,
                    veh_patente: entry.license_plate,
                    ocu_fh_entrada: new Date().toISOString()
                });

            if (ocupacionError) throw ocupacionError;

            // Eliminar del historial (esto debería funcionar ya que usa la vista correcta)
            await handleDeleteHistoryEntry(entry.id);

            toast({
                title: "Vehículo reingresado",
                description: `${entry.license_plate} ha sido reingresado exitosamente`
            });
        } catch (error) {
            console.error("Error al reingresar vehículo:", error);
            throw error;
        }
    };

    // Cargar historial
    useEffect(() => {
        const loadHistory = async () => {
            if (!estId) {
                setLoading(false);
                return;
            }

            try {
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                const { data, error } = await supabase
                    .from('vw_historial_estacionamiento')
                    .select('*')
                    .eq('est_id', estId)
                    .order('exit_time', { ascending: false });

                if (error) throw error;

                setHistory(data || []);
            } catch (error) {
                console.error("Error al cargar historial:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No se pudo cargar el historial de operaciones"
                });
            } finally {
                setLoading(false);
            }
        };

        loadHistory();
    }, [estId]);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="p-6">
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                            <p className="text-gray-600">Cargando panel de administrador...</p>
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
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Panel de Administrador</h2>
                        <p className="text-gray-600 mb-6">
                            Selecciona un estacionamiento para acceder al panel de administrador
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

    return (
        <DashboardLayout>
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Panel de Administrador</h1>
                    <p className="text-gray-600 mt-1">
                        Gestiona ingresos, capacidad y operaciones del estacionamiento
                    </p>
                </div>

                <AdminPanel
                    history={history}
                    availableSpaces={availableSpaces}
                    capacity={parkingCapacity || { Auto: 0, Moto: 0, Camioneta: 0 }}
                    onUpdateCapacity={handleUpdateCapacity}
                    onDeleteHistoryEntry={handleDeleteHistoryEntry}
                    onUpdateHistoryEntry={handleUpdateHistoryEntry}
                    onReenterVehicle={handleReenterVehicle}
                />
            </div>
        </DashboardLayout>
    );
}
