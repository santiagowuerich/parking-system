"use client";

import { Badge } from "@/components/ui/badge";
import { useVehicle } from "@/lib/contexts/vehicle-context";
import { Car, Bike, Truck } from "lucide-react";

export function VehicleDisplay({ compact = false }: { compact?: boolean }) {
    const { selectedVehicle } = useVehicle();

    if (!selectedVehicle) {
        return (
            <Badge variant="outline" className="text-gray-500">
                Sin vehículo seleccionado
            </Badge>
        );
    }

    const getVehicleIcon = (tipo: string) => {
        switch (tipo) {
            case 'AUT': return <Car className="w-4 h-4" />;
            case 'MOT': return <Bike className="w-4 h-4" />;
            case 'CAM': return <Truck className="w-4 h-4" />;
            default: return <Car className="w-4 h-4" />;
        }
    };

    const getVehicleColor = (tipo: string) => {
        switch (tipo) {
            case 'AUT': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'MOT': return 'bg-green-100 text-green-800 border-green-300';
            case 'CAM': return 'bg-purple-100 text-purple-800 border-purple-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    if (compact) {
        return (
            <Badge className={`flex items-center gap-2 ${getVehicleColor(selectedVehicle.tipo)}`}>
                {getVehicleIcon(selectedVehicle.tipo)}
                <span className="font-semibold">{selectedVehicle.patente}</span>
            </Badge>
        );
    }

    return (
        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border-2 ${getVehicleColor(selectedVehicle.tipo)}`}>
            {getVehicleIcon(selectedVehicle.tipo)}
            <div>
                <div className="font-semibold">{selectedVehicle.patente}</div>
                {(selectedVehicle.marca || selectedVehicle.modelo) && (
                    <div className="text-xs opacity-75">
                        {selectedVehicle.marca} {selectedVehicle.modelo}
                    </div>
                )}
            </div>
        </div>
    );
}
