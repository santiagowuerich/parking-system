"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ParkingMap from "@/components/parking-map";
import { useUserRole } from "@/lib/use-user-role";
import { VehicleSelector } from "@/components/vehicle-selector";
import { VehicleDisplay } from "@/components/vehicle-display";
import { useVehicle } from "@/lib/contexts/vehicle-context";
import { CrearReservaDialog } from "@/components/reservas/crear-reserva-dialog";
import { ValoracionButton } from "@/components/valoraciones/valoracion-button";

declare global {
    interface Window {
        centerMapOnUserLocation: () => void;
    }
}
import { Calendar, Loader2, Search, MapPin, Navigation2, Star } from "lucide-react";
import { HorarioFranja, EstadoApertura } from "@/lib/types/horarios";

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
    telefono?: string;
    email?: string;
    estado: 'disponible' | 'pocos' | 'lleno';
    distance?: number; // Para estacionamientos cercanos
    est_publicado?: boolean;
    est_requiere_llave?: 'no' | 'opcional' | 'requerida';
    descripcion?: string;
    tolerancia?: number;
    horarios?: HorarioFranja[];
    estadoApertura?: EstadoApertura;
    tipoDisponibilidad?: 'configurada' | 'fisica';
    promedioValoracion?: number;
    totalValoraciones?: number;
    tieneMercadoPago?: boolean; // ✅ Indica si tiene MercadoPago configurado
}

