"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useVehicle } from "@/lib/contexts/vehicle-context";
import { Car, Bike, Truck, ChevronDown, Check } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function VehicleDisplay({ compact = false }: { compact?: boolean }) {
    const { selectedVehicle, vehicles, setSelectedVehicle } = useVehicle();
    const [open, setOpen] = useState(false);

    // Verificar que el vehículo seleccionado realmente pertenece a los vehículos del usuario
    // Esto previene mostrar información hardcodeada o de otros usuarios
    // También verificar que haya vehículos disponibles
    const isValidVehicle = vehicles.length > 0 && selectedVehicle && vehicles.some(v => v.id === selectedVehicle.id || v.patente === selectedVehicle.patente);

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

    const getVehicleLabel = (tipo: string) => {
        switch (tipo) {
            case 'AUT': return 'Auto';
            case 'MOT': return 'Moto';
            case 'CAM': return 'Camioneta';
            default: return 'Vehículo';
        }
    };

    // Si no hay vehículo seleccionado o el vehículo seleccionado no es válido (no está en la lista del usuario)
    if (!selectedVehicle || !isValidVehicle) {
        return (
            <Badge variant="outline" className="text-gray-500">
                Sin vehículo seleccionado
            </Badge>
        );
    }

    if (compact) {
        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        className={`flex items-center gap-2 h-auto px-3 py-1.5 ${getVehicleColor(selectedVehicle.tipo)} hover:opacity-80`}
                    >
                        {getVehicleIcon(selectedVehicle.tipo)}
                        <span className="font-semibold">{selectedVehicle.patente}</span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="end">
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 px-2 py-1 font-medium">Seleccionar vehículo</p>
                        {vehicles.map((vehicle) => (
                            <button
                                key={vehicle.id}
                                onClick={() => {
                                    setSelectedVehicle(vehicle);
                                    setOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-100 transition-colors ${selectedVehicle?.id === vehicle.id ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <div className={`flex items-center justify-center w-8 h-8 rounded-md ${getVehicleColor(vehicle.tipo)}`}>
                                    {getVehicleIcon(vehicle.tipo)}
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold text-sm text-gray-900">{vehicle.patente}</div>
                                    <div className="text-xs text-gray-500">
                                        {getVehicleLabel(vehicle.tipo)}
                                        {vehicle.marca && ` - ${vehicle.marca}`}
                                        {vehicle.modelo && ` ${vehicle.modelo}`}
                                    </div>
                                </div>
                                {selectedVehicle?.id === vehicle.id && (
                                    <Check className="w-4 h-4 text-blue-600" />
                                )}
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className={`group flex items-center gap-2 px-3 py-2 rounded-xl border border-white/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer ${selectedVehicle.tipo === 'AUT' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700' :
                        selectedVehicle.tipo === 'MOT' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700' :
                            'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                    }`}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm">
                        {getVehicleIcon(selectedVehicle.tipo)}
                    </div>
                    <div className="text-left">
                        <div className="font-bold text-sm leading-tight">{selectedVehicle.patente}</div>
                        {(selectedVehicle.marca || selectedVehicle.modelo) && (
                            <div className="text-xs opacity-90 leading-tight">
                                {selectedVehicle.marca} {selectedVehicle.modelo}
                            </div>
                        )}
                    </div>
                    <ChevronDown className="w-4 h-4 ml-1 opacity-80 group-hover:opacity-100 transition-opacity" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="end">
                <div className="space-y-1">
                    <p className="text-xs text-gray-500 px-2 py-1 font-medium">Seleccionar vehículo</p>
                    {vehicles.map((vehicle) => (
                        <button
                            key={vehicle.id}
                            onClick={() => {
                                setSelectedVehicle(vehicle);
                                setOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-100 transition-colors ${selectedVehicle?.id === vehicle.id ? 'bg-blue-50' : ''
                                }`}
                        >
                            <div className={`flex items-center justify-center w-10 h-10 rounded-md ${getVehicleColor(vehicle.tipo)}`}>
                                {getVehicleIcon(vehicle.tipo)}
                            </div>
                            <div className="flex-1 text-left">
                                <div className="font-semibold text-gray-900">{vehicle.patente}</div>
                                <div className="text-xs text-gray-500">
                                    {getVehicleLabel(vehicle.tipo)}
                                    {vehicle.marca && ` - ${vehicle.marca}`}
                                    {vehicle.modelo && ` ${vehicle.modelo}`}
                                </div>
                            </div>
                            {selectedVehicle?.id === vehicle.id && (
                                <Check className="w-5 h-5 text-blue-600" />
                            )}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
