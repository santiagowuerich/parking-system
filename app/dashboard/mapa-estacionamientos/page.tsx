"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    MapPin,
    Navigation,
    Car,
    CheckCircle,
    Building,
    Clock,
    AlertCircle,
    Users
} from "lucide-react";

export default function MapaEstacionamientosPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedParking, setSelectedParking] = useState<any>(null);
    const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);
    const [filterType, setFilterType] = useState("");

    // Datos de ejemplo de estacionamientos
    const parkings = [
        {
            id: 1,
            name: "Parking Centro",
            address: "Av. Mitre 550",
            distance: "50 m",
            price: "$800/h",
            type: "Techado",
            available: 12,
            total: 25,
            status: "available", // available, few-spots, full
            open: true,
            coordinates: { lat: -27.4212, lng: -58.8329 }
        },
        {
            id: 2,
            name: "Mitre & Güemes",
            address: "Mitre esq. Güemes",
            distance: "120 m",
            price: "$700/h",
            type: "Descubierto",
            available: 3,
            total: 20,
            status: "few-spots",
            open: true,
            coordinates: { lat: -27.4220, lng: -58.8335 }
        },
        {
            id: 3,
            name: "Plaza 25 de Mayo",
            address: "Plaza 25 de Mayo",
            distance: "250 m",
            price: "$900/h",
            type: "Techado",
            available: 0,
            total: 15,
            status: "full",
            open: true,
            coordinates: { lat: -27.4230, lng: -58.8340 }
        }
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case "available": return "text-green-600";
            case "few-spots": return "text-orange-600";
            case "full": return "text-red-600";
            default: return "text-gray-600";
        }
    };

    const getStatusDot = (status: string) => {
        switch (status) {
            case "available": return "w-3 h-3 bg-green-500 rounded-full";
            case "few-spots": return "w-3 h-3 bg-orange-500 rounded-full";
            case "full": return "w-3 h-3 bg-red-500 rounded-full";
            default: return "w-3 h-3 bg-gray-500 rounded-full";
        }
    };

    const filteredParkings = parkings.filter(parking => {
        const matchesSearch = parking.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            parking.address.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAvailable = !showOnlyAvailable || parking.available > 0;
        const matchesType = !filterType || parking.type.toLowerCase().includes(filterType.toLowerCase());

        return matchesSearch && matchesAvailable && matchesType;
    });

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900">Mapa de Estacionamientos</h1>
                    <p className="text-gray-600">
                        Encontrá y navegá a los estacionamientos disponibles cerca tuyo
                    </p>
                </div>

                {/* Buscador y Filtros */}
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Buscador */}
                    <div className="flex-1">
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <Input
                                placeholder="Buscar dirección o estacionamiento"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm">
                            <Navigation className="w-4 h-4 mr-2" />
                            Mi ubicación
                        </Button>

                        <Button
                            variant={showOnlyAvailable ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
                        >
                            {showOnlyAvailable && <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />}
                            Sólo disponibles
                        </Button>

                        <Button
                            variant={filterType === "techado" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilterType(filterType === "techado" ? "" : "techado")}
                        >
                            Tipo: Techado
                        </Button>
                    </div>
                </div>

                {/* Leyenda */}
                <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full" />
                        <span>Disponible</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full" />
                        <span>Pocos lugares</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                        <span>Lleno</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        <span>Seleccionado</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Mapa */}
                    <div className="lg:col-span-2">
                        <Card className="h-[600px] overflow-hidden">
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Building className="w-5 h-5 mr-2" />
                                    Mapa de Estacionamientos
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {/* Simulación de mapa */}
                                <div className="relative w-full h-full bg-gradient-to-br from-gray-100 to-gray-200">
                                    {/* Calles simuladas */}
                                    <div className="absolute inset-0 p-8">
                                        <div className="space-y-4">
                                            <div className="h-1 bg-gray-400 w-full opacity-60" />
                                            <div className="h-1 bg-gray-400 w-4/5 opacity-60" />
                                            <div className="h-1 bg-gray-400 w-full opacity-60" />
                                            <div className="h-1 bg-gray-400 w-3/5 opacity-60" />
                                            <div className="h-1 bg-gray-400 w-full opacity-60" />
                                            <div className="h-1 bg-gray-400 w-4/5 opacity-60" />
                                        </div>

                                        {/* Pines de estacionamientos */}
                                        {filteredParkings.map((parking, index) => (
                                            <div
                                                key={parking.id}
                                                className={`absolute top-${16 + index * 20} left-${12 + index * 15} cursor-pointer`}
                                                onClick={() => setSelectedParking(parking)}
                                            >
                                                <div className={`
                          w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center
                          ${parking.status === 'available' ? 'bg-green-500' :
                                                        parking.status === 'few-spots' ? 'bg-orange-500' :
                                                            parking.status === 'full' ? 'bg-red-500' : 'bg-gray-500'}
                        `}>
                                                    <Car className="w-4 h-4 text-white" />
                                                </div>
                                                {selectedParking?.id === parking.id && (
                                                    <div className="absolute top-10 w-32 bg-blue-500 text-white text-xs p-2 rounded-lg">
                                                        {parking.name}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Etiquetas de ubicación */}
                                    <div className="absolute top-4 left-4 bg-white px-2 py-1 rounded text-xs font-medium">
                                        VILLA ITATÍ
                                    </div>
                                    <div className="absolute bottom-4 right-4 bg-white px-2 py-1 rounded text-xs font-medium">
                                        LESTANI
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Lista de Resultados */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Resultados cercanos</h3>

                        {selectedParking && (
                            <Card className="border-blue-200 bg-blue-50">
                                <CardHeader>
                                    <CardTitle className="text-blue-800">{selectedParking.name}</CardTitle>
                                    <p className="text-sm text-blue-600">{selectedParking.address}</p>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={getStatusDot(selectedParking.status)} />
                                            <span className="text-sm">{selectedParking.available} libres</span>
                                        </div>
                                        <Badge variant={selectedParking.open ? "default" : "secondary"}>
                                            {selectedParking.open ? "Abierto" : "Cerrado"}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-center gap-1">
                                            <Navigation className="w-3 h-3" />
                                            <span>{selectedParking.distance}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{selectedParking.price}</span>
                                        </div>
                                    </div>

                                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                                        Navegar
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {filteredParkings.map((parking) => (
                            <Card
                                key={parking.id}
                                className={`cursor-pointer transition-colors hover:bg-gray-50 ${selectedParking?.id === parking.id ? 'border-blue-300 bg-blue-50' : ''
                                    }`}
                                onClick={() => setSelectedParking(parking)}
                            >
                                <CardContent className="p-4">
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="font-medium">{parking.name}</h4>
                                            <p className="text-sm text-gray-600">{parking.address}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex items-center gap-1">
                                                <Navigation className="w-3 h-3" />
                                                <span>{parking.distance}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                <span>{parking.price}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={getStatusDot(parking.status)} />
                                                <span className="text-sm">
                                                    {parking.status === 'available' ? `${parking.available} libres` :
                                                        parking.status === 'few-spots' ? `${parking.available} libres` :
                                                            'Lleno'}
                                                </span>
                                            </div>
                                            <Badge variant="outline">{parking.type}</Badge>
                                        </div>

                                        <Button
                                            size="sm"
                                            className="w-full"
                                            variant={parking.status === 'full' ? 'secondary' : 'default'}
                                            disabled={parking.status === 'full'}
                                        >
                                            {parking.status === 'full' ? 'Ver' : 'Ir'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
