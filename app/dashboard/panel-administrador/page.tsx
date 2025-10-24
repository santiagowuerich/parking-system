"use client";

import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { RouteGuard } from "@/components/route-guard";
import { MovimientosTable } from "@/components/movimientos-table";

export default function HistorialMovimientosPage() {
    const { estId } = useAuth();

    return (
        <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard/operador-simple">
            <DashboardLayout>
                <div className="p-6">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900">Historial de Movimientos</h1>
                        <p className="text-gray-600 mt-1">
                            Consulta el historial de operaciones del estacionamiento
                        </p>
                    </div>

                    <MovimientosTable estId={estId} showTitle={false} showFilters={true} />
                </div>
            </DashboardLayout>
        </RouteGuard>
    );
}
