"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Calendar,
    Clock,
    MapPin,
    Car,
    Search,
    Filter,
    Plus
} from "lucide-react";

export default function ReservasPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");

    const reservations = [
        {
            id: 1,
            parking: "Parking Centro",
            address: "Av. Mitre 550",
            patente: "ABC123",
            fechaInicio: "2024-01-15",
            horaInicio: "14:00",
            duracion: "2 horas",
            monto: "$1,600",
            estado: "confirmada",
            plaza: "A-05"
        },
        {
            id: 2,
            parking: "Mitre & Güemes",
            address: "Mitre esq. Güemes",
            patente: "XYZ789",
            fechaInicio: "2024-01-12",
            horaInicio: "09:30",
            duracion: "4 horas",
            monto: "$2,800",
            estado: "completada",
            plaza: "B-12"
        },
        {
            id: 3,
            parking: "Plaza 25 de Mayo",
            address: "Plaza 25 de Mayo",
            patente: "DEF456",
            fechaInicio: "2024-01-10",
            horaInicio: "16:00",
            duracion: "1 hora",
            monto: "$900",
            estado: "cancelada",
            plaza: "C-08"
        }
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmada": return "text-green-600 bg-green-50";
            case "completada": return "text-blue-600 bg-blue-50";
            case "cancelada": return "text-red-600 bg-red-50";
            default: return "text-gray-600 bg-gray-50";
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "confirmada": return "Confirmada";
            case "completada": return "Completada";
            case "cancelada": return "Cancelada";
            default: return status;
        }
    };

    const filteredReservations = reservations.filter(reservation => {
        const matchesSearch = reservation.parking.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reservation.patente.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === "all" || reservation.estado === filterStatus;

        return matchesSearch && matchesFilter;
    });

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-gray-900">Mis Reservas</h1>
                        <p className="text-gray-600">
                            Gestioná tus reservas activas e historial de estacionamientos
                        </p>
                    </div>

                    {/* Resumen Rápido */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-4 gap-4 text-center">
                                <div>
                                    <div className="text-2xl font-bold text-green-600">{reservations.filter(r => r.estado === 'confirmada').length}</div>
                                    <div className="text-xs text-gray-600">Confirmadas</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-blue-600">{reservations.filter(r => r.estado === 'completada').length}</div>
                                    <div className="text-xs text-gray-600">Completadas</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-red-600">{reservations.filter(r => r.estado === 'cancelada').length}</div>
                                    <div className="text-xs text-gray-600">Canceladas</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{reservations.length}</div>
                                    <div className="text-xs text-gray-600">Total</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros y Nueva Reserva */}
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex flex-col lg:flex-row gap-4 flex-1">
                        {/* Buscador */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por estacionamiento o patente"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Filtro por Estado */}
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-full lg:w-48">
                                <SelectValue placeholder="Filtrar por estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                <SelectItem value="confirmada">Confirmadas</SelectItem>
                                <SelectItem value="completada">Completadas</SelectItem>
                                <SelectItem value="cancelada">Canceladas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="lg:w-auto">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Reserva
                    </Button>
                </div>

                {/* Lista de Reservas */}
                <div className="space-y-4">
                    {filteredReservations.length === 0 ? (
                        <Card className="text-center py-12">
                            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay reservas</h3>
                            <p className="text-gray-600 mb-4">
                                {searchTerm || filterStatus !== "all"
                                    ? "No se encontraron reservas con los filtros seleccionados"
                                    : "No has realizado ninguna reserva aún"
                                }
                            </p>
                            {!searchTerm && filterStatus === "all" && (
                                <Button>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Hacer mi primera reserva
                                </Button>
                            )}
                        </Card>
                    ) : (
                        filteredReservations.map((reservation) => (
                            <Card key={reservation.id}>
                                <CardContent className="p-6">
                                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                                        {/* Información Principal */}
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-lg">{reservation.parking}</h3>
                                                    <p className="text-gray-600">{reservation.address}</p>
                                                </div>
                                                <Badge className={getStatusColor(reservation.estado)}>
                                                    {getStatusText(reservation.estado)}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-gray-500" />
                                                    <span>{reservation.fechaInicio}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-gray-500" />
                                                    <span>{reservation.horaInicio}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Car className="w-4 h-4 text-gray-500" />
                                                    <span>{reservation.patente}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-gray-500" />
                                                    <span>Plaza {reservation.plaza}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Información Secundaria */}
                                        <div className="flex flex-col lg:flex-row items-end lg:items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-sm text-gray-600">Duración</div>
                                                <div className="font-semibold">{reservation.duracion}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-gray-600">Monto</div>
                                                <div className="font-bold text-lg">{reservation.monto}</div>
                                            </div>

                                            <div className="flex gap-2">
                                                {reservation.estado === 'confirmada' && (
                                                    <>
                                                        <Button size="sm" variant="outline">
                                                            Cancelar
                                                        </Button>
                                                        <Button size="sm">
                                                            Ir al Estacionamiento
                                                        </Button>
                                                    </>
                                                )}
                                                {reservation.estado === 'completada' && (
                                                    <Button size="sm" variant="outline">
                                                        Ver Detalles
                                                    </Button>
                                                )}
                                                {reservation.estado === 'cancelada' && (
                                                    <Button size="sm" variant="outline">
                                                        Reservar Nuevamente
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
