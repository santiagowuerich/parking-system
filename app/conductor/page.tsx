"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ParkingMap from "@/components/parking-map";
import { useUserRole } from "@/lib/use-user-role";

declare global {
    interface Window {
        centerMapOnUserLocation: () => void;
    }
}
import {
    MapPin,
    Search,
    Navigation2,
    Settings,
    Filter,
    Map,
    Layers,
    Loader2
} from "lucide-react";

interface ParkingData {
    id: number;
    nombre: string;
    direccion: string;
    direccionCompleta: string;
    localidad: string;
    provincia: string;
    latitud: number;
    longitud: number;
    capacidad: number;
    espaciosDisponibles: number;
    horarioFuncionamiento: number;
    telefono?: string;
    email?: string;
    estado: 'disponible' | 'pocos' | 'lleno';
}

export default function MapaEstacionamientos() {
    const [searchText, setSearchText] = useState("");
    const [soloDisponibles, setSoloDisponibles] = useState(true);
    const [tipoTechado, setTipoTechado] = useState(false);
    const [selectedParking, setSelectedParking] = useState<ParkingData | null>(null);
    const { isDriver, isEmployee, isOwner, loading: roleLoading } = useUserRole();

    // Función para manejar la selección de estacionamiento desde el mapa
    const handleParkingSelect = (parking: ParkingData) => {
        console.log('🏢 Estacionamiento seleccionado:', parking);
        setSelectedParking(parking);
    };

    // Mostrar loading mientras se determina el rol del usuario O si no es conductor
    // Prevenir flash de contenido incorrecto
    if (roleLoading || !isDriver) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">
                            {!roleLoading && isOwner ? 'Redirigiendo...' :
                                !roleLoading && isEmployee ? 'Redirigiendo...' :
                                    'Cargando mapa...'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            {!roleLoading && isOwner ? 'Dirigiéndote al dashboard principal' :
                                !roleLoading && isEmployee ? 'Dirigiéndote al panel de operador' :
                                    'Determinando permisos del usuario'}
                        </p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="h-screen bg-gray-50 flex flex-col">
                {/* Header */}
                <div className="bg-white border-b px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Mapa de Estacionamientos</h1>
                            <p className="text-gray-600">
                                Encontrá y navegá a los estacionamientos disponibles cerca tuyo
                            </p>
                        </div>
                    </div>

                    {/* Search y Controles */}
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[300px]">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar dirección o estacionamiento"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (window.centerMapOnUserLocation) {
                                        console.log('🎯 Ejecutando centrar mapa en ubicación...');
                                        window.centerMapOnUserLocation();
                                    } else {
                                        console.log('⚠️ Función no disponible aún');
                                    }
                                }}
                            >
                                <MapPin className="w-4 h-4 mr-2" />
                                Mi ubicación
                            </Button>

                            <Button
                                variant={soloDisponibles ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSoloDisponibles(!soloDisponibles)}
                                className={soloDisponibles ? "bg-green-600 text-white hover:bg-green-700" : ""}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    Sólo disponibles
                                </div>
                            </Button>

                            <Button
                                variant={tipoTechado ? "default" : "outline"}
                                size="sm"
                                onClick={() => setTipoTechado(!tipoTechado)}
                                className={tipoTechado ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                            >
                                Tipo: Techado
                            </Button>
                        </div>
                    </div>

                    {/* Leyenda */}
                    <div className="flex items-center gap-4 mt-4 text-sm">
                        <span className="text-gray-600">Leyenda:</span>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span>Disponible</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span>Seleccionado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span>Lleno</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                            <span>Pocos lugares</span>
                        </div>
                    </div>
                </div>

                {/* Contenido Principal */}
                <div className="flex-1 flex">
                    {/* Panel Izquierdo - Detalle del Estacionamiento Seleccionado */}
                    <div className="w-96 bg-white border-r flex-shrink-0">
                        <div className="p-6">
                            {selectedParking ? (
                                <Card className="border-2 border-blue-200">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-lg">{selectedParking.nombre}</h3>
                                            <Badge className={`px-2 py-1 ${selectedParking.estado === 'disponible'
                                                ? 'bg-green-100 text-green-800'
                                                : selectedParking.estado === 'pocos'
                                                    ? 'bg-orange-100 text-orange-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {selectedParking.estado === 'disponible' ? 'Disponible' :
                                                    selectedParking.estado === 'pocos' ? 'Pocos espacios' : 'Sin espacios'}
                                            </Badge>
                                        </div>

                                        <div className="space-y-3 text-sm">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                                                <span className="text-gray-600">{selectedParking.direccionCompleta || selectedParking.direccion}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Settings className="h-4 w-4 text-gray-500" />
                                                <span className="text-gray-600">{selectedParking.localidad}, {selectedParking.provincia}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full ${selectedParking.estado === 'disponible'
                                                        ? 'bg-green-500'
                                                        : selectedParking.estado === 'pocos'
                                                            ? 'bg-orange-500'
                                                            : 'bg-red-500'
                                                        }`}></div>
                                                    <span className="text-gray-600">
                                                        {selectedParking.espaciosDisponibles > 0
                                                            ? `${selectedParking.espaciosDisponibles} libres`
                                                            : 'Sin espacios disponibles'}
                                                    </span>
                                                </div>
                                                <span className="font-bold text-blue-600">
                                                    {selectedParking.horarioFuncionamiento === 24 ? '24hs' : `${selectedParking.horarioFuncionamiento}h`}
                                                </span>
                                            </div>
                                            {selectedParking.telefono && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-500">📞</span>
                                                    <span className="text-gray-600">{selectedParking.telefono}</span>
                                                </div>
                                            )}
                                        </div>

                                        <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700">
                                            <Navigation2 className="w-4 h-4 mr-2" />
                                            Navegar
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="border-2 border-gray-200">
                                    <CardContent className="p-6 text-center">
                                        <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                        <h3 className="font-semibold text-lg text-gray-700 mb-2">
                                            Selecciona un Estacionamiento
                                        </h3>
                                        <p className="text-gray-500 text-sm">
                                            Haz clic en cualquier marcador del mapa para ver los detalles del estacionamiento.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* Panel Centro - Mapa */}
                    <div className="flex-1 bg-gray-100 p-4">
                        <ParkingMap
                            onParkingSelect={handleParkingSelect}
                            selectedParkingId={selectedParking?.id}
                            className="h-full w-full"
                            onLocationButtonClick={() => { }}
                        />
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}