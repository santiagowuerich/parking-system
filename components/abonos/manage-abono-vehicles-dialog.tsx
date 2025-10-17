"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2 } from "lucide-react";

type VehiculoAsociado = {
    veh_patente: string;
    vehiculos?: {
        veh_marca?: string | null;
        veh_modelo?: string | null;
        veh_color?: string | null;
        catv_segmento?: string | null;
        tipo?: string;
    } | null;
};

type VehiculoConductor = {
    veh_patente: string;
    veh_marca?: string | null;
    veh_modelo?: string | null;
    veh_color?: string | null;
    catv_segmento?: string | null;
};

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    abo_nro: number | null;
}

const segmentoToTipo: Record<string, string> = {
    AUT: "Auto",
    MOT: "Moto",
    CAM: "Camioneta",
};

const defaultNewVehicle = {
    patente: "",
    tipo: "Auto" as "Auto" | "Moto" | "Camioneta",
    marca: "",
    modelo: "",
    color: "",
};

export function ManageAbonoVehiclesDialog({ open, onOpenChange, abo_nro }: Props) {
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [vehiculosAbono, setVehiculosAbono] = useState<VehiculoAsociado[]>([]);
    const [vehiculosConductor, setVehiculosConductor] = useState<VehiculoConductor[]>([]);
    const [selectedExisting, setSelectedExisting] = useState("");
    const [nuevoVehiculo, setNuevoVehiculo] = useState(defaultNewVehicle);

    useEffect(() => {
        if (open && abo_nro) {
            cargarVehiculos();
        }
        if (!open) {
            setError(null);
            setSelectedExisting("");
            setNuevoVehiculo(defaultNewVehicle);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, abo_nro]);

    const vehiculosDisponibles = useMemo(() => {
        const asociados = new Set(vehiculosAbono.map((v) => v.veh_patente));
        return vehiculosConductor.filter((v) => !asociados.has(v.veh_patente));
    }, [vehiculosAbono, vehiculosConductor]);

    const cargarVehiculos = async () => {
        if (!abo_nro) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/abonos/vehiculos?abo_nro=${abo_nro}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || "No se pudo cargar la informacion de vehiculos");
            }
            setVehiculosAbono(json.data.vehiculosAbono || []);
            setVehiculosConductor(json.data.vehiculosConductor || []);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al cargar los vehiculos");
        } finally {
            setLoading(false);
        }
    };

    const handleAddExisting = async () => {
        if (!abo_nro || !selectedExisting) return;
        setActionLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/abonos/vehiculos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ abo_nro, mode: "existing", patente: selectedExisting }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || "No se pudo asociar el vehiculo");
            }
            setVehiculosAbono(json.data.vehiculosAbono || []);
            setVehiculosConductor(json.data.vehiculosConductor || vehiculosConductor);
            setSelectedExisting("");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al asociar el vehiculo");
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddNew = async () => {
        if (!abo_nro) return;
        if (!nuevoVehiculo.patente.trim()) {
            setError("Ingresa una patente valida");
            return;
        }

        setActionLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/abonos/vehiculos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    abo_nro,
                    mode: "new",
                    vehiculo: {
                        ...nuevoVehiculo,
                        patente: nuevoVehiculo.patente.toUpperCase(),
                    },
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || "No se pudo registrar el vehiculo");
            }
            setVehiculosAbono(json.data.vehiculosAbono || []);
            setVehiculosConductor(json.data.vehiculosConductor || vehiculosConductor);
            setNuevoVehiculo(defaultNewVehicle);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al registrar el vehiculo");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemove = async (patente: string) => {
        if (!abo_nro) return;
        setActionLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/abonos/vehiculos", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ abo_nro, patente }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || "No se pudo quitar el vehiculo");
            }
            setVehiculosAbono(json.data.vehiculosAbono || []);
            setVehiculosConductor(json.data.vehiculosConductor || vehiculosConductor);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al quitar el vehiculo");
        } finally {
            setActionLoading(false);
        }
    };

    const obtenerTipo = (vehiculo?: VehiculoAsociado["vehiculos"]) => {
        const segmento = vehiculo?.catv_segmento;
        if (segmento && segmentoToTipo[segmento]) {
            return segmentoToTipo[segmento];
        }
        if (vehiculo?.tipo && segmentoToTipo[vehiculo.tipo]) {
            return segmentoToTipo[vehiculo.tipo];
        }
        if (vehiculo?.tipo) {
            return vehiculo.tipo;
        }
        return "-";
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Gestionar vehiculos del abono #{abo_nro ?? ""}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto pr-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-6 pb-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Vehiculos asociados</h3>
                                    <span className="text-sm text-muted-foreground">{vehiculosAbono.length} vehiculo(s)</span>
                                </div>

                                {vehiculosAbono.length === 0 ? (
                                    <p className="text-sm text-muted-foreground border rounded-md px-4 py-6 text-center">
                                        Este abono no tiene vehiculos asociados.
                                    </p>
                                ) : (
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Patente</TableHead>
                                                    <TableHead>Tipo</TableHead>
                                                    <TableHead>Marca</TableHead>
                                                    <TableHead>Modelo</TableHead>
                                                    <TableHead>Color</TableHead>
                                                    <TableHead className="w-20 text-right">Quitar</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {vehiculosAbono.map((vehiculo) => (
                                                    <TableRow key={vehiculo.veh_patente}>
                                                        <TableCell className="font-semibold">{vehiculo.veh_patente}</TableCell>
                                                        <TableCell>{obtenerTipo(vehiculo.vehiculos)}</TableCell>
                                                        <TableCell>{vehiculo.vehiculos?.veh_marca || "-"}</TableCell>
                                                        <TableCell>{vehiculo.vehiculos?.veh_modelo || "-"}</TableCell>
                                                        <TableCell>{vehiculo.vehiculos?.veh_color || "-"}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemove(vehiculo.veh_patente)}
                                                                disabled={actionLoading}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>

                            <div className="border rounded-lg p-4 space-y-4">
                                <div>
                                    <h3 className="text-base font-semibold">Agregar vehiculo existente</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Selecciona uno de los vehiculos registrados del conductor para asociarlo a este abono.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                                    <div className="flex-1">
                                        <Label>Vehiculo</Label>
                                        <Select value={selectedExisting} onValueChange={setSelectedExisting}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={vehiculosDisponibles.length === 0 ? "No hay vehiculos disponibles" : "Selecciona un vehiculo"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vehiculosDisponibles.map((vehiculo) => (
                                                    <SelectItem key={vehiculo.veh_patente} value={vehiculo.veh_patente}>
                                                        {vehiculo.veh_patente} - {segmentoToTipo[vehiculo.catv_segmento || "AUT"] || "Auto"} -{" "}
                                                        {[vehiculo.veh_marca, vehiculo.veh_modelo].filter(Boolean).join(" ") || "Sin detalles"}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        className="md:w-auto"
                                        onClick={handleAddExisting}
                                        disabled={!selectedExisting || actionLoading}
                                    >
                                        {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                        Asociar
                                    </Button>
                                </div>
                            </div>

                            <div className="border rounded-lg p-4 space-y-4">
                                <div>
                                    <h3 className="text-base font-semibold">Registrar nuevo vehiculo</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Si el conductor tiene un vehiculo nuevo, registralo y se asociara automaticamente a este abono.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <Label>Patente *</Label>
                                        <Input
                                            value={nuevoVehiculo.patente}
                                            onChange={(e) => setNuevoVehiculo((prev) => ({ ...prev, patente: e.target.value.toUpperCase() }))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Tipo *</Label>
                                        <Select value={nuevoVehiculo.tipo} onValueChange={(value: "Auto" | "Moto" | "Camioneta") => setNuevoVehiculo((prev) => ({ ...prev, tipo: value }))}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Auto">Auto</SelectItem>
                                                <SelectItem value="Moto">Moto</SelectItem>
                                                <SelectItem value="Camioneta">Camioneta</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Marca</Label>
                                        <Input
                                            value={nuevoVehiculo.marca}
                                            onChange={(e) => setNuevoVehiculo((prev) => ({ ...prev, marca: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Modelo</Label>
                                        <Input
                                            value={nuevoVehiculo.modelo}
                                            onChange={(e) => setNuevoVehiculo((prev) => ({ ...prev, modelo: e.target.value }))}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Label>Color</Label>
                                        <Input
                                            value={nuevoVehiculo.color}
                                            onChange={(e) => setNuevoVehiculo((prev) => ({ ...prev, color: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={handleAddNew} disabled={actionLoading}>
                                        {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "+ Confirmar"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || actionLoading}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
