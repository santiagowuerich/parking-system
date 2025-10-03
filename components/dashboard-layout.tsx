"use client";

import { DashboardSidebar } from "./dashboard-sidebar";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth-context";
import { MapPin } from "lucide-react";
import { useState, useEffect } from "react";

interface DashboardLayoutProps {
    children: React.ReactNode;
    className?: string;
    clockComponent?: React.ReactNode;
}

export function DashboardLayout({ children, className, clockComponent }: DashboardLayoutProps) {
    const { estId, parkings, parkedVehicles, parkingCapacity } = useAuth();
    const [estacionamientoActual, setEstacionamientoActual] = useState<any>(null);

    // Cargar información del estacionamiento actual
    useEffect(() => {
        if (!estId) {
            setEstacionamientoActual(null);
            return;
        }

        const fromParkings = parkings.find(p => p.est_id === estId);
        if (fromParkings) {
            setEstacionamientoActual(fromParkings);
        }
    }, [estId, parkings]);

    // Calcular estadísticas
    const totalSpaces = parkingCapacity ?
        (parkingCapacity.Auto || 0) + (parkingCapacity.Moto || 0) + (parkingCapacity.Camioneta || 0) : 0;
    const occupiedSpaces = parkedVehicles?.length || 0;
    const occupancyRate = totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0;


    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <DashboardSidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header con información del estacionamiento y reloj */}
                <div className="border-b bg-card h-16 flex items-center">
                    <div className="px-6 py-3 flex justify-between items-center w-full">
                        {/* Información del estacionamiento */}
                        {estacionamientoActual && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <h2 className="text-sm font-semibold">
                                            {estacionamientoActual.est_nombre}
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            {estacionamientoActual.est_direc}
                                        </p>
                                    </div>
                                </div>
                                {totalSpaces > 0 && (
                                    <div className="flex items-center gap-2 ml-4">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            occupancyRate >= 90 ? 'bg-red-500' :
                                                occupancyRate >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                                        )} />
                                        <span className="text-xs text-muted-foreground">
                                            {occupiedSpaces}/{totalSpaces} ocupados ({occupancyRate}%)
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Reloj (opcional) */}
                        {clockComponent && (
                            <div className="flex items-center">
                                {clockComponent}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <main className={cn("flex-1 overflow-auto", className)}>
                    {children}
                </main>
            </div>

            {/* Toaster for notifications */}
            <Toaster />
        </div>
    );
}
