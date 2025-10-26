"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { RouteGuard } from "@/components/route-guard";
import { useAuth } from "@/lib/auth-context";
import GestionTurnosDueno from "@/components/turnos/gestion-turnos-dueno";

export default function GestionTurnosPage() {
    const { estId } = useAuth();

    return (
        <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard">
            <DashboardLayout>
                <GestionTurnosDueno estId={estId} />
            </DashboardLayout>
        </RouteGuard>
    );
}
