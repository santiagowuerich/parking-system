"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { RouteGuard } from "@/components/route-guard";
import GestionUsuariosPage from "@/app/gestion-usuarios/page";

export default function EmpleadosDashboardPage() {
    return (
        <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard/operador-simple">
            <DashboardLayout>
                <GestionUsuariosPage />
            </DashboardLayout>
        </RouteGuard>
    );
}
