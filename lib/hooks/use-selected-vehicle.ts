import { useVehicle } from "@/lib/contexts/vehicle-context";

export function useSelectedVehicle() {
    const { selectedVehicle, setSelectedVehicle } = useVehicle();

    return {
        vehicle: selectedVehicle,
        selectVehicle: setSelectedVehicle,
        isSelected: (patente: string) => selectedVehicle?.patente === patente,
        vehicleType: selectedVehicle?.tipo || null
    };
}
