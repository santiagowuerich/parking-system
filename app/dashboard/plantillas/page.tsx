"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { RouteGuard } from "@/components/route-guard";
import GestionPlantillasPage from "@/app/gestion-plantillas/page";

export default function PlantillasDashboardPage() {
    return (
        <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard/operador-simple">
            <DashboardLayout>
                <GestionPlantillasPage />
            </DashboardLayout>
        </RouteGuard>
    );
}
