"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { RouteGuard } from "@/components/route-guard";
import GestionTarifasPage from "@/app/gestion-tarifas/page";

export default function TarifasDashboardPage() {
    return (
        <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard/operador-simple">
            <DashboardLayout>
                <GestionTarifasPage />
            </DashboardLayout>
        </RouteGuard>
    );
}