export default function MapaEstacionamientos() {
    const [searchText, setSearchText] = useState("");
    const [tipoTechado, setTipoTechado] = useState(false);
    const { selectedVehicle } = useVehicle();
    const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'AUT' | 'MOT' | 'CAM' | null>(selectedVehicle?.tipo || null);
    const [selectedParking, setSelectedParking] = useState<ParkingData | null>(null);
    const [allParkings, setAllParkings] = useState<ParkingData[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [searchRadius, setSearchRadius] = useState<number>(2); // Radio en km
    const [reservaDialogOpen, setReservaDialogOpen] = useState(false);
    const [plazasDisponibles, setPlazasDisponibles] = useState<any[]>([]); // Plazas disponibles para reserva
    const { isDriver, isEmployee, isOwner, loading: roleLoading } = useUserRole();
    const parkingCardRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    // Auto-aplicar filtro según vehículo seleccionado
    useEffect(() => {
        if (selectedVehicle) {
            setVehicleTypeFilter(selectedVehicle.tipo);
            console.log('🚗 Filtro de vehículo activado automáticamente:', selectedVehicle.tipo);
        } else {
            // Si no hay vehículo seleccionado, quitar filtro
            setVehicleTypeFilter(null);
            console.log('🚫 Filtro de vehículo desactivado (sin vehículo seleccionado)');
        }
    }, [selectedVehicle]);

    // Aplicar filtro inmediatamente cuando se obtiene ubicación
    const handleUserLocationUpdate = (location: { lat: number, lng: number }) => {
        setUserLocation(location);

        // Forzar aplicación del filtro del vehículo seleccionado cuando se obtiene ubicación
        if (selectedVehicle) {
            console.log('🚗 Aplicando filtro de vehículo seleccionado al obtener ubicación:', selectedVehicle.tipo);
            setVehicleTypeFilter(selectedVehicle.tipo);
            // Resetear allParkings para forzar recarga con filtro aplicado
            setAllParkings([]);
        } else {
            console.log('⚠️ No hay vehículo seleccionado, no se aplica filtro automático');
        }
    };

    // Función para obtener plazas disponibles del estacionamiento seleccionado
    const obtenerPlazasDisponibles = async (estId: number) => {
        try {
            const ahora = new Date();
            const proximaHora = new Date(ahora.getTime() + 60 * 60 * 1000); // 1 hora adelante

            const response = await fetch(`/api/reservas/disponibilidad?est_id=${estId}&fecha_inicio=${proximaHora.toISOString()}&duracion_horas=1`);
            const result = await response.json();

            if (result.success && result.data) {
                setPlazasDisponibles(result.data.plazas);
            } else {
                setPlazasDisponibles([]);
            }
        } catch (error) {
            console.error('Error obteniendo plazas disponibles:', error);
            setPlazasDisponibles([]);
        }
    };

    // Obtener plazas cuando se selecciona un estacionamiento
    useEffect(() => {
        if (selectedParking) {
            obtenerPlazasDisponibles(selectedParking.id);
        }
    }, [selectedParking]);

    // Hacer scroll automático al card expandido cuando se selecciona un estacionamiento
    useEffect(() => {
        if (selectedParking) {
            // Usar requestAnimationFrame y setTimeout para asegurar que el DOM se haya actualizado completamente
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const cardElement = parkingCardRefs.current[selectedParking.id];
                    if (cardElement) {
                        cardElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'nearest'
                        });
                    }
                }, 150);
            });
        }
    }, [selectedParking]);

    // Función para calcular la distancia entre dos puntos (Haversine formula)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Función para obtener estacionamientos cercanos basados en la ubicación del conductor
    const getNearbyParkings = (userLocation: { lat: number, lng: number }, allParkings: ParkingData[], radius: number): ParkingData[] => {
        const parkingsWithDistance = allParkings
            .map(parking => ({
                ...parking,
                distance: calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    parking.latitud,
                    parking.longitud
                )
            }))
            .filter(parking => parking.distance <= radius)
            .sort((a, b) => a.distance - b.distance); // Ordenar por distancia

        return parkingsWithDistance.slice(0, 10); // Mostrar hasta 10 estacionamientos
    };

    // Función para cargar todos los estacionamientos (eliminada - se maneja en ParkingMap)
    // const fetchAllParkings = async () => {
    //     try {
    //         const response = await fetch('/api/parkings');
    //         if (response.ok) {
    //             const data = await response.json();
    //             setAllParkings(data.parkings || []);
    //         }
    //     } catch (error) {
    //         console.error('Error cargando estacionamientos:', error);
    //     }
    // };

    // Cargar estacionamientos al montar el componente (eliminado - se maneja en ParkingMap)
    // useEffect(() => {
    //     fetchAllParkings();
    // }, []);

    // Función para manejar cuando se cargan los estacionamientos desde ParkingMap
    const handleParkingsLoaded = (parkings: ParkingData[]) => {
        console.log('📥 Estacionamientos cargados:', parkings.length);
        setAllParkings(parkings);

        // Si hay un estacionamiento seleccionado, actualizarlo con los nuevos datos filtrados
        if (selectedParking) {
            const updatedParking = parkings.find(p => p.id === selectedParking.id);
            if (updatedParking) {
                console.log('🔄 Estacionamiento actualizado con filtro');
                setSelectedParking(updatedParking);
            }
        }
    };

    // Función para manejar la selección de estacionamiento desde el mapa
    const handleParkingSelect = (parking: ParkingData) => {
        console.log('🏢 Estacionamiento seleccionado:', parking.nombre);
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
                <div id="map-header" className="bg-white border-b px-8 py-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                                Mapa de Estacionamientos
                            </h1>
                            <p className="text-lg text-gray-600 max-w-2xl">
                                Encontrá y navegá a los estacionamientos disponibles cerca tuyo
                            </p>
                        </div>

                        {/* 🟢 NUEVO: Mostrar vehículo seleccionado */}
                        <div className="flex items-center gap-4">
                            <VehicleDisplay />
                        </div>
                    </div>

                    {/* Search y Controles */}
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center gap-6 flex-wrap">
                            {/* Search Input */}
                            <div className="relative flex-1 min-w-[350px]">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input
                                    placeholder="Buscar dirección o estacionamiento"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    className="pl-12 h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            {/* Botones de Acción */}
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => {
                                        if (window.centerMapOnUserLocation) {
                                            window.centerMapOnUserLocation();
                                        }
                                    }}
                                    className="h-12 px-6 border-gray-300 hover:border-blue-500 hover:text-blue-600"
                                >
                                    <MapPin className="w-4 h-4 mr-2" />
                                    Mi ubicación
                                </Button>

                                {/* Filtro por tipo de vehículo - Desplegable */}
                                <Select
                                    value={vehicleTypeFilter || 'all'}
                                    onValueChange={(value) => setVehicleTypeFilter(value === 'all' ? null : value as 'AUT' | 'MOT' | 'CAM')}
                                >
                                    <SelectTrigger className="h-12 px-4 w-[140px] border-gray-300 hover:border-blue-500">
                                        <SelectValue placeholder="Tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="AUT">🚗 Auto</SelectItem>
                                        <SelectItem value="MOT">🏍️ Moto</SelectItem>
                                        <SelectItem value="CAM">🚙 Camioneta</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                        </div>
                    </div>

                </div>

                {/* Contenido Principal */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Panel Izquierdo - Detalle del Estacionamiento Seleccionado */}
                    <div className="w-96 bg-white border-r border-gray-200 flex-shrink-0 shadow-lg overflow-y-auto">
                        <div className="p-8">

                            {(selectedParking || userLocation) ? (
                                <div>
                                    {/* Mostrar estacionamientos cercanos si hay ubicación del usuario */}
                                    {userLocation && (
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-lg font-semibold text-gray-900">
                                                    Estacionamientos Cercanos a Ti
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-600">Radio:</span>
                                                    <Select value={searchRadius.toString()} onValueChange={(value) => setSearchRadius(Number(value))}>
                                                        <SelectTrigger className="w-20 h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="1">1km</SelectItem>
                                                            <SelectItem value="2">2km</SelectItem>
                                                            <SelectItem value="5">5km</SelectItem>
                                                            <SelectItem value="10">10km</SelectItem>
                                                            <SelectItem value="20">20km</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {getNearbyParkings(userLocation, allParkings, searchRadius).length > 0 ? (
                                                    getNearbyParkings(userLocation, allParkings, searchRadius).map((parking) => (
                                                        <div 
                                                            key={parking.id}
                                                            ref={(el) => {
                                                                if (el && selectedParking?.id === parking.id) {
                                                                    parkingCardRefs.current[parking.id] = el;
                                                                } else if (!selectedParking || selectedParking.id !== parking.id) {
                                                                    // Limpiar ref cuando el card se cierra
                                                                    delete parkingCardRefs.current[parking.id];
                                                                }
                                                            }}
                                                        >
                                                            {selectedParking?.id === parking.id ? (
                                                                // Vista expandida - Detalles completos
                                                                <Card className="border-2 border-blue-500 bg-white shadow-xl cursor-pointer transition-all duration-300"
                                                                    onClick={() => setSelectedParking(null)}>
                                                                    <CardContent className="p-6">
                                                                        <div className="mb-6">
                                                                            <div className="flex items-start justify-between mb-4">
                                                                                <div className="flex-1 min-w-0">
                                                                                    <h3 className="font-bold text-xl text-gray-900 mb-2 overflow-hidden text-ellipsis whitespace-nowrap" title={parking.nombre}>{parking.nombre}</h3>
                                                                                    <div className="flex items-center gap-2 mb-1">
                                                                                        <MapPin className="h-4 w-4 text-gray-500" />
                                                                                        <span className="text-gray-600 text-sm">{parking.direccion.split(',')[0]}</span>
                                                                                    </div>
                                                                                    {/* Horario pequeño solo si tiene horario configurado */}
                                                                                    {parking.estadoApertura && parking.estadoApertura.hasSchedule && (
                                                                                        <div className="flex items-center gap-1 mb-1">
                                                                                            <span className="text-xs">🕒</span>
                                                                                            <span className={`text-xs font-medium ${parking.estadoApertura.isOpen ? 'text-green-600' : 'text-red-600'
                                                                                                }`}>
                                                                                                {parking.estadoApertura.isOpen ? 'Abierto' : 'Cerrado'}
                                                                                            </span>
                                                                                            {parking.estadoApertura.nextChange && (
                                                                                                <span className="text-xs text-gray-500">
                                                                                                    • Abre {parking.estadoApertura.nextChange.includes('08:00') ? '8am' : parking.estadoApertura.nextChange.includes('18:00') ? '6pm' : parking.estadoApertura.nextChange.replace('Abre a las ', '').replace('Cierra a las ', '').split(':')[0] + 'h'}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                    {parking.distance && (
                                                                                        <div className="text-blue-600 text-sm font-bold">
                                                                                            {parking.distance.toFixed(1)} km de distancia
                                                                                        </div>
                                                                                    )}
                                                                                    {/* Promedio de valoraciones */}
                                                                                    {parking.totalValoraciones && parking.totalValoraciones > 0 ? (
                                                                                        <div className="flex items-center gap-1.5 mt-1">
                                                                                            <div className="flex items-center">
                                                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                                                    <Star
                                                                                                        key={star}
                                                                                                        className={`h-4 w-4 ${
                                                                                                            star <= Math.round(parking.promedioValoracion || 0)
                                                                                                                ? 'fill-yellow-400 text-yellow-400'
                                                                                                                : 'fill-gray-200 text-gray-200'
                                                                                                        }`}
                                                                                                    />
                                                                                                ))}
                                                                                            </div>
                                                                                            <span className="text-sm font-semibold text-gray-700">
                                                                                                {(parking.promedioValoracion || 0).toFixed(1)}
                                                                                            </span>
                                                                                            <span className="text-xs text-gray-500">
                                                                                                ({parking.totalValoraciones})
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="text-xs text-gray-400 mt-1">Sin valoraciones</div>
                                                                                    )}
                                                                                </div>
                                                                                <Badge className={`px-3 py-1 text-sm font-semibold w-fit ml-3 ${parking.estadoApertura && !parking.estadoApertura.isOpen
                                                                                    ? 'bg-gray-600 text-white hover:bg-gray-600'
                                                                                    : parking.estado === 'disponible'
                                                                                        ? 'bg-green-600 text-white hover:bg-green-600'
                                                                                        : parking.estado === 'pocos'
                                                                                            ? 'bg-orange-600 text-white hover:bg-orange-600'
                                                                                            : 'bg-red-600 text-white hover:bg-red-600'
                                                                                    }`}>
                                                                                    {parking.estadoApertura && !parking.estadoApertura.isOpen
                                                                                        ? 'Cerrado'
                                                                                        : parking.estado === 'disponible' ? 'Disponible' :
                                                                                            parking.estado === 'pocos' ? 'Pocos espacios' : 'Sin espacios'}
                                                                                </Badge>
                                                                            </div>
                                                                        </div>

                                                                        {/* Información de plazas disponibles */}
                                                                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                                                            <div className="flex items-center justify-center">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className={`w-4 h-4 rounded-full ${parking.estado === 'disponible'
                                                                                        ? 'bg-green-500'
                                                                                        : parking.estado === 'pocos'
                                                                                            ? 'bg-orange-500'
                                                                                            : 'bg-red-500'
                                                                                        }`}></div>
                                                                                    <span className="font-semibold text-gray-800">
                                                                                        {parking.espaciosDisponibles > 0
                                                                                            ? `${parking.espaciosDisponibles} libres`
                                                                                            : 'Sin espacios'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Información adicional: contacto */}
                                                                        <div className="space-y-4 mb-4">
                                                                            {/* Información de contacto - solo teléfono */}
                                                                            {parking.telefono && (
                                                                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                                                                                    <div className="flex items-center gap-2 text-sm text-gray-700">
                                                                                        <span>📞</span>
                                                                                        <span className="font-medium">{parking.telefono}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex flex-col gap-3">
                                                                            {/* Fila de botones */}
                                                                            <div className="flex gap-3 justify-center flex-wrap">
                                                                                <Button
                                                                                    className="flex-1 max-w-[200px] h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg shadow-lg"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (parking) {
                                                                                            // Crear la URL para Google Maps
                                                                                            const address = encodeURIComponent(
                                                                                                parking.direccionCompleta || parking.direccion
                                                                                            );
                                                                                            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}`;

                                                                                            // Abrir en nueva pestaña
                                                                                            window.open(googleMapsUrl, '_blank');

                                                                                            console.log('🧭 Navegando a:', parking.nombre, 'en', parking.direccionCompleta || parking.direccion);
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <Navigation2 className="w-5 h-5 mr-2" />
                                                                                    Navegar
                                                                                </Button>

                                                                                {plazasDisponibles.length > 0 && parking.tieneMercadoPago && (
                                                                                    <Button
                                                                                        className="flex-1 max-w-[200px] h-12 bg-green-600 hover:bg-green-700 text-white font-semibold text-lg shadow-lg"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setReservaDialogOpen(true);
                                                                                        }}
                                                                                    >
                                                                                        <Calendar className="w-5 h-5 mr-2" />
                                                                                        Reservar
                                                                                    </Button>
                                                                                )}
                                                                            </div>

                                                                            {/* Botón de valoraciones */}
                                                                            <div className="flex justify-center">
                                                                                <ValoracionButton
                                                                                    estacionamiento={{
                                                                                        est_id: parking.id,
                                                                                        est_nombre: parking.nombre
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>
                                                            ) : (
                                                                // Vista resumida - comprimida
                                                                <Card
                                                                    className="cursor-pointer transition-all duration-200 hover:shadow-md border border-gray-200 hover:border-blue-300"
                                                                    onClick={() => {
                                                                        setSelectedParking(parking);
                                                                        // Abrir popup en el mapa
                                                                        if ((window as any).openParkingPopup) {
                                                                            (window as any).openParkingPopup(parking.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    <CardContent className="p-4">
                                                                        <div className="flex items-start justify-between">
                                                                            <div className="flex-1">
                                                                                <h5 className="font-semibold text-gray-900 text-sm mb-1">
                                                                                    {parking.nombre}
                                                                                </h5>
                                                                                <p className="text-xs text-gray-600 mb-2">
                                                                                    {parking.direccion}
                                                                                </p>
                                                                                <div className="flex items-center justify-between">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <div className={`w-2 h-2 rounded-full ${parking.estado === 'disponible' ? 'bg-green-500' :
                                                                                                parking.estado === 'pocos' ? 'bg-orange-500' : 'bg-red-500'
                                                                                                }`}></div>
                                                                                            <span className="text-xs font-medium text-gray-700">
                                                                                                {parking.espaciosDisponibles > 0 ? `${parking.espaciosDisponibles} libres` : 'Sin espacios'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <span className="text-xs font-semibold text-blue-600">
                                                                                            {parking.distance?.toFixed(1)} km
                                                                                        </span>
                                                                                    </div>
                                                                                    {/* Promedio de valoraciones en vista comprimida */}
                                                                                    {parking.totalValoraciones && parking.totalValoraciones > 0 ? (
                                                                                        <div className="flex items-center gap-1 mt-1">
                                                                                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                                                            <span className="text-xs font-medium text-gray-600">
                                                                                                {(parking.promedioValoracion || 0).toFixed(1)}
                                                                                            </span>
                                                                                            <span className="text-xs text-gray-400">
                                                                                                ({parking.totalValoraciones})
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex items-center gap-1 mt-1">
                                                                                            <Star className="h-3 w-3 fill-gray-200 text-gray-300" />
                                                                                            <span className="text-xs text-gray-400">Sin valoraciones</span>
                                                                                        </div>
                                                                                    )}
                                                                            </div>
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                        <div className="flex items-center gap-2 text-yellow-700">
                                                            <MapPin className="h-4 w-4" />
                                                            <span className="text-sm font-medium">
                                                                No hay estacionamientos dentro de {searchRadius}km. Prueba aumentar el radio de búsqueda.
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Mensaje informativo si no hay ubicación del usuario */}
                                    {!userLocation && (
                                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-center gap-2 text-blue-700">
                                                <MapPin className="h-4 w-4" />
                                                <span className="text-sm font-medium">
                                                    Usa el botón "Mi Ubicación" para ver estacionamientos cercanos
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Card className="border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100">
                                    <CardContent className="p-8 text-center">
                                        <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                                            <MapPin className="h-10 w-10 text-gray-400" />
                                        </div>
                                        <h3 className="font-bold text-xl text-gray-700 mb-3">
                                            Selecciona un Estacionamiento
                                        </h3>
                                        <p className="text-gray-500 leading-relaxed">
                                            Haz clic en cualquier marcador del mapa para ver los detalles del estacionamiento y obtener direcciones.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* Panel Centro - Mapa */}
                    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                        <div className="h-full w-full">
                            <ParkingMap
                                onParkingSelect={handleParkingSelect}
                                selectedParkingId={selectedParking?.id}
                                className="h-full w-full"
                                onLocationButtonClick={() => { }}
                                onUserLocationUpdate={handleUserLocationUpdate}
                                userLocation={userLocation}
                                searchRadius={searchRadius}
                                onParkingsLoaded={handleParkingsLoaded}
                                vehicleTypeFilter={vehicleTypeFilter}
                            />
                        </div>
                    </div>

                </div>
            </div>

            {/* Dialog para crear reserva */}
            {selectedParking && (
                <CrearReservaDialog
                    open={reservaDialogOpen}
                    onOpenChange={setReservaDialogOpen}
                    estacionamiento={{
                        est_id: selectedParking.id,
                        est_nombre: selectedParking.nombre
                    }}
                    plazasDisponibles={plazasDisponibles}
                    vehiculoSeleccionado={selectedVehicle}
                />
            )}
        </DashboardLayout>
    );
}
