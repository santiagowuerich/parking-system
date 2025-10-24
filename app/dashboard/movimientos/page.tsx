"use client";

import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Loader2 } from "lucide-react";
import { TurnoGuard } from "@/components/turno-guard";
import { MovimientosTable } from "@/components/movimientos-table";

export default function MovimientosPage() {
    const { estId } = useAuth();
    const { canOperateParking, loading: roleLoading } = useUserRole();

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
                                <MovimientosTable estId={estId} showTitle={true} showFilters={false} />
                            </TurnoGuard>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
