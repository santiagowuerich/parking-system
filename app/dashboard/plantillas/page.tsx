"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import GestionPlantillasPage from "@/app/gestion-plantillas/page";

export default function PlantillasDashboardPage() {
    return (
        <DashboardLayout>
            <GestionPlantillasPage />
        </DashboardLayout>
    );
}
