"use client";

import { useEffect, useRef, useState } from "react";
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
    Activity,
    Building2,
    MapPin,
    Loader2
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useRouter } from "next/navigation";
// DebugEstacionamiento removido para solucionar loop infinito

interface EstacionamientoDetalle {
    est_id: number;
    est_nombre: string;
    est_prov?: string;
    est_locali?: string;
    est_direc?: string;
    est_capacidad: number;
    plazas_total: number;
    plazas_libres: number;
    plazas_ocupadas: number;
    ingreso_hoy?: number;
    vehiculos_activos?: number;
}

export default function DashboardPage() {
    const { user, estId, parkedVehicles, parkingCapacity, parkings, fetchUserData } = useAuth();
    const { isOwner, isEmployee, loading: roleLoading } = useUserRole();
    const router = useRouter();
    const [stats, setStats] = useState({
        totalVehicles: 0,
        availableSpaces: 0,
        totalSpaces: 0,
        todayRevenue: 0
    });

    // Obtener el estacionamiento actual desde el estado centralizado
    const estacionamientoActual = parkings.find(p => p.est_id === estId) || null;

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

    // Redirigir empleados al dashboard de operador SOLO cuando el rol esté resuelto
    useEffect(() => {
        if (roleLoading) return;
        if (isEmployee) {
            router.push('/dashboard/operador-simple');
        }
    }, [isEmployee, roleLoading, router]);

    // Ya no necesitamos hacer fetch adicional - usamos el estado centralizado de parkings

    // Cargar datos del usuario cuando el dashboard se monte
    useEffect(() => {
        if (estId && !roleLoading) {
            fetchUserData();
        }
    }, [estId, roleLoading, fetchUserData]);

    // Filtrar acciones según el rol del usuario
    const quickActions = [
        {
            title: "Registrar Entrada",
            description: "Registrar un nuevo vehículo",
            icon: Car,
            href: "/",
            color: "bg-blue-500",
            showForOwners: true,
            showForEmployees: true
        },
        {
            title: "Gestionar Tarifas",
            description: "Configurar precios",
            icon: DollarSign,
            href: "/dashboard/tarifas",
            color: "bg-green-500",
            showForOwners: true,
            showForEmployees: true
        },
        {
            title: "Plantillas",
            description: "Administrar plantillas",
            icon: Settings,
            href: "/dashboard/plantillas",
            color: "bg-purple-500",
            showForOwners: true,
            showForEmployees: false
        },
        {
            title: "Empleados",
            description: "Gestionar empleados",
            icon: Users,
            href: "/dashboard/empleados",
            color: "bg-orange-500",
            showForOwners: true,
            showForEmployees: false
        },
        {
            title: "Pagos",
            description: "Configurar métodos de pago",
            icon: DollarSign,
            href: "/dashboard/configuracion-pagos",
            color: "bg-yellow-500",
            showForOwners: true,
            showForEmployees: false
        },
        {
            title: "Configurar Zona",
            description: "Crear zonas y plazas",
            icon: Settings,
            href: "/dashboard/configuracion-zona",
            color: "bg-indigo-500",
            showForOwners: true,
            showForEmployees: false
        },
        {
            title: "Ver Plazas",
            description: "Visualizar estado de plazas",
            icon: Activity,
            href: "/dashboard/visualizacion-plazas",
            color: "bg-cyan-500",
            showForOwners: true,
            showForEmployees: true
        },
        {
            title: "Configuración Avanzada",
            description: "Gestionar plantillas de plazas",
            icon: Settings,
            href: "/dashboard/plazas/configuracion-avanzada",
            color: "bg-pink-500",
            showForOwners: true,
            showForEmployees: false
        }
    ].filter(action => {
        // Si aún no sabemos el rol, mostrar todas las acciones
        if (isOwner === null) return true;

        // Mostrar según el rol del usuario usando las propiedades showForOwners y showForEmployees
        return isOwner ? action.showForOwners : action.showForEmployees;
    });

    // Mostrar loading mientras se determina el rol del usuario
    if (roleLoading || isOwner === null) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">Cargando dashboard...</p>
                        <p className="text-sm text-gray-500 mt-1">Determinando permisos del usuario</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

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

                        {/* Información compacta del estacionamiento */}
                        <div
                            className={`mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg transition-colors duration-200 ${isOwner ? 'cursor-default' : 'cursor-pointer hover:bg-blue-100'
                                }`}
                            onClick={() => {
                                if (!isOwner) {
                                    window.location.href = '/dashboard/parking';
                                }
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <Building2 className="h-5 w-5 text-blue-600" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-blue-900">
                                            {estacionamientoActual?.est_nombre || 'Cargando estacionamiento...'}
                                        </span>
                                        {estId && (
                                            <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                                                ID: {estId}
                                            </Badge>
                                        )}
                                    </div>

                                    {estacionamientoActual && (
                                        <div className="flex items-center gap-4 mt-1 text-sm text-blue-700">
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                <span className="truncate max-w-48">
                                                    {estacionamientoActual.est_locali}, {estacionamientoActual.est_prov}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-600 font-medium">
                                                    🟢 {estacionamientoActual.plazas_libres || 0}
                                                </span>
                                                <span className="text-red-600 font-medium">
                                                    🔴 {estacionamientoActual.plazas_ocupadas || 0}
                                                </span>
                                                <span className="text-blue-600 font-medium">
                                                    📊 {estacionamientoActual.plazas_total || 0}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {!estacionamientoActual && (
                                        <div className="text-sm text-blue-700">
                                            {estId ? 'No se pudo cargar la información del estacionamiento' : 'No hay estacionamiento asignado'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
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

                {/* Componente de Debug - Temporalmente deshabilitado para evitar loops */}
                {/* <div className="mt-6">
                    <DebugEstacionamiento />
                </div> */}
            </div>
        </DashboardLayout>
    );
}
