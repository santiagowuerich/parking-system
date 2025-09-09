"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import UserParkings from "@/components/user-parkings";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function ParkingDashboardPage() {
    const { estId, setEstId, refreshParkedVehicles, refreshParkingHistory, refreshCapacity } = useAuth();
    const { toast } = useToast();

    const handleSelectParking = async (newEstId: number) => {
        console.log('🔄 Iniciando cambio de estacionamiento a:', newEstId);

        // Cambiar el estacionamiento en el contexto
        setEstId(newEstId);

        // Mostrar toast inmediatamente
        toast({
            title: "Cambiando estacionamiento...",
            description: `Cargando datos del estacionamiento ID: ${newEstId}`
        });

        // Pequeño delay para asegurar que el estado se actualice completamente
        setTimeout(async () => {
            try {
                // Refrescar datos del nuevo estacionamiento
                await Promise.all([
                    refreshParkedVehicles(),
                    refreshParkingHistory(),
                    refreshCapacity()
                ]);

                toast({
                    title: "Estacionamiento cambiado",
                    description: `Ahora estás gestionando el estacionamiento ID: ${newEstId}`
                });
            } catch (error) {
                console.error('Error al cambiar estacionamiento:', error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Error al cargar los datos del nuevo estacionamiento"
                });
            }
        }, 100);
    };

    return (
        <DashboardLayout>
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Mis Estacionamientos</h1>
                    <p className="text-gray-600 mt-1">
                        Administra y cambia entre tus diferentes estacionamientos
                    </p>
                </div>
                <UserParkings
                    onSelectParking={handleSelectParking}
                    currentEstId={estId || undefined}
                />
            </div>
        </DashboardLayout>
    );
}
