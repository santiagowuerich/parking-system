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
            <div className="p-8 space-y-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="space-y-4">
                    <div className="space-y-3">
                        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                            Mapa de Estacionamientos
                        </h1>
                        <p className="text-lg text-gray-600 max-w-2xl">
                            Encontrá y navegá a los estacionamientos disponibles cerca tuyo
                        </p>
                    </div>
                </div>

                {/* Buscador y Filtros */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Buscador */}
                        <div className="flex-1">
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <Input
                                    placeholder="Buscar dirección o estacionamiento"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-12 h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Filtros */}
                        <div className="flex gap-3 flex-wrap">
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-12 px-6 border-gray-300 hover:border-blue-500 hover:text-blue-600"
                            >
                                <Navigation className="w-4 h-4 mr-2" />
                                Mi ubicación
                            </Button>

                            <Button
                                variant={showOnlyAvailable ? "default" : "outline"}
                                size="lg"
                                onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
                                className={`h-12 px-6 ${showOnlyAvailable ? 'bg-green-600 hover:bg-green-700' : 'border-gray-300 hover:border-green-500 hover:text-green-600'}`}
                            >
                                {showOnlyAvailable && <div className="w-2 h-2 bg-white rounded-full mr-2" />}
                                Sólo disponibles
                            </Button>

                            <Button
                                variant={filterType === "techado" ? "default" : "outline"}
                                size="lg"
                                onClick={() => setFilterType(filterType === "techado" ? "" : "techado")}
                                className={`h-12 px-6 ${filterType === "techado" ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-300 hover:border-blue-500 hover:text-blue-600'}`}
                            >
                                Tipo: Techado
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Leyenda */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-8 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-500 rounded-full shadow-sm" />
                            <span className="font-medium text-gray-700">Disponible</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-500 rounded-full shadow-sm" />
                            <span className="font-medium text-gray-700">Seleccionado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-orange-500 rounded-full shadow-sm" />
                            <span className="font-medium text-gray-700">Pocos lugares</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-500 rounded-full shadow-sm" />
                            <span className="font-medium text-gray-700">Lleno</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Mapa */}
                    <div className="lg:col-span-2">
                        <Card className="h-[700px] overflow-hidden shadow-lg border-0 rounded-2xl">
                            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
                                <CardTitle className="flex items-center text-xl font-semibold text-gray-800">
                                    <Building className="w-6 h-6 mr-3 text-blue-600" />
                                    Mapa de Estacionamientos
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {/* Simulación de mapa mejorada */}
                                <div className="relative w-full h-full bg-gradient-to-br from-blue-50 via-white to-green-50">
                                    {/* Calles simuladas con mejor diseño */}
                                    <div className="absolute inset-0 p-12">
                                        <div className="space-y-6">
                                            <div className="h-1.5 bg-gray-400 w-full opacity-40 rounded-sm" />
                                            <div className="h-1.5 bg-gray-400 w-4/5 opacity-30 rounded-sm" />
                                            <div className="h-1.5 bg-gray-400 w-full opacity-40 rounded-sm" />
                                            <div className="h-1.5 bg-gray-400 w-3/5 opacity-30 rounded-sm" />
                                            <div className="h-1.5 bg-gray-400 w-full opacity-40 rounded-sm" />
                                            <div className="h-1.5 bg-gray-400 w-4/5 opacity-30 rounded-sm" />
                                        </div>

                                        {/* Pines de estacionamientos mejorados */}
                                        {filteredParkings.map((parking, index) => (
                                            <div
                                                key={parking.id}
                                                className={`absolute cursor-pointer transition-all duration-300 hover:scale-110 ${index === 0 ? 'top-20 left-16' :
                                                        index === 1 ? 'top-32 right-20' :
                                                            'top-44 left-24'
                                                    }`}
                                                onClick={() => setSelectedParking(parking)}
                                            >
                                                <div className={`
                                                    w-10 h-10 rounded-full border-4 border-white shadow-xl flex items-center justify-center transition-all duration-300
                                                    ${parking.status === 'available' ? 'bg-green-500 hover:bg-green-600' :
                                                        parking.status === 'few-spots' ? 'bg-orange-500 hover:bg-orange-600' :
                                                            parking.status === 'full' ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-500 hover:bg-gray-600'}
                                                    ${selectedParking?.id === parking.id ? 'ring-4 ring-blue-300 scale-125' : ''}
                                                `}>
                                                    <Car className="w-5 h-5 text-white" />
                                                </div>
                                                {selectedParking?.id === parking.id && (
                                                    <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                                                        {parking.name}
                                                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-600 rotate-45"></div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Etiquetas de ubicación mejoradas */}
                                    <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 shadow-md border border-gray-200">
                                        VILLA ITATÍ
                                    </div>
                                    <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 shadow-md border border-gray-200">
                                        LESTANI
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Lista de Resultados */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">Resultados cercanos</h3>
                            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                {filteredParkings.length} encontrados
                            </span>
                        </div>

                        {selectedParking && (
                            <Card className="border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-xl">
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-blue-900 text-xl font-bold mb-1">
                                                {selectedParking.name}
                                            </CardTitle>
                                            <p className="text-blue-700 font-medium">{selectedParking.address}</p>
                                        </div>
                                        <Badge
                                            variant={selectedParking.open ? "default" : "secondary"}
                                            className={`${selectedParking.open ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500'}`}
                                        >
                                            {selectedParking.open ? "Abierto" : "Cerrado"}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between bg-white/60 rounded-lg p-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`${getStatusDot(selectedParking.status)} scale-125`} />
                                            <span className="font-semibold text-gray-800">
                                                {selectedParking.available} libres
                                            </span>
                                        </div>
                                        <span className="text-lg font-bold text-gray-900">
                                            {selectedParking.price}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                                            <Navigation className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium text-gray-700">{selectedParking.distance}</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                                            <Building className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium text-gray-700">{selectedParking.type}</span>
                                        </div>
                                    </div>

                                    <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg shadow-lg">
                                        <Navigation className="w-5 h-5 mr-2" />
                                        Navegar
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {filteredParkings.map((parking) => (
                            <Card
                                key={parking.id}
                                className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-2 ${selectedParking?.id === parking.id
                                        ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.02]'
                                        : 'border-gray-200 hover:border-blue-300 bg-white'
                                    }`}
                                onClick={() => setSelectedParking(parking)}
                            >
                                <CardContent className="p-5">
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-lg">{parking.name}</h4>
                                                <p className="text-gray-600 font-medium">{parking.address}</p>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="border-gray-300 text-gray-700"
                                            >
                                                {parking.type}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                                                <Navigation className="w-4 h-4 text-blue-600" />
                                                <span className="font-medium text-gray-700">{parking.distance}</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                                                <Clock className="w-4 h-4 text-blue-600" />
                                                <span className="font-medium text-gray-700">{parking.price}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`${getStatusDot(parking.status)} scale-110`} />
                                                <span className="font-semibold text-gray-800">
                                                    {parking.status === 'available' ? `${parking.available} libres` :
                                                        parking.status === 'few-spots' ? `${parking.available} libres` :
                                                            'Lleno'}
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            size="lg"
                                            className={`w-full h-10 font-semibold ${parking.status === 'full'
                                                    ? 'bg-gray-400 hover:bg-gray-500 text-white'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                                                }`}
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
