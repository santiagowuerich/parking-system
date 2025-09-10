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
    Activity,
    Building2,
    MapPin,
    Loader2,
    AlertCircle
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRole } from "@/lib/use-role";
import { DashboardLayout } from "@/components/dashboard-layout";

interface EstacionamientoDetalle {
    est_id: number;
    est_nombre: string;
    est_prov: string;
    est_locali: string;
    est_direc: string;
    est_capacidad: number;
    est_latitud?: number;
    est_longitud?: number;
    est_telefono?: string;
    est_email?: string;
    est_descripcion?: string;
    plazas_totales_reales: number;
    plazas_disponibles_reales: number;
    plazas_ocupadas: number;
}

function DashboardContent() {
    const { user, estId, parkedVehicles, parkingCapacity } = useAuth();
    const { role, loading: roleLoading } = useRole();
    const [stats, setStats] = useState({
        totalVehicles: 0,
        availableSpaces: 0,
        totalSpaces: 0,
        todayRevenue: 0
    });
    const [estacionamientoActual, setEstacionamientoActual] = useState<EstacionamientoDetalle | null>(null);
    const [loadingEstacionamiento, setLoadingEstacionamiento] = useState(false);

    // Loading state while determining role
    if (roleLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Cargando dashboard...</h3>
                            <p className="text-sm text-muted-foreground">
                                Determinando tu rol en el sistema
                            </p>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // Función para cargar detalles del estacionamiento actual
    const cargarDetallesEstacionamiento = async () => {
        if (!estId) {
            setEstacionamientoActual(null);
            return;
        }

        try {
            setLoadingEstacionamiento(true);
            console.log(`🔍 Cargando detalles del estacionamiento ${estId}`);

            const response = await fetch(`/api/auth/list-parkings`);

            if (!response.ok) {
                throw new Error('Error al cargar detalles del estacionamiento');
            }

            const data = await response.json();

            if (data.estacionamientos && data.estacionamientos.length > 0) {
                // Buscar el estacionamiento actual por est_id
                const estacionamiento = data.estacionamientos.find(
                    (est: EstacionamientoDetalle) => est.est_id === estId
                );

                if (estacionamiento) {
                    setEstacionamientoActual(estacionamiento);
                    console.log(`✅ Detalles cargados para estacionamiento: ${estacionamiento.est_nombre}`);
                } else {
                    console.warn(`⚠️ No se encontró el estacionamiento con ID ${estId}`);
                    setEstacionamientoActual(null);
                }
            } else {
                console.warn('⚠️ No se encontraron estacionamientos');
                setEstacionamientoActual(null);
            }
        } catch (error) {
            console.error('❌ Error cargando detalles del estacionamiento:', error);
            setEstacionamientoActual(null);
        } finally {
            setLoadingEstacionamiento(false);
        }
    };

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

    // Cargar detalles del estacionamiento cuando estId cambie
    useEffect(() => {
        cargarDetallesEstacionamiento();
    }, [estId]);

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
            href: "/dashboard/configuracion-zona",
            color: "bg-indigo-500"
        },
        {
            title: "Ver Plazas",
            description: "Visualizar estado de plazas",
            icon: Activity,
            href: "/dashboard/visualizacion-plazas",
            color: "bg-cyan-500"
        },
        {
            title: "Configuración Avanzada",
            description: "Gestionar plantillas de plazas",
            icon: Settings,
            href: "/dashboard/plazas/configuracion-avanzada",
            color: "bg-pink-500"
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

                        {/* Información compacta del estacionamiento */}
                        <div
                            className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors duration-200"
                            onClick={() => window.location.href = '/dashboard/parking'}
                        >
                            <div className="flex items-center gap-3">
                                <Building2 className="h-5 w-5 text-blue-600" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-blue-900">
                                            {estacionamientoActual?.est_nombre || 'Cargando estacionamiento...'}
                                        </span>
                                        {loadingEstacionamiento && (
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        )}
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
                                                    🟢 {estacionamientoActual.plazas_disponibles_reales}
                                                </span>
                                                <span className="text-red-600 font-medium">
                                                    🔴 {estacionamientoActual.plazas_ocupadas}
                                                </span>
                                                <span className="text-blue-600 font-medium">
                                                    📊 {estacionamientoActual.plazas_totales_reales}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {!estacionamientoActual && !loadingEstacionamiento && (
                                        <div className="text-sm text-blue-700">
                                            {estId ? 'No se pudo cargar la información' : 'No hay estacionamiento seleccionado'}
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
            </div>
        </DashboardLayout>
    );
}

// Componente para dashboard de Owner (Dueño)
function OwnerDashboard() {
    const { user, estId, parkedVehicles, parkingCapacity } = useAuth();
    const [stats, setStats] = useState({
        totalVehicles: 0,
        availableSpaces: 0,
        totalSpaces: 0,
        todayRevenue: 0
    });
    const [estacionamientoActual, setEstacionamientoActual] = useState<EstacionamientoDetalle | null>(null);
    const [loadingEstacionamiento, setLoadingEstacionamiento] = useState(false);

    // Lógica del dashboard de owner (igual que el dashboard original)
    const cargarDetallesEstacionamiento = async () => {
        if (!estId) {
            setEstacionamientoActual(null);
            return;
        }

        try {
            setLoadingEstacionamiento(true);
            console.log(`🔍 Cargando detalles del estacionamiento ${estId}`);

            const response = await fetch(`/api/auth/list-parkings`);

            if (!response.ok) {
                throw new Error('Error al cargar detalles del estacionamiento');
            }

            const data = await response.json();

            if (data.estacionamientos && data.estacionamientos.length > 0) {
                const estacionamiento = data.estacionamientos.find(
                    (est: EstacionamientoDetalle) => est.est_id === estId
                );

                if (estacionamiento) {
                    setEstacionamientoActual(estacionamiento);
                    console.log(`✅ Detalles cargados para estacionamiento: ${estacionamiento.est_nombre}`);
                } else {
                    console.warn(`⚠️ No se encontró el estacionamiento con ID ${estId}`);
                    setEstacionamientoActual(null);
                }
            } else {
                console.warn('⚠️ No se encontraron estacionamientos');
                setEstacionamientoActual(null);
            }
        } catch (error) {
            console.error('❌ Error cargando detalles del estacionamiento:', error);
            setEstacionamientoActual(null);
        } finally {
            setLoadingEstacionamiento(false);
        }
    };

    useEffect(() => {
        if (parkedVehicles && parkingCapacity) {
            const totalSpaces = (parkingCapacity.Auto || 0) + (parkingCapacity.Moto || 0) + (parkingCapacity.Camioneta || 0);
            const occupiedSpaces = parkedVehicles.length;
            const availableSpaces = totalSpaces - occupiedSpaces;

            setStats({
                totalVehicles: parkedVehicles.length,
                availableSpaces: Math.max(0, availableSpaces),
                totalSpaces,
                todayRevenue: 0
            });
        }
    }, [parkedVehicles, parkingCapacity]);

    useEffect(() => {
        cargarDetallesEstacionamiento();
    }, [estId]);

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
            href: "/dashboard/configuracion-zona",
            color: "bg-indigo-500"
        },
        {
            title: "Ver Plazas",
            description: "Visualizar estado de plazas",
            icon: Activity,
            href: "/dashboard/visualizacion-plazas",
            color: "bg-cyan-500"
        },
        {
            title: "Configuración Avanzada",
            description: "Gestionar plantillas de plazas",
            icon: Settings,
            href: "/dashboard/plazas/configuracion-avanzada",
            color: "bg-pink-500"
        }
    ];

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard de Dueño</h1>
                        <p className="text-gray-600 mt-1">
                            Bienvenido, {user?.email?.split('@')[0]} (Dueño)
                        </p>

                        {/* Información compacta del estacionamiento */}
                        <div
                            className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors duration-200"
                            onClick={() => window.location.href = '/dashboard/parking'}
                        >
                            <div className="flex items-center gap-3">
                                <Building2 className="h-5 w-5 text-blue-600" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-blue-900">
                                            {estacionamientoActual?.est_nombre || 'Cargando estacionamiento...'}
                                        </span>
                                        {loadingEstacionamiento && (
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        )}
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
                                                    🟢 {estacionamientoActual.plazas_disponibles_reales}
                                                </span>
                                                <span className="text-red-600 font-medium">
                                                    🔴 {estacionamientoActual.plazas_ocupadas}
                                                </span>
                                                <span className="text-blue-600 font-medium">
                                                    📊 {estacionamientoActual.plazas_totales_reales}
                                                </span>
                                            </div>
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
                            <CardTitle className="text-sm font-medium">Empleados</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">12</div>
                            <p className="text-xs text-muted-foreground">
                                empleados activos
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions para Owner */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Acciones Rápidas (Dueño)
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
            </div>
        </DashboardLayout>
    );
}

