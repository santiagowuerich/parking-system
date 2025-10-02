"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sun, ChevronLeft } from "lucide-react";
import { formatArgentineTimeWithDayjs } from "@/lib/utils";

// Componente Clock
const Clock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/Argentina/Buenos_Aires'
        });
    };

    return (
        <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-yellow-500" />
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-mono text-foreground">
                AR {formatTime(time)}
            </span>
        </div>
    );
};

export default function MovimientosPage() {
    const { estId } = useAuth();
    const { canOperateParking, loading: roleLoading } = useUserRole();
    const [movements, setMovements] = useState<any[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(true);

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
            <DashboardLayout>
                <div className="flex items-center justify-center h-screen">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    if (!canOperateParking) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-screen">
                    <p className="text-muted-foreground">No tienes permisos para acceder a esta página</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout clockComponent={<Clock />}>
            <div className="min-h-screen bg-white">
                <div className="p-6 space-y-6">
                    <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                        <CardHeader>
                            <CardTitle className="dark:text-zinc-100">Últimos movimientos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="dark:border-zinc-800">
                                        <TableHead className="dark:text-zinc-400">Fecha/Hora</TableHead>
                                        <TableHead className="dark:text-zinc-400">Patente</TableHead>
                                        <TableHead className="dark:text-zinc-400">Acción</TableHead>
                                        <TableHead className="dark:text-zinc-400">Zona</TableHead>
                                        <TableHead className="dark:text-zinc-400">Plaza</TableHead>
                                        <TableHead className="dark:text-zinc-400">Método</TableHead>
                                        <TableHead className="dark:text-zinc-400">Tarifa</TableHead>
                                        <TableHead className="text-right dark:text-zinc-400">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingMovements ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
                                            </TableCell>
                                        </TableRow>
                                    ) : movements.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                                                No hay movimientos registrados
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        movements.map((movement, idx) => (
                                            <TableRow key={idx} className="dark:border-zinc-800">
                                                <TableCell className="dark:text-zinc-100">
                                                    {movement.timestamp}
                                                </TableCell>
                                                <TableCell className="dark:text-zinc-100 font-medium">
                                                    {movement.license_plate}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={movement.action === 'Ingreso' ? 'default' : 'secondary'}
                                                        className={
                                                            movement.action === 'Ingreso'
                                                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                                                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                                        }
                                                    >
                                                        {movement.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="dark:text-zinc-100">{movement.zona}</TableCell>
                                                <TableCell className="dark:text-zinc-100">{movement.plaza}</TableCell>
                                                <TableCell className="dark:text-zinc-100">{movement.method}</TableCell>
                                                <TableCell className="dark:text-zinc-100">{movement.tarifa || '$1200/h'}</TableCell>
                                                <TableCell className="text-right dark:text-zinc-100">{movement.total}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
