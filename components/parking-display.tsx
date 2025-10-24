"use client";

import { useState } from "react";
import { MapPin, ChevronDown, Check } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface ParkingDisplayProps {
    compact?: boolean;
    className?: string;
}

export function ParkingDisplay({ compact = false, className }: ParkingDisplayProps) {
    const { estId, parkings, setEstId, getParkingById, parkingsLoading } = useAuth();
    const [open, setOpen] = useState(false);

    const currentParking = estId ? getParkingById(estId) : null;

    const handleParkingSelect = async (parking: any) => {
        if (parking.est_id !== estId) {
            console.log('🔄 Cambiando estacionamiento a:', parking.est_nombre, 'ID:', parking.est_id);

            // 1. Guardar inmediatamente en localStorage para que persista
            if (typeof window !== 'undefined') {
                localStorage.setItem('parking_est_id', String(parking.est_id));
                console.log('💾 Guardado en localStorage:', parking.est_id);
            }

            // 2. Actualizar el contexto
            setEstId(parking.est_id);

            // 3. Cerrar el popover
            setOpen(false);

            // 4. Dar un pequeño tiempo para que el guardado en localStorage termine
            setTimeout(() => {
                // 5. Recargar la página para actualizar todos los datos
                window.location.reload();
            }, 100);
        } else {
            setOpen(false);
        }
    };

    if (parkingsLoading) {
        return (
            <div className={cn(
                "bg-gradient-to-r from-blue-50/50 to-transparent border border-blue-100 rounded-xl p-3.5 shadow-sm animate-pulse",
                className
            )}>
                <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                    <MapPin className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentParking || parkings.length === 0) {
        return (
            <div className={cn(
                "bg-gradient-to-r from-blue-50/50 to-transparent border border-blue-100 rounded-xl p-3.5 shadow-sm",
                className
            )}>
                <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                    <MapPin className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0"></div>
                            <span className="text-sm font-medium truncate">Seleccionar estacionamiento</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Solo mostrar el dropdown si hay más de un estacionamiento
    if (parkings.length === 1) {
        return (
            <div className={cn(
                "bg-gradient-to-r from-blue-50/50 to-transparent border border-blue-100 rounded-xl p-3.5 shadow-sm",
                className
            )}>
                <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                    <MapPin className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-2 h-2 bg-green-500 rounded-full shadow-sm shadow-green-500/50 animate-pulse flex-shrink-0"></div>
                            <span className="text-sm font-medium truncate">{currentParking.est_nombre}</span>
                        </div>
                        {currentParking.est_direc && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 ml-4 truncate">
                                {currentParking.est_direc}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className={cn(
                    "w-full bg-gradient-to-r from-blue-50/50 to-transparent border border-blue-100 rounded-xl p-3.5 shadow-sm hover:from-blue-100/50 hover:border-blue-200 transition-all",
                    className
                )}>
                    <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                        <MapPin className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 mb-0.5">
                                <div className="w-2 h-2 bg-green-500 rounded-full shadow-sm shadow-green-500/50 animate-pulse flex-shrink-0"></div>
                                <span className="text-sm font-medium truncate">{currentParking.est_nombre}</span>
                            </div>
                            {currentParking.est_direc && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 ml-4 truncate">
                                    {currentParking.est_direc}
                                </p>
                            )}
                        </div>
                        <ChevronDown className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2 dark:bg-slate-900 dark:border-slate-700" align="start">
                <div className="space-y-1">
                    <p className="text-xs text-gray-500 dark:text-slate-400 px-2 py-1 font-medium">
                        Seleccionar estacionamiento
                    </p>
                    <div className="max-h-64 overflow-y-auto">
                        {parkings.map((parking) => (
                            <button
                                key={parking.est_id}
                                onClick={() => handleParkingSelect(parking)}
                                className={cn(
                                    "w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-left",
                                    estId === parking.est_id && "bg-blue-50 dark:bg-blue-950/30"
                                )}
                            >
                                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex-shrink-0 mt-0.5">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">
                                        {parking.est_nombre}
                                    </div>
                                    {parking.est_direc && (
                                        <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                            {parking.est_direc}
                                        </div>
                                    )}
                                    {parking.est_tel && (
                                        <div className="text-xs text-gray-400 dark:text-slate-500 truncate">
                                            Tel: {parking.est_tel}
                                        </div>
                                    )}
                                </div>
                                {estId === parking.est_id && (
                                    <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-2" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