// Componente para dashboard de Playero
function PlayeroDashboard() {
    const { user } = useAuth();

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard de Playero</h1>
                        <p className="text-gray-600 mt-1">
                            Bienvenido, {user?.email?.split('@')[0]} (Playero)
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Turnos Hoy</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">2</div>
                            <p className="text-xs text-muted-foreground">
                                turnos asignados
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Vehículos Atendidos</CardTitle>
                            <Car className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">24</div>
                            <p className="text-xs text-muted-foreground">
                                hoy
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Estado</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">Activo</div>
                            <p className="text-xs text-muted-foreground">
                                turno actual
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Panel de Control
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-gray-50"
                                onClick={() => window.location.href = '/dashboard/operador-simple'}
                            >
                                <div className="p-2 rounded-lg bg-blue-500">
                                    <ParkingCircle className="h-5 w-5 text-white" />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-sm">Panel de Operador</div>
                                    <div className="text-xs text-muted-foreground">Gestionar estacionamientos</div>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-gray-50"
                                onClick={() => window.location.href = '/dashboard/visualizacion-plazas'}
                            >
                                <div className="p-2 rounded-lg bg-green-500">
                                    <Activity className="h-5 w-5 text-white" />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-sm">Visualizar Plazas</div>
                                    <div className="text-xs text-muted-foreground">Ver estado de plazas</div>
                                </div>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

// Componente para dashboard de Conductor
function ConductorDashboard() {
    const { user } = useAuth();

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard de Conductor</h1>
                        <p className="text-gray-600 mt-1">
                            Bienvenido, {user?.email?.split('@')[0]} (Conductor)
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Mis Servicios
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-8 text-muted-foreground">
                            <ParkingCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Funcionalidades para conductores próximamente</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

// Dashboard principal que decide qué mostrar según el rol
export default function DashboardPage() {
    const { role, loading: roleLoading } = useRole();

    // Loading state while determining role
    if (roleLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Cargando dashboard...</h3>
                            <p className="text-sm text-muted-foreground">
                                Determinando tu rol en el sistema
                            </p>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // Renderizar dashboard según rol
    switch (role) {
        case 'owner':
            return <OwnerDashboard />;
        case 'playero':
            return <PlayeroDashboard />;
        case 'conductor':
            return <ConductorDashboard />;
        default:
            return (
                <DashboardLayout>
                    <div className="flex items-center justify-center min-h-screen">
                        <div className="text-center space-y-4 max-w-md mx-auto p-6">
                            <div className="rounded-full bg-yellow-100 p-3 w-fit mx-auto">
                                <AlertCircle className="h-12 w-12 text-yellow-600" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Rol No Definido
                                </h2>
                                <p className="text-gray-600">
                                    Tu cuenta no tiene un rol asignado en el sistema.
                                    Por favor, contacta al administrador.
                                </p>
                            </div>
                        </div>
                    </div>
                </DashboardLayout>
            );
    }
}
