"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Car, Bike, Truck, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { VehicleType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface PlazasData {
    plazas_por_plantilla: {
        Auto: { total: number; ocupadas: number; disponibles: number };
        Moto: { total: number; ocupadas: number; disponibles: number };
        Camioneta: { total: number; ocupadas: number; disponibles: number };
    };
    total_general: {
        total: number;
        ocupadas: number;
        disponibles: number;
    };
}

export default function DashboardPage() {
    const { user, estId, parkedVehicles, parkingCapacity, refreshCapacity } = useAuth();
    const { isOwner, isEmployee, isDriver, loading: roleLoading } = useUserRole();
    const [open, setOpen] = useState(false);
    const [tempCapacities, setTempCapacities] = useState(parkingCapacity || { Auto: 0, Moto: 0, Camioneta: 0 });
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [plazasData, setPlazasData] = useState<PlazasData | null>(null);
    const [loadingPlazas, setLoadingPlazas] = useState(true);

    // Calcular ingresos
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayIncome = history
        .filter((entry) => new Date(entry.exit_time) >= today)
        .reduce((sum, entry) => sum + entry.fee, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const weekIncome = history
        .filter((entry) => new Date(entry.exit_time) >= weekAgo)
        .reduce((sum, entry) => sum + entry.fee, 0);

    // Calcular ingresos del mes
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    monthAgo.setHours(0, 0, 0, 0);

    const monthIncome = history
        .filter((entry) => new Date(entry.exit_time) >= monthAgo)
        .reduce((sum, entry) => sum + entry.fee, 0);

    // Cargar plazas reales desde la API
    useEffect(() => {
        const loadPlazasData = async () => {
            if (!estId) {
                setLoadingPlazas(false);
                return;
            }

            try {
                const response = await fetch(`/api/plazas?est_id=${estId}`);
                const data = await response.json();

                if (data.plazas && Array.isArray(data.plazas)) {
                    // Organizar plazas por plantilla (tipo de vehículo)
                    const plazasPorPlantilla = {
                        Auto: { total: 0, ocupadas: 0, disponibles: 0 },
                        Moto: { total: 0, ocupadas: 0, disponibles: 0 },
                        Camioneta: { total: 0, ocupadas: 0, disponibles: 0 }
                    };

                    // Mapeo de códigos de plantilla a tipos de vehículo
                    const tipoMap: { [key: string]: VehicleType } = {
                        'AUT': 'Auto',
                        'MOT': 'Moto',
                        'CAM': 'Camioneta'
                    };

                    data.plazas.forEach((plaza: any) => {
                        const codigoTipo = plaza.plantillas?.catv_segmento;
                        const tipoVehiculo = codigoTipo ? tipoMap[codigoTipo] : null;

                        if (tipoVehiculo && plazasPorPlantilla[tipoVehiculo]) {
                            plazasPorPlantilla[tipoVehiculo].total++;

                            // Solo contar 'Ocupada' en los cards individuales (NO abonos)
                            if (plaza.pla_estado === 'Ocupada') {
                                plazasPorPlantilla[tipoVehiculo].ocupadas++;
                            } else if (plaza.pla_estado === 'Libre') {
                                plazasPorPlantilla[tipoVehiculo].disponibles++;
                            }
                        }
                    });

                    const total_general = {
                        total: data.plazas.length,
                        ocupadas: data.plazas.filter((p: any) => p.pla_estado === 'Ocupada' || p.pla_estado === 'Abonado').length,
                        disponibles: data.plazas.filter((p: any) => p.pla_estado === 'Libre').length
                    };

                    setPlazasData({
                        plazas_por_plantilla: plazasPorPlantilla,
                        total_general
                    });
                }
            } catch (error) {
                console.error("Error al cargar plazas:", error);
            } finally {
                setLoadingPlazas(false);
            }
        };

        loadPlazasData();
    }, [estId]);

    // Cargar historial
    useEffect(() => {
        const loadHistory = async () => {
            if (!estId) {
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/pagos?est_id=${estId}`);
                const data = await response.json();

                // El endpoint ya devuelve los datos en el formato correcto
                // con exit_time y fee, e incluye todos los tipos de pago
                // (ocupación, abonos, reservas)
                const pagos = Array.isArray(data.history) ? data.history : (data || []);

                setHistory(pagos);
            } catch (error) {
                console.error("Error al cargar historial:", error);
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };

        loadHistory();
    }, [estId]);

    // Actualizar capacidades temporales cuando cambie parkingCapacity
    useEffect(() => {
        if (parkingCapacity) {
            setTempCapacities(parkingCapacity);
        }
    }, [parkingCapacity]);

    const handleChange = (type: VehicleType, value: number) => {
        setTempCapacities((prev) => ({ ...prev, [type]: value }));
    };

    const handleSave = async () => {
        try {
            if (!user?.id) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Debe iniciar sesión para guardar la capacidad"
                });
                return;
            }

            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No se encontró una sesión válida"
                });
                return;
            }

            if (!estId || estId <= 0) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "ID de estacionamiento no válido"
                });
                return;
            }

            const response = await fetch(`/api/capacity?est_id=${estId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    capacity: tempCapacities,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Error al actualizar la capacidad");
            }

            const targetForSync = {
                Auto: Number(tempCapacities.Auto || 0),
                Moto: Number(tempCapacities.Moto || 0),
                Camioneta: Number(tempCapacities.Camioneta || 0),
            };

            const syncRes = await fetch(`/api/capacity/plazas/sync?est_id=${estId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(targetForSync)
            });

            if (!syncRes.ok) {
                const responseText = await syncRes.text();
                let e: any = {};
                try { e = JSON.parse(responseText) } catch { e = { error: responseText } }
                if (e.occupiedPlazas && e.occupiedPlazas.length > 0) {
                    throw new Error(`${e.error}\n\nPlazas ocupadas: ${e.occupiedPlazas.join(', ')}`);
                }
                throw new Error(e.error || `Error al sincronizar plazas (HTTP ${syncRes.status})`);
            }

            await refreshCapacity();

            toast({ title: "Capacidad actualizada", description: "Capacidad y plazas sincronizadas correctamente (vehículos preservados)." });
            setOpen(false);
        } catch (error) {
            console.error("Error al guardar capacidad:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo guardar la capacidad/sincronizar plazas.",
            });
        }
    };

    const getVehicleIcon = (type: VehicleType) => {
        switch (type) {
            case 'Auto':
                return <Car className="w-5 h-5" />;
            case 'Moto':
                return <Bike className="w-5 h-5" />;
            case 'Camioneta':
                return <Truck className="w-5 h-5" />;
        }
    };

    const renderSpaceInfo = (label: string, type: VehicleType) => {
        const data = plazasData?.plazas_por_plantilla[type];

        if (!data) {
            return (
                <div key={type} className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg dark:from-zinc-900 dark:to-zinc-800 dark:border dark:border-zinc-700">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white rounded-lg dark:bg-zinc-800 text-blue-600 dark:text-blue-400">
                            {getVehicleIcon(type)}
                        </div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">{label}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 dark:text-zinc-400">Cargando...</p>
                    </div>
                </div>
            );
        }

        const porcentajeOcupacion = data.total > 0 ? Math.round((data.ocupadas / data.total) * 100) : 0;

        return (
            <div key={type} className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg dark:from-zinc-900 dark:to-zinc-800 dark:border dark:border-zinc-700 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white rounded-lg dark:bg-zinc-800 text-blue-600 dark:text-blue-400">
                        {getVehicleIcon(type)}
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">{label}</p>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                            {data.ocupadas}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-zinc-400">
                            de {data.total}
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-zinc-700">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all dark:bg-blue-500"
                            style={{ width: `${porcentajeOcupacion}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">
                        {data.disponibles} disponibles ({porcentajeOcupacion}% ocupado)
                    </p>
                </div>
            </div>
        );
    };

    // Mostrar loading mientras se determina el rol del usuario O si no es owner
    if (roleLoading || !isOwner) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">
                            {!roleLoading && isEmployee ? 'Redirigiendo...' :
                                !roleLoading && isDriver ? 'Redirigiendo...' :
                                    'Cargando dashboard...'}
                        </p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!estId) {
        return (
            <DashboardLayout>
                <div className="p-6">
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Resumen Operativo</h2>
                        <p className="text-gray-600 mb-6">
                            Selecciona un estacionamiento para acceder al resumen operativo
                        </p>
                        <button
                            onClick={() => window.location.href = '/dashboard/parking'}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Ir a Mis Estacionamientos
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Resumen Operativo</h1>
                    <p className="text-gray-600 dark:text-zinc-400 mt-1">
                        Bienvenido de vuelta, {user?.email?.split('@')[0]}
                    </p>
                </div>

                {/* Ingresos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                                    Ingresos del Día
                                </CardTitle>
                                <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900/20">
                                    <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
                                {formatCurrency(todayIncome)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                                Últimas 24 horas
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                                    Ingresos de la Semana
                                </CardTitle>
                                <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/20">
                                    <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
                                {formatCurrency(weekIncome)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                                Últimos 7 días
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                                    Ingresos del Mes
                                </CardTitle>
                                <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/20">
                                    <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
                                {formatCurrency(monthIncome)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                                Últimos 30 días
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Estado actual */}
                <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                    <CardHeader>
                        <CardTitle className="dark:text-zinc-100">Estado Actual del Estacionamiento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingPlazas ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    {renderSpaceInfo("Autos", "Auto")}
                                    {renderSpaceInfo("Motos", "Moto")}
                                    {renderSpaceInfo("Camionetas", "Camioneta")}
                                </div>
                                {plazasData && (
                                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg dark:from-zinc-800 dark:to-zinc-900 dark:border dark:border-zinc-700">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-500"></div>
                                                <span className="font-semibold text-gray-900 dark:text-zinc-100">
                                                    {plazasData.total_general.ocupadas}
                                                </span>
                                                <span className="text-gray-600 dark:text-zinc-400">ocupadas</span>
                                            </div>
                                            <span className="text-gray-400 dark:text-zinc-600">•</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                <span className="font-semibold text-gray-900 dark:text-zinc-100">
                                                    {plazasData.total_general.disponibles}
                                                </span>
                                                <span className="text-gray-600 dark:text-zinc-400">libres</span>
                                            </div>
                                            <span className="text-gray-400 dark:text-zinc-600">•</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-600 dark:text-zinc-400">Total:</span>
                                                <span className="font-bold text-gray-900 dark:text-zinc-100">
                                                    {plazasData.total_general.total}
                                                </span>
                                                <span className="text-gray-600 dark:text-zinc-400">plazas</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
