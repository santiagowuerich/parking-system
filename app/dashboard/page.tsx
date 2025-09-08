"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Car,
    DollarSign,
    Clock,
    TrendingUp,
    ParkingCircle,
    Users,
    Settings,
    Activity
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function DashboardPage() {
    const { user, estId, parkedVehicles, parkingCapacity } = useAuth();
    const [stats, setStats] = useState({
        totalVehicles: 0,
        availableSpaces: 0,
        totalSpaces: 0,
        todayRevenue: 0
    });

    useEffect(() => {
        if (parkedVehicles && parkingCapacity) {
            const totalSpaces = (parkingCapacity.Auto || 0) + (parkingCapacity.Moto || 0) + (parkingCapacity.Camioneta || 0);
            const occupiedSpaces = parkedVehicles.length;
            const availableSpaces = totalSpaces - occupiedSpaces;

            setStats({
                totalVehicles: parkedVehicles.length,
                availableSpaces: Math.max(0, availableSpaces),
                totalSpaces,
                todayRevenue: 0 // TODO: Calcular ingresos del día
            });
        }
    }, [parkedVehicles, parkingCapacity]);

    const quickActions = [
        {
            title: "Registrar Entrada",
            description: "Registrar un nuevo vehículo",
            icon: Car,
            href: "/",
            color: "bg-blue-500"
        },
        {
            title: "Gestionar Tarifas",
            description: "Configurar precios",
            icon: DollarSign,
            href: "/gestion-tarifas",
            color: "bg-green-500"
        },
        {
            title: "Plantillas",
            description: "Administrar plantillas",
            icon: Settings,
            href: "/gestion-plantillas",
            color: "bg-purple-500"
        },
        {
            title: "Google Maps",
            description: "Configurar ubicación",
            icon: ParkingCircle,
            href: "/google-maps-setup",
            color: "bg-orange-500"
        },
        {
            title: "Configurar Zona",
            description: "Crear zonas y plazas",
            icon: Settings,
            href: "/configuracion-zona",
            color: "bg-indigo-500"
        },
        {
            title: "Ver Plazas",
            description: "Visualizar estado de plazas",
            icon: Activity,
            href: "/visualizacion-plazas",
            color: "bg-cyan-500"
        }
    ];

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-gray-600 mt-1">
                            Bienvenido de vuelta, {user?.email?.split('@')[0]}
                        </p>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                        Estacionamiento {estId || 'No seleccionado'}
                    </Badge>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Vehículos Estacionados</CardTitle>
                            <Car className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalVehicles}</div>
                            <p className="text-xs text-muted-foreground">
                                de {stats.totalSpaces} espacios totales
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Espacios Disponibles</CardTitle>
                            <ParkingCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.availableSpaces}</div>
                            <p className="text-xs text-muted-foreground">
                                espacios libres
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${stats.todayRevenue}</div>
                            <p className="text-xs text-muted-foreground">
                                +20.1% del mes pasado
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasa de Ocupación</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats.totalSpaces > 0
                                    ? Math.round(((stats.totalSpaces - stats.availableSpaces) / stats.totalSpaces) * 100)
                                    : 0
                                }%
                            </div>
                            <p className="text-xs text-muted-foreground">
                                ocupación actual
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Acciones Rápidas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {quickActions.map((action) => {
                                const Icon = action.icon;
                                return (
                                    <Button
                                        key={action.href}
                                        variant="outline"
                                        className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-gray-50"
                                        onClick={() => window.location.href = action.href}
                                    >
                                        <div className={`p-2 rounded-lg ${action.color}`}>
                                            <Icon className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium text-sm">{action.title}</div>
                                            <div className="text-xs text-muted-foreground">{action.description}</div>
                                        </div>
                                    </Button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Actividad Reciente
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {parkedVehicles && parkedVehicles.length > 0 ? (
                                parkedVehicles.slice(0, 5).map((vehicle, index) => (
                                    <div key={index} className="flex items-center justify-between py-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                            <div>
                                                <p className="text-sm font-medium">{vehicle.license_plate}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {vehicle.type} - Plaza {vehicle.plaza_number || 'Sin asignar'}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="secondary">Estacionado</Badge>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <ParkingCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No hay vehículos estacionados actualmente</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
