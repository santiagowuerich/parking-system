"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useVehicle } from "@/lib/contexts/vehicle-context";
import { Car, Bike, Truck, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function VehicleSelector() {
    const { selectedVehicle, setSelectedVehicle, vehicles, loadingVehicles } = useVehicle();
    const router = useRouter();

    const getVehicleIcon = (tipo: string) => {
        switch (tipo) {
            case 'AUT': return <Car className="w-6 h-6" />;
            case 'MOT': return <Bike className="w-6 h-6" />;
            case 'CAM': return <Truck className="w-6 h-6" />;
            default: return <Car className="w-6 h-6" />;
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

    if (loadingVehicles) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Selecciona tu Vehículo</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500">Cargando vehículos...</p>
                </CardContent>
            </Card>
        );
    }

    if (vehicles.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No tienes vehículos registrados</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                        Necesitas registrar al menos un vehículo para buscar estacionamientos.
                    </p>
                    <Button onClick={() => router.push('/conductor/vehiculos')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Vehículo
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-2 border-blue-500">
            <CardHeader>
                <CardTitle>Vehículo Actual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {selectedVehicle ? (
                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        {getVehicleIcon(selectedVehicle.tipo)}
                        <div className="flex-1">
                            <div className="font-semibold text-gray-900">{selectedVehicle.patente}</div>
                            <div className="text-sm text-gray-600">
                                {getVehicleLabel(selectedVehicle.tipo)}
                                {selectedVehicle.marca && ` - ${selectedVehicle.marca}`}
                                {selectedVehicle.modelo && ` ${selectedVehicle.modelo}`}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedVehicle(null)}
                        >
                            Cambiar
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">Selecciona el vehículo que vas a usar:</p>
                        <div className="grid gap-2">
                            {vehicles.map((vehicle) => (
                                <Button
                                    key={vehicle.patente}
                                    variant="outline"
                                    className="justify-start h-auto p-4"
                                    onClick={() => setSelectedVehicle(vehicle)}
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        {getVehicleIcon(vehicle.tipo)}
                                        <div className="text-left flex-1">
                                            <div className="font-semibold">{vehicle.patente}</div>
                                            <div className="text-xs text-gray-500">
                                                {getVehicleLabel(vehicle.tipo)}
                                                {vehicle.marca && ` - ${vehicle.marca}`}
                                            </div>
                                        </div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/conductor/vehiculos')}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Gestionar Vehículos
                </Button>
            </CardContent>
        </Card>
    );
}
