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
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { VehicleType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { createBrowserClient } from "@supabase/ssr";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function DashboardPage() {
    const { user, estId, parkedVehicles, parkingCapacity, refreshCapacity } = useAuth();
    const { isOwner, isEmployee, isDriver, loading: roleLoading } = useUserRole();
    const [open, setOpen] = useState(false);
    const [tempCapacities, setTempCapacities] = useState(parkingCapacity || { Auto: 0, Moto: 0, Camioneta: 0 });
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Calcular espacios disponibles
    const availableSpaces = {
        Auto: (parkingCapacity?.Auto || 0) - (parkedVehicles?.filter(v => v.type === 'Auto').length || 0),
        Moto: (parkingCapacity?.Moto || 0) - (parkedVehicles?.filter(v => v.type === 'Moto').length || 0),
        Camioneta: (parkingCapacity?.Camioneta || 0) - (parkedVehicles?.filter(v => v.type === 'Camioneta').length || 0),
        total: {
            capacity: (parkingCapacity?.Auto || 0) + (parkingCapacity?.Moto || 0) + (parkingCapacity?.Camioneta || 0),
            occupied: parkedVehicles?.length || 0
        }
    };

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

    // Cargar historial
    useEffect(() => {
        const loadHistory = async () => {
            if (!estId) {
                setLoading(false);
                return;
            }

            try {
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                const { data, error } = await supabase
                    .from('vw_historial_estacionamiento')
                    .select('*')
                    .eq('est_id', estId)
                    .order('exit_time', { ascending: false });

                if (error) throw error;

                setHistory(data || []);
            } catch (error) {
                console.error("Error al cargar historial:", error);
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

    const renderSpaceInfo = (label: string, type: VehicleType) => (
        <div key={type} className="p-3 bg-gray-50 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <p className="text-sm text-gray-500 dark:text-zinc-400">{label}</p>
            <p className="text-lg font-medium dark:text-zinc-100">
                {(parkingCapacity?.[type] || 0) - availableSpaces[type]} ocupados de {parkingCapacity?.[type] || 0}
            </p>
        </div>
    );

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
                    <h1 className="text-3xl font-bold text-gray-900">Resumen Operativo</h1>
                    <p className="text-gray-600 mt-1">
                        Bienvenido de vuelta, {user?.email?.split('@')[0]}
                    </p>
                </div>

                {/* Ingresos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                        <CardHeader>
                            <CardTitle className="dark:text-zinc-100">Ingresos del Día</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold dark:text-zinc-100">{formatCurrency(todayIncome)}</p>
                        </CardContent>
                    </Card>

                    <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                        <CardHeader>
                            <CardTitle className="dark:text-zinc-100">Ingresos de la Semana</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold dark:text-zinc-100">{formatCurrency(weekIncome)}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Estado actual */}
                <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                    <CardHeader className="flex flex-row justify-between items-center">
                        <CardTitle className="dark:text-zinc-100">Estado Actual del Estacionamiento</CardTitle>
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">
                                    Modificar espacios
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="dark:bg-zinc-950 dark:border-zinc-800">
                                <DialogHeader>
                                    <DialogTitle className="dark:text-zinc-100">Modificar capacidad máxima</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-2">
                                    {(["Auto", "Moto", "Camioneta"] as VehicleType[]).map((type) => (
                                        <div key={type} className="space-y-1">
                                            <label className="text-sm font-medium dark:text-zinc-400">{type}</label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={tempCapacities[type]}
                                                onChange={(e) => handleChange(type, parseInt(e.target.value))}
                                                className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <DialogFooter className="flex justify-end gap-2">
                                    <Button onClick={handleSave} className="dark:bg-white dark:text-black dark:hover:bg-gray-200">Guardar</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {renderSpaceInfo("Autos", "Auto")}
                            {renderSpaceInfo("Motos", "Moto")}
                            {renderSpaceInfo("Camionetas", "Camioneta")}
                        </div>
                        <div className="mt-4 p-3 bg-gray-100 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
                            <p className="text-center font-medium dark:text-zinc-100">
                                Total: {availableSpaces.total.occupied} vehículos ocupando {availableSpaces.total.capacity} espacios (
                                {availableSpaces.total.capacity - availableSpaces.total.occupied} libres)
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
