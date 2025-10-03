"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Calendar,
    CreditCard,
    CheckCircle,
    Clock,
    MapPin,
    Car,
    TrendingUp
} from "lucide-react";

export default function AbonosPage() {
    const [selectedView, setSelectedView] = useState("activos");

    const abonos = [
        {
            id: 1,
            nombre: "Abono Mensual Premium",
            parking: "Parking Centro",
            precio: "$8,000",
            inicio: "2024-01-01",
            fin: "2024-01-31",
            diasRestantes: 15,
            totalDias: 31,
            tipo: "Mensual",
            estado: "activo",
            beneficio: "Acceso ilimitado + prioridad"
        },
        {
            id: 2,
            nombre: "Abono Semanal",
            parking: "Mitre & Güemes",
            precio: "$2,500",
            inicio: "2024-01-15",
            fin: "2024-01-21",
            diasRestantes: 5,
            totalDias: 7,
            tipo: "Semanal",
            estado: "activo",
            beneficio: "Horario extendido"
        },
        {
            id: 3,
            nombre: "Abono Mensual Standard",
            parking: "Plaza 25 de Mayo",
            precio: "$6,000",
            inicio: "2023-12-01",
            fin: "2023-12-31",
            diasRestantes: 0,
            totalDias: 31,
            tipo: "Mensual",
            estado: "vencido",
            beneficio: "Acceso estándar"
        }
    ];

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case "activo": return "text-green-600 bg-green-50";
            case "vencido": return "text-red-600 bg-red-50";
            case "suspendido": return "text-orange-600 bg-orange-50";
            default: return "text-gray-600 bg-gray-50";
        }
    };

    const getEstadoText = (estado: string) => {
        switch (estado) {
            case "activo": return "Activo";
            case "vencido": return "Vencido";
            case "suspendido": return "Suspendido";
            default: return estado;
        }
    };

    const activosAbonos = abonos.filter(abono => abono.estado === "activo");
    const totalAhorro = activosAbonos.reduce((acc, abono) => {
        const precioDiario = activosAbonos.length > 0 ?
            parseInt(abono.precio.replace(/[$,]/g, "")) / 30 : 0;
        return acc + (precioDiario * abono.diasRestantes);
    }, 0);

    const averageSavings = 35; // Porcentaje promedio de ahorro

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header y Resumen */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-2">
                        <h1 className="text-3xl font-bold text-gray-900">Mis Abonos</h1>
                        <p className="text-gray-600">
                            Gestioná tus suscripciones y benefíciate de tarifas especiales
                        </p>
                    </div>

                    {/* Estadísticas Rápidas */}
                    <Card className="bg-gradient-to-br from-green-50 to-blue-50">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-green-800">Ahorro este mes</h3>
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="text-3xl font-bold text-green-700">
                                ${totalAhorro.toLocaleString()}
                            </div>
                            <div className="text-sm text-green-600 mt-2">
                                Promedio de {averageSavings}% vs. tarifa por hora
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Navegación y Controles */}
                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <Select value={selectedView} onValueChange={setSelectedView}>
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="activos">Abonos Activos</SelectItem>
                                <SelectItem value="vencidos">Vencidos</SelectItem>
                                <SelectItem value="todos">Todos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="bg-green-600 hover:bg-green-700">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Contratar Nuevo Abono
                    </Button>
                </div>

                {/* Lista de Abonos */}
                <div className="space-y-4">
                    {(selectedView === "todos" ? abonos : abonos.filter(a => a.estado === selectedView)).length === 0 ? (
                        <Card className="text-center py-12">
                            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No tienes abonos</h3>
                            <p className="text-gray-600 mb-4">
                                Contratá un abono para obtener tarifas especiales y acceso prioritario
                            </p>
                            <Button className="bg-green-600 hover:bg-green-700">
                                <CreditCard className="w-4 h-4 mr-2" />
                                Ver Abonos Disponibles
                            </Button>
                        </Card>
                    ) : (
                        (selectedView === "todos" ? abonos : abonos.filter(a => a.estado === selectedView)).map((abono) => (
                            <Card key={abono.id} className={
                                abono.estado === "activo" ? "border-green-200 bg-green-50/30" :
                                    abono.estado === "vencido" ? "border-red-200 bg-red-50/30" : ""
                            }>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Información Principal */}
                                        <div className="lg:col-span-2 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-semibold text-lg">{abono.nombre}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <MapPin className="w-4 h-4 text-gray-500" />
                                                        <span className="text-gray-600">{abono.parking}</span>
                                                    </div>
                                                </div>
                                                <Badge className={getEstadoColor(abono.estado)}>
                                                    {getEstadoText(abono.estado)}
                                                </Badge>
                                            </div>

                                            {/* Beneficio y Tipo */}
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                                    <span className="text-sm">{abono.beneficio}</span>
                                                </div>
                                                <Badge variant="outline">{abono.tipo}</Badge>
                                            </div>

                                            {/* Fechas */}
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-gray-500" />
                                                    <span>Inicio: {abono.inicio}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-gray-500" />
                                                    <span>Fin: {abono.fin}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Panel de Control y Progreso */}
                                        <div className="space-y-4">
                                            {/* Progreso (solo para activos) */}
                                            {abono.estado === "activo" && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span>Días restantes</span>
                                                        <span>{abono.diasRestantes}/{abono.totalDias}</span>
                                                    </div>
                                                    <Progress
                                                        value={(abono.diasRestantes / abono.totalDias) * 100}
                                                        className="h-2"
                                                    />
                                                </div>
                                            )}

                                            {/* Información de Precio */}
                                            <div className="bg-white rounded-lg p-4 border">
                                                <div className="text-right">
                                                    <div className="text-sm text-gray-600">Precio del abono</div>
                                                    <div className="font-bold text-xl">{abono.precio}</div>
                                                </div>
                                            </div>

                                            {/* Acciones */}
                                            <div className="flex flex-col gap-2">
                                                {abono.estado === "activo" && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            className="bg-blue-600 hover:bg-blue-700"
                                                        >
                                                            Renovar Abono
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                        >
                                                            Ver Detalles
                                                        </Button>
                                                    </>
                                                )}
                                                {abono.estado === "vencido" && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700"
                                                        >
                                                            Renovar Abono
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                        >
                                                            Historial
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Beneficios de los Abonos */}
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                            Beneficios de tener un Abono
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-start gap-3">
                                <CreditCard className="w-5 h-5 text-blue-600 mt-1" />
                                <div>
                                    <h4 className="font-semibold">Tarifas Especiales</h4>
                                    <p className="text-sm text-gray-600">Hasta 40% menos que el precio por hora</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Car className="w-5 h-5 text-green-600 mt-1" />
                                <div>
                                    <h4 className="font-semibold">Acceso Prioritario</h4>
                                    <p className="text-sm text-gray-600">Reserva automática de plazas</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Clock className="w-5 h-5 text-purple-600 mt-1" />
                                <div>
                                    <h4 className="font-semibold">Horarios Extendidos</h4>
                                    <p className="text-sm text-gray-600">Acceso fuera de horario comercial</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
