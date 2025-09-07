"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import GestionTarifasPage from "@/app/gestion-tarifas/page";

export default function TarifasDashboardPage() {
    return (
        <DashboardLayout>
            <GestionTarifasPage />
        </DashboardLayout>
    );
}
