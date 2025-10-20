"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatArgentineTimeWithDayjs } from "@/lib/utils";
import { TurnoGuard } from "@/components/turno-guard";
import { VehicleMovementsHistoryModal } from "@/components/vehicle-movements-history-modal";


export default function MovimientosPage() {
    const { estId } = useAuth();
    const { canOperateParking, loading: roleLoading } = useUserRole();
    const [movements, setMovements] = useState<any[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(true);
    const [selectedMovement, setSelectedMovement] = useState<{
        ocupacionId: number;
        licensePlate: string;
    } | null>(null);

    useEffect(() => {
        if (!estId) return;
        loadMovements();
    }, [estId]);

    const loadMovements = async () => {
        if (!estId) return;

        setLoadingMovements(true);
        try {
            const response = await fetch(`/api/parking/movements?est_id=${estId}`);
            const result = await response.json();

            if (result.success && result.data) {
                setMovements(result.data);
            } else {
                console.error('Error en respuesta:', result);
                setMovements([]);
            }
        } catch (error) {
            console.error('Error cargando movimientos:', error);
            setMovements([]);
        } finally {
            setLoadingMovements(false);
        }
    };

    if (roleLoading) {
        return (
            <div className="flex h-screen bg-background">
                <DashboardSidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="flex items-center justify-center h-screen">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    if (!canOperateParking) {
        return (
            <div className="flex h-screen bg-background">
                <DashboardSidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="flex items-center justify-center h-screen">
                            <p className="text-muted-foreground">No tienes permisos para acceder a esta página</p>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-auto">
                    <div className="min-h-screen bg-white">
                        <div className="p-6 space-y-6">
                            <TurnoGuard showAlert={true} redirectButton={true}>
                                <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                                <CardHeader>
                                    <CardTitle className="dark:text-zinc-100">Movimientos</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="dark:border-zinc-800">
                                                <TableHead className="dark:text-zinc-400">Patente</TableHead>
                                                <TableHead className="dark:text-zinc-400">Estado</TableHead>
                                                <TableHead className="dark:text-zinc-400">Fecha Ingreso</TableHead>
                                                <TableHead className="dark:text-zinc-400">Fecha Egreso</TableHead>
                                                <TableHead className="dark:text-zinc-400">Zona</TableHead>
                                                <TableHead className="dark:text-zinc-400">Plaza</TableHead>
                                                <TableHead className="dark:text-zinc-400">Método</TableHead>
                                                <TableHead className="dark:text-zinc-400">Tarifa</TableHead>
                                                <TableHead className="text-right dark:text-zinc-400">Total</TableHead>
                                                <TableHead className="dark:text-zinc-400">Movimientos</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loadingMovements ? (
                                                <TableRow>
                                                    <TableCell colSpan={10} className="text-center py-8">
                                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
                                                    </TableCell>
                                                </TableRow>
                                            ) : movements.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={10} className="text-center py-8 text-zinc-500">
                                                        No hay movimientos registrados
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                movements.map((movement, idx) => (
                                                    <TableRow key={idx} className="dark:border-zinc-800">
                                                        <TableCell className="dark:text-zinc-100 font-medium">
                                                            {movement.license_plate}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2 h-2 rounded-full ${movement.action === 'Ingreso' ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                <span className={`text-sm font-medium ${movement.action === 'Ingreso' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                                                    {movement.action}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="dark:text-zinc-100">
                                                            {formatArgentineTimeWithDayjs(movement.fecha_ingreso)}
                                                        </TableCell>
                                                        <TableCell className="dark:text-zinc-100">
                                                            {movement.fecha_egreso ? formatArgentineTimeWithDayjs(movement.fecha_egreso) : '-'}
                                                        </TableCell>
                                                        <TableCell className="dark:text-zinc-100">{movement.zona}</TableCell>
                                                        <TableCell className="dark:text-zinc-100">{movement.plaza}</TableCell>
                                                        <TableCell className="dark:text-zinc-100">{movement.method}</TableCell>
                                                        <TableCell className="dark:text-zinc-100">{movement.tarifa || '$1200/h'}</TableCell>
                                                        <TableCell className="text-right dark:text-zinc-100">{movement.total}</TableCell>
                                                        <TableCell className="dark:text-zinc-100">
                                                            {movement.movement_count > 0 ? (
                                                                <button
                                                                    onClick={() =>
                                                                        setSelectedMovement({
                                                                            ocupacionId: movement.ocu_id,
                                                                            licensePlate: movement.license_plate,
                                                                        })
                                                                    }
                                                                    className="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                                                >
                                                                    Movimientos ({movement.movement_count})
                                                                </button>
                                                            ) : (
                                                                <span className="text-gray-400 dark:text-gray-600 text-sm italic">
                                                                    Sin movimientos
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            </TurnoGuard>
                        </div>
                    </div>
                </main>
            </div>

            <VehicleMovementsHistoryModal
                isOpen={!!selectedMovement}
                onClose={() => setSelectedMovement(null)}
                ocupacionId={selectedMovement?.ocupacionId || null}
                licensePlate={selectedMovement?.licensePlate || ""}
            />
        </div>
    );
}
