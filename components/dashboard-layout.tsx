"use client";

import { DashboardSidebar } from "./dashboard-sidebar";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth-context";
import { MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DashboardLayoutProps {
    children: React.ReactNode;
    className?: string;
    clockComponent?: React.ReactNode;
    showOperatorTabs?: boolean;
    onTabChange?: (tab: string) => void;
    activeTab?: string;
}

export function DashboardLayout({
    children,
    className,
    clockComponent,
    showOperatorTabs = false,
    onTabChange,
    activeTab = "plazas"
}: DashboardLayoutProps) {
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
                <div className="border-b bg-card">
                    <div className="px-6 py-3 flex justify-between items-center">
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
                            <div>
                                {clockComponent}
                            </div>
                        )}
                    </div>

                    {/* Tabs del operador (opcional) */}
                    {showOperatorTabs && (
                        <div className="px-6 pb-2">
                            <Tabs value={activeTab} onValueChange={onTabChange}>
                                <TabsList className="grid w-full max-w-md grid-cols-3">
                                    <TabsTrigger value="plazas">Plazas</TabsTrigger>
                                    <TabsTrigger value="vehiculos">Vehículos</TabsTrigger>
                                    <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    )}
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
