"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    MapPin,
    Search,
    Navigation2,
    Settings,
    Filter,
    Map,
    Layers
} from "lucide-react";

export default function MapaEstacionamientos() {
    const [searchText, setSearchText] = useState("");
    const [soloDisponibles, setSoloDisponibles] = useState(true);
    const [tipoTechado, setTipoTechado] = useState(false);

    const estacionamientos = [
        {
            id: 1,
            nombre: "Parking Centro",
            direccion: "Av. Mitre 550",
            distancia: "50 m",
            precio: "800",
            tipo: "Techado",
            disponibles: 12,
            estado: "disponible" // disponible, pocos, lleno
        },
        {
            id: 2,
            nombre: "Mitre & Güemes",
            direccion: "Esq. Mitre y Güemes",
            distancia: "120 m",
            precio: "700",
            tipo: "Descubierto",
            disponibles: 3,
            estado: "pocos"
        },
        {
            id: 3,
            nombre: "Plaza 25 de Mayo",
            direccion: "Plaza Principal",
            distancia: "250 m",
            precio: "900",
            tipo: "Techado",
            disponibles: 0,
            estado: "lleno"
        }
    ];

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case "disponible": return "text-green-600";
            case "pocos": return "text-orange-600";
            case "lleno": return "text-red-600";
            default: return "text-gray-600";
        }
    };

    const getEstadoIcon = (estado: string) => {
        const baseClasses = "w-3 h-3 rounded-full";
        switch (estado) {
            case "disponible": return `${baseClasses} bg-green-500`;
            case "pocos": return `${baseClasses} bg-orange-500`;
            case "lleno": return `${baseClasses} bg-red-500`;
            default: return `${baseClasses} bg-gray-500`;
        }
    };

    const getDisponiblesText = (estado: string, disponibles: number) => {
        if (estado === "lleno") return "Lleno";
        return `${disponibles} libres`;
    };

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
                            <Button variant="outline" size="sm">
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
                    <div className="w-80 bg-white border-r flex-shrink-0">
                        <div className="p-6">
                            <Card className="border-2 border-blue-200">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-lg">Parking Centro - Av. Mitre 550</h3>
                                        <Badge className="bg-green-100 text-green-800 px-2 py-1">
                                            Abierto
                                        </Badge>
                                    </div>

                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-600">50 m</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Settings className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-600">Techado</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                <span className="text-gray-600">12 libres</span>
                                            </div>
                                            <span className="font-bold text-blue-600">$800 / h</span>
                                        </div>
                                    </div>

                                    <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700">
                                        <Navigation2 className="w-4 h-4 mr-2" />
                                        Navegar
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Panel Centro - Mapa */}
                    <div className="flex-1 bg-gray-100 flex items-center justify-center relative">
                        {/* Simulación del Mapa */}
                        <div className="bg-gray-200 w-full h-full flex items-center justify-center">
                            <Card className="p-8 bg-white">
                                <div className="flex items-center gap-4 mb-4">
                                    <Map className="h-8 w-8 text-blue-600" />
                                    <div className="text-center">
                                        <h3 className="font-semibold text-lg">Mapa Interactivo</h3>
                                        <p className="text-gray-600 text-sm">
                                            Aquí se mostraría el mapa con marcadores de estacionamientos
                                        </p>
                                    </div>
                                    <Layers className="h-6 w-6 text-gray-400" />
                                </div>

                                {/* Mini simulación de calles */}
                                <div className="grid grid-cols-4 gap-2">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="h-8 bg-gray-300 rounded flex items-center justify-center text-xs text-gray-600">
                                            {i < 4 && "Av"}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-center mt-4 text-gray-500">
                                    <Button variant="outline" size="sm">
                                        <MapPin className="w-4 h-4 mr-2" />
                                        Permitir ubicación
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    </div>

                    {/* Panel Derecho - Lista de Estacionamientos */}
                    <div className="w-80 bg-white border-l flex-shrink-0">
                        <div className="p-6">
                            <h3 className="font-semibold text-lg mb-4">Resultados cercanos</h3>

                            <div className="space-y-4">
                                {estacionamientos.map((estacionamiento) => (
                                    <Card key={estacionamiento.id} className="cursor-pointer hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-medium">{estacionamiento.nombre}</h4>
                                                <span className="text-xs text-gray-500">{estacionamiento.distancia}</span>
                                            </div>

                                            <p className="text-sm text-gray-600 mb-2">{estacionamiento.direccion}</p>

                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm text-gray-600">{estacionamiento.tipo}</span>
                                                <span className="font-medium text-blue-600">${estacionamiento.precio}/h</span>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={getEstadoIcon(estacionamiento.estado)}></div>
                                                    <span className={`text-sm font-medium ${getEstadoColor(estacionamiento.estado)}`}>
                                                        {getDisponiblesText(estacionamiento.estado, estacionamiento.disponibles)}
                                                    </span>
                                                </div>

                                                <Button
                                                    size="sm"
                                                    variant={estacionamiento.estado === "lleno" ? "outline" : "default"}
                                                    className={
                                                        estacionamiento.estado === "lleno"
                                                            ? "text-gray-500"
                                                            : "bg-blue-600 text-white hover:bg-blue-700"
                                                    }
                                                >
                                                    {estacionamiento.estado === "lleno" ? "Ver" : "Ir"}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}