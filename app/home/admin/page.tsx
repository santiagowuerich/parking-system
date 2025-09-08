"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Filter, CheckCircle2 } from "lucide-react";
import type { ParkingHistory, VehicleType } from "@/lib/types";
import { formatCurrency, formatTime, formatDuration } from "@/lib/utils";
import HistoryFilters from "@/components/history-filters";
import { toast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { createBrowserClient } from "@supabase/ssr";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ZoneManager } from "@/components/admin/ZoneManager";

// --- Importar y configurar Day.js ---
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

// Función de formato con Day.js
const formatArgentineTimeWithDayjs = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return "N/A";
    try {
        const dateUtc = dayjs.utc(dateString);
        if (!dateUtc.isValid()) {
            return "Fecha inválida";
        }
        return dateUtc.tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY hh:mm:ss A');
    } catch (error) {
        console.error("Error formateando fecha con Day.js en AdminPanel:", error);
        return "Error";
    }
};

export default function AdminDashboardPage() {
    const { user, refreshCapacity, estId } = useAuth();
    const [plazasStatus, setPlazasStatus] = useState<{ [seg: string]: { total: number, occupied: number, free: number, plazas: { pla_numero: number, occupied: boolean }[] } } | null>(null);
    const [filteredHistory, setFilteredHistory] = useState<ParkingHistory[]>([]);
    const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const [tempCapacities, setTempCapacities] = useState({ Auto: 0, Moto: 0, Camioneta: 0 });
    const [editingEntry, setEditingEntry] = useState<ParkingHistory | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<ParkingHistory | null>(null);
    const [multipleDelete, setMultipleDelete] = useState(false);
    const [reenterDialogOpen, setReenterDialogOpen] = useState(false);
    const [entryToReenter, setEntryToReenter] = useState<ParkingHistory | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [availableSpaces, setAvailableSpaces] = useState({
        Auto: 0,
        Moto: 0,
        Camioneta: 0,
        total: { capacity: 0, occupied: 0 }
    });
    const [capacity, setCapacity] = useState({ Auto: 0, Moto: 0, Camioneta: 0 });
    const [history, setHistory] = useState<ParkingHistory[]>([]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayIncome = filteredHistory
        .filter((entry) => new Date(entry.exit_time) >= today)
        .reduce((sum, entry) => sum + entry.fee, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const weekIncome = filteredHistory
        .filter((entry) => new Date(entry.exit_time) >= weekAgo)
        .reduce((sum, entry) => sum + entry.fee, 0);

    // Cargar datos iniciales
    useEffect(() => {
        if (!user || !estId) return;

        const loadInitialData = async () => {
            try {
                // Cargar capacidad
                const capacityRes = await fetch(`/api/capacity?est_id=${estId}`);
                if (capacityRes.ok) {
                    const capacityData = await capacityRes.json();
                    setCapacity(capacityData.capacity || { Auto: 0, Moto: 0, Camioneta: 0 });
                    setTempCapacities(capacityData.capacity || { Auto: 0, Moto: 0, Camioneta: 0 });
                }

                // Cargar historial
                const historyRes = await fetch(`/api/parking/history`);
                if (historyRes.ok) {
                    const historyData = await historyRes.json();
                    const formattedHistory = historyData.history?.map((h: any) => ({
                        id: h.id,
                        license_plate: h.license_plate,
                        type: h.type,
                        entry_time: h.entry_time,
                        exit_time: h.exit_time,
                        duration: typeof h.duration === 'number' ? h.duration : parseInt(h.duration),
                        fee: typeof h.fee === 'number' ? h.fee : parseFloat(h.fee),
                        payment_method: h.payment_method || 'No especificado'
                    })) || [];
                    setHistory(formattedHistory);
                    setFilteredHistory(formattedHistory);
                }

                // Cargar espacios disponibles
                const spacesRes = await fetch(`/api/parking/parked`);
                if (spacesRes.ok) {
                    const spacesData = await spacesRes.json();
                    const occupied = {
                        Auto: spacesData.parkedVehicles.filter((v: any) => v.type === "Auto").length,
                        Moto: spacesData.parkedVehicles.filter((v: any) => v.type === "Moto").length,
                        Camioneta: spacesData.parkedVehicles.filter((v: any) => v.type === "Camioneta").length,
                    };

                    const currentCapacity = capacity.Auto + capacity.Moto + capacity.Camioneta;
                    const currentOccupied = occupied.Auto + occupied.Moto + occupied.Camioneta;

                    setAvailableSpaces({
                        Auto: Math.max(0, capacity.Auto - occupied.Auto),
                        Moto: Math.max(0, capacity.Moto - occupied.Moto),
                        Camioneta: Math.max(0, capacity.Camioneta - occupied.Camioneta),
                        total: {
                            capacity: currentCapacity,
                            occupied: currentOccupied
                        }
                    });
                }

                // Cargar estado de plazas
                const plazasRes = await fetch(`/api/plazas/status?est_id=${estId}`);
                if (plazasRes.ok) {
                    const plazasData = await plazasRes.json();
                    setPlazasStatus(plazasData.byType);
                }

            } catch (error) {
                console.error("Error loading admin data:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Error al cargar los datos del panel de administrador"
                });
            }
        };

        loadInitialData();
    }, [user, estId, capacity.Auto, capacity.Moto, capacity.Camioneta]);

    const handleChange = (type: VehicleType, value: number) => {
        setTempCapacities((prev) => ({ ...prev, [type]: value }));
    };

    const handleRegeneratePlazas = async () => {
        if (!estId) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "ID de estacionamiento no válido"
            });
            return;
        }

        try {
            console.log('🔄 Regenerando plazas...');

            const response = await fetch('/api/capacity/plazas/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    estId: estId,
                    target: tempCapacities
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error regenerando plazas');
            }

            const result = await response.json();
            console.log('✅ Plazas regeneradas:', result);

            toast({
                title: "Éxito",
                description: `Plazas regeneradas exitosamente. Total: ${result.plazas?.length || 0} plazas.`
            });

            window.location.reload();

        } catch (error: any) {
            console.error('❌ Error regenerando plazas:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || 'Error regenerando las plazas'
            });
        }
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

            console.log('Enviando capacidad:', {
                userId: session.user.id,
                estId: estId,
                capacity: tempCapacities,
                sessionValid: !!session
            });

            // 1) Actualizar total en estacionamientos
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

            // 2) Sincronizar plazas de manera inteligente
            const targetForSync = {
                Auto: Number(tempCapacities.Auto || 0),
                Moto: Number(tempCapacities.Moto || 0),
                Camioneta: Number(tempCapacities.Camioneta || 0),
            };

            console.log('🔄 Sincronizando plazas de manera inteligente:', { estId, targetForSync });

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
                console.error('❌ Error en sincronización de plazas desde Guardar:', e);

                if (e.occupiedPlazas && e.occupiedPlazas.length > 0) {
                    throw new Error(`${e.error}\n\nPlazas ocupadas: ${e.occupiedPlazas.join(', ')}`);
                }
                throw new Error(e.error || `Error al sincronizar plazas (HTTP ${syncRes.status})`);
            }

            const syncResult = await syncRes.json();
            console.log('🎯 RESULTADO DE LA SINCRONIZACIÓN:', {
                exitoso: syncRes.ok,
                resultado: syncResult,
                mensaje: 'Verificar en los logs anteriores si la plaza 10 fue preservada'
            });

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

    const handleDeleteSelected = () => {
        if (selectedEntries.length === 0) return;
        setEntryToDelete(null);
        setMultipleDelete(true);
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        if (!entryToDelete && !multipleDelete) return;

        try {
            if (multipleDelete) {
                for (const id of selectedEntries) {
                    await deleteHistoryEntry(id);
                }
                setSelectedEntries([]);
                toast({
                    title: "Registros eliminados",
                    description: `${selectedEntries.length} registros han sido eliminados exitosamente.`,
                });
            } else if (entryToDelete) {
                await deleteHistoryEntry(entryToDelete.id);
                toast({
                    title: "Registro eliminado",
                    description: "El registro ha sido eliminado exitosamente.",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudieron eliminar los registros.",
            });
        } finally {
            setShowDeleteDialog(false);
            setEntryToDelete(null);
            setMultipleDelete(false);
        }
    };

    const deleteHistoryEntry = async (id: string) => {
        const response = await fetch(`/api/parking/history/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error al eliminar entrada del historial");
        }

        setFilteredHistory(prev => prev.filter(entry => entry.id !== id));
    };

    const handleDelete = (entry: ParkingHistory) => {
        setEntryToDelete(entry);
        setMultipleDelete(false);
        setShowDeleteDialog(true);
    };

    const handleEdit = (entry: ParkingHistory) => {
        setEditingEntry({ ...entry, payment_method: entry.payment_method || 'No especificado' });
        setIsEditDialogOpen(true);
    };

    const handleUpdateEntry = async () => {
        if (!editingEntry) return;

        try {
            const updates = {
                license_plate: editingEntry.license_plate,
                fee: editingEntry.fee,
                payment_method: editingEntry.payment_method
            };

            const response = await fetch(`/api/parking/history/${editingEntry.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    updates,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Error al actualizar entrada del historial");
            }

            setFilteredHistory(prev =>
                prev.map(entry =>
                    entry.id === editingEntry.id ? { ...entry, ...updates } : entry
                )
            );
            setIsEditDialogOpen(false);
            setEditingEntry(null);
            toast({
                title: "Registro actualizado",
                description: "El registro ha sido actualizado exitosamente.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al actualizar",
                description: "No se pudo actualizar el registro.",
            });
            console.error("Error al actualizar registro:", error);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = filteredHistory.filter(entry => entry.id != null).map(entry => entry.id);
            setSelectedEntries(allIds);
        } else {
            setSelectedEntries([]);
        }
    };

    const handleSelectOne = (e: React.ChangeEvent<HTMLInputElement>, entry: ParkingHistory) => {
        if (e.target.checked) {
            setSelectedEntries([...selectedEntries, entry.id]);
        } else {
            setSelectedEntries(selectedEntries.filter(id => id !== entry.id));
        }
    };

    const handleReenter = async (entry: ParkingHistory) => {
        setEntryToReenter(entry);
        setReenterDialogOpen(true);
    };

    const confirmReenter = async () => {
        if (!entryToReenter || !user) return;

        try {
            await deleteHistoryEntry(entryToReenter.id);

            const isAlreadyParked = false; // Simplificado para esta implementación

            if (isAlreadyParked) {
                throw new Error("Este vehículo ya se encuentra estacionado");
            }

            const originalEntryTime = entryToReenter.entry_time;

            const response = await fetch("/api/parking/entry", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    license_plate: entryToReenter.license_plate,
                    type: entryToReenter.type,
                    entry_time: originalEntryTime,
                }),
            });

            if (!response.ok) {
                throw new Error("Error al crear nuevo registro de entrada");
            }

            // Recargar datos
            window.location.reload();

            toast({
                title: "Vehículo reingresado",
                description: `El vehículo ${entryToReenter.license_plate} ha sido reingresado exitosamente.`,
            });
        } catch (error) {
            console.error("Error al reingresar vehículo:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Error al reingresar el vehículo"
            });
        } finally {
            setReenterDialogOpen(false);
            setEntryToReenter(null);
        }
    };

    const handleFilteredDataChange = (newData: ParkingHistory[]) => {
        const validEntries = newData.filter(entry =>
            entry &&
            entry.id &&
            typeof entry.id === 'string' &&
            entry.exit_time
        );

        const uniqueEntries = new Map();

        validEntries.forEach(entry => {
            const existingEntry = uniqueEntries.get(entry.license_plate);
            if (!existingEntry || new Date(entry.exit_time) > new Date(existingEntry.exit_time)) {
                uniqueEntries.set(entry.license_plate, entry);
            }
        });

        const filteredEntries = Array.from(uniqueEntries.values())
            .sort((a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime());

        setFilteredHistory(filteredEntries);
    };

    const renderSpaceInfo = (label: string, type: VehicleType) => (
        <div key={type} className="p-3 bg-gray-50 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <p className="text-sm text-gray-500 dark:text-zinc-400">{label}</p>
            <p className="text-lg font-medium dark:text-zinc-100">
                {availableSpaces[type]} libres de {capacity[type]}
            </p>
        </div>
    );

    useEffect(() => {
        setFilteredHistory(history);
    }, [history]);

    if (!user) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <p>No autorizado</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="space-y-6">
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

                    {/* Estado actual + botón para modificar */}
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

                    {/* Historial */}
                    <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div className="flex items-center gap-4">
                                <CardTitle className="dark:text-zinc-100">Historial de Operaciones</CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowFilters(true)}
                                    className="hidden flex items-center gap-2 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    <Filter className="h-4 w-4" />
                                    Filtros
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Dialog open={showFilters} onOpenChange={setShowFilters}>
                                <DialogContent className="max-w-3xl dark:bg-zinc-950 dark:border-zinc-800">
                                    <DialogHeader>
                                        <DialogTitle className="dark:text-zinc-100">Filtros de Búsqueda</DialogTitle>
                                        <DialogDescription className="dark:text-zinc-400">
                                            Ajusta los filtros para encontrar registros específicos en el historial.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <HistoryFilters
                                            history={history}
                                            onFilteredDataChange={handleFilteredDataChange}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowFilters(false)} className="dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">
                                            Cerrar
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {filteredHistory.length === 0 ? (
                                <p className="text-center text-gray-500 py-4 dark:text-zinc-500">No hay operaciones registradas</p>
                            ) : (
                                <div className="overflow-x-auto mt-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="dark:border-zinc-800">
                                                <TableHead className="w-[50px] hidden" />
                                                <TableHead className="dark:text-zinc-400">Matrícula</TableHead>
                                                <TableHead className="dark:text-zinc-400">Tipo</TableHead>
                                                <TableHead className="dark:text-zinc-400">Entrada</TableHead>
                                                <TableHead className="dark:text-zinc-400">Salida</TableHead>
                                                <TableHead className="dark:text-zinc-400">Duración</TableHead>
                                                <TableHead className="dark:text-zinc-400">Tarifa</TableHead>
                                                <TableHead className="dark:text-zinc-400">Método de Pago</TableHead>
                                                <TableHead className="text-right dark:text-zinc-400">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredHistory.length > 0 ? (
                                                filteredHistory.map((entry, index) => (
                                                    <TableRow key={String(entry.id ?? `entry-${index}`)} className="dark:border-zinc-800">
                                                        <TableCell className="hidden" />
                                                        <TableCell className="dark:text-zinc-100">{entry.license_plate}</TableCell>
                                                        <TableCell className="dark:text-zinc-100">{entry.type}</TableCell>
                                                        <TableCell className="dark:text-zinc-100">{formatArgentineTimeWithDayjs(entry.entry_time)}</TableCell>
                                                        <TableCell className="dark:text-zinc-100">{formatArgentineTimeWithDayjs(entry.exit_time)}</TableCell>
                                                        <TableCell className="dark:text-zinc-100">{formatDuration(entry.duration)}</TableCell>
                                                        <TableCell className="dark:text-zinc-100">{formatCurrency(entry.fee)}</TableCell>
                                                        <TableCell>
                                                            <Badge className="bg-black text-white hover:bg-gray-800 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600">
                                                                {entry.payment_method || "N/A"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex gap-1 justify-end">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleReenter(entry)}
                                                                    className="text-primary hover:text-primary hover:bg-primary/10 dark:text-blue-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                                                                    title="Reingresar vehículo"
                                                                >
                                                                    <CheckCircle2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow className="dark:border-zinc-800">
                                                    <TableCell colSpan={9} className="h-24 text-center dark:text-zinc-500">
                                                        No hay resultados.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Gestión de Zonas */}
                    <ZoneManager />
                </div>

                {/* Diálogos */}
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent className="dark:bg-zinc-950 dark:border-zinc-800">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="dark:text-zinc-100">Confirmar eliminación</AlertDialogTitle>
                            <AlertDialogDescription className="dark:text-zinc-400">
                                {multipleDelete
                                    ? `¿Estás seguro de que quieres eliminar ${selectedEntries.length} registros? Esta acción no se puede deshacer.`
                                    : "¿Estás seguro de que quieres eliminar este registro? Esta acción no se puede deshacer."
                                }
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="dark:bg-red-600 dark:hover:bg-red-700">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={reenterDialogOpen} onOpenChange={setReenterDialogOpen}>
                    <AlertDialogContent className="dark:bg-zinc-950 dark:border-zinc-800">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="dark:text-zinc-100">Reingresar vehículo</AlertDialogTitle>
                            <AlertDialogDescription className="dark:text-zinc-400">
                                ¿Quieres reingresar el vehículo {entryToReenter?.license_plate}? Se eliminará este registro del historial y se creará una nueva entrada con la misma hora original.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmReenter} className="dark:bg-white dark:text-black dark:hover:bg-gray-200">Reingresar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="dark:bg-zinc-950 dark:border-zinc-800">
                        <DialogHeader>
                            <DialogTitle className="dark:text-zinc-100">Editar registro</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {editingEntry && (
                                <>
                                    <div className="space-y-1">
                                        <Label className="dark:text-zinc-400">Matrícula</Label>
                                        <Input
                                            value={editingEntry.license_plate}
                                            onChange={(e) => setEditingEntry({ ...editingEntry, license_plate: e.target.value })}
                                            className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="dark:text-zinc-400">Tarifa</Label>
                                        <Input
                                            type="number"
                                            value={editingEntry.fee}
                                            onChange={(e) => setEditingEntry({ ...editingEntry, fee: parseFloat(e.target.value) })}
                                            className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="dark:text-zinc-400">Método de Pago</Label>
                                        <Select
                                            value={editingEntry.payment_method}
                                            onValueChange={(value) => setEditingEntry({ ...editingEntry, payment_method: value })}
                                        >
                                            <SelectTrigger className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-zinc-900 dark:border-zinc-700">
                                                <SelectItem value="Efectivo">Efectivo</SelectItem>
                                                <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                                <SelectItem value="MercadoPago">MercadoPago</SelectItem>
                                                <SelectItem value="Transferencia">Transferencia</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">
                                Cancelar
                            </Button>
                            <Button onClick={handleUpdateEntry} className="dark:bg-white dark:text-black dark:hover:bg-gray-200">
                                Actualizar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
