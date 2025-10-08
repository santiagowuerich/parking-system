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
}

const VehicleContext = createContext<VehicleContextType>({
    selectedVehicle: null,
    setSelectedVehicle: () => { },
    vehicles: [],
    loadingVehicles: false,
    refreshVehicles: async () => { },
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
                    setSelectedVehicleState(vehicle);
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
                setVehicles(data.vehicles || []);
            }
        } catch (error) {
            console.error('Error cargando vehículos:', error);
        } finally {
            setLoadingVehicles(false);
        }
    };

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

    return (
        <VehicleContext.Provider
            value={{
                selectedVehicle,
                setSelectedVehicle,
                vehicles,
                loadingVehicles,
                refreshVehicles
            }}
        >
            {children}
        </VehicleContext.Provider>
    );
}
