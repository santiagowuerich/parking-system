"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

interface Vehicle {
    id: string;
    patente: string;
    tipo: 'AUT' | 'MOT' | 'CAM';
    marca: string;
    modelo: string;
    color: string;
}

interface VehicleContextType {
    selectedVehicle: Vehicle | null;
    setSelectedVehicle: (vehicle: Vehicle | null) => void;
    vehicles: Vehicle[];
    loadingVehicles: boolean;
    refreshVehicles: () => Promise<void>;
    clearVehicleData: () => void;
}

const VehicleContext = createContext<VehicleContextType>({
    selectedVehicle: null,
    setSelectedVehicle: () => { },
    vehicles: [],
    loadingVehicles: false,
    refreshVehicles: async () => { },
    clearVehicleData: () => { },
});

export const useVehicle = () => useContext(VehicleContext);

export function VehicleProvider({ children }: { children: ReactNode }) {
    const { user, userRole } = useAuth();
    const [selectedVehicle, setSelectedVehicleState] = useState<Vehicle | null>(null);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(false);

    // Inicializar vehículo seleccionado desde localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && userRole === 'conductor') {
            const saved = localStorage.getItem('selected_vehicle');
            if (saved) {
                try {
                    const vehicle = JSON.parse(saved);
                    if (vehicle && vehicle.patente) {
                        console.log('🔄 Cargando vehículo desde localStorage:', vehicle.patente);
                        setSelectedVehicleState(vehicle);
                    } else {
                        localStorage.removeItem('selected_vehicle');
                    }
                } catch (error) {
                    console.error('Error parseando vehículo guardado:', error);
                    localStorage.removeItem('selected_vehicle');
                }
            }
        }
    }, [userRole]);

    // Cargar vehículos del conductor
    const refreshVehicles = async () => {
        if (!user?.id || userRole !== 'conductor') return;

        try {
            setLoadingVehicles(true);
            const response = await fetch('/api/conductor/vehicles');

            if (response.ok) {
                const data = await response.json();
                const vehicleList = data.vehicles || [];
                setVehicles(vehicleList);

                // Si no hay vehículo seleccionado y hay vehículos disponibles, seleccionar el primero
                setSelectedVehicleState(currentSelected => {
                    if (!currentSelected && vehicleList.length > 0) {
                        console.log('🚗 Seleccionando automáticamente el primer vehículo:', vehicleList[0].patente);
                        return vehicleList[0];
                    }
                    return currentSelected;
                });
            }
        } catch (error) {
            console.error('Error cargando vehículos:', error);
        } finally {
            setLoadingVehicles(false);
        }
    };

    // Validar que el vehículo seleccionado esté en la lista válida cuando cambien los vehículos
    useEffect(() => {
        if (vehicles.length === 0 && selectedVehicle) {
            // Si no hay vehículos y hay uno seleccionado, limpiarlo
            console.log('⚠️ No hay vehículos disponibles, limpiando selección');
            setSelectedVehicleState(null);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('selected_vehicle');
            }
        } else if (selectedVehicle && vehicles.length > 0) {
            // Validar que el vehículo seleccionado esté en la lista válida
            const isValidVehicle = vehicles.some(
                v => v.id === selectedVehicle.id || v.patente === selectedVehicle.patente
            );
            
            if (!isValidVehicle) {
                console.log('⚠️ Vehículo seleccionado no está en la lista válida, limpiando selección');
                setSelectedVehicleState(null);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('selected_vehicle');
                }
            }
        }
    }, [vehicles, selectedVehicle]);

    // Cargar vehículos al montar
    useEffect(() => {
        if (user?.id && userRole === 'conductor') {
            refreshVehicles();
        }
    }, [user?.id, userRole]);

    // Función para establecer vehículo seleccionado
    const setSelectedVehicle = async (vehicle: Vehicle | null) => {
        setSelectedVehicleState(vehicle);

        // Guardar en localStorage
        if (typeof window !== 'undefined') {
            if (vehicle) {
                localStorage.setItem('selected_vehicle', JSON.stringify(vehicle));
                console.log('💾 Vehículo guardado en localStorage:', vehicle.patente);
            } else {
                localStorage.removeItem('selected_vehicle');
                console.log('🗑️ Vehículo removido de localStorage');
            }
        }

        // Guardar en base de datos
        if (user?.id && userRole === 'conductor') {
            try {
                const response = await fetch('/api/conductor/select-vehicle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vehicleId: vehicle?.patente || null
                    })
                });

                if (response.ok) {
                    console.log('✅ Vehículo seleccionado guardado en BD');
                } else {
                    console.error('Error guardando selección en BD');
                }
            } catch (error) {
                console.error('Error guardando selección:', error);
            }
        }
    };

    // Función para limpiar completamente los datos de vehículos
    const clearVehicleData = () => {
        console.log('🧹 Limpiando datos de vehículos...');
        setSelectedVehicleState(null);

        // Limpiar localStorage
        if (typeof window !== 'undefined') {
            localStorage.removeItem('selected_vehicle');
        }

        // Recargar vehículos (automáticamente seleccionará el primero)
        if (user?.id && userRole === 'conductor') {
            refreshVehicles();
        }
    };

    return (
        <VehicleContext.Provider
            value={{
                selectedVehicle,
                setSelectedVehicle,
                vehicles,
                loadingVehicles,
                refreshVehicles,
                clearVehicleData
            }}
        >
            {children}
        </VehicleContext.Provider>
    );
}
