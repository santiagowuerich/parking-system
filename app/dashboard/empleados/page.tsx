"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import GestionUsuariosPage from "@/app/gestion-usuarios/page";

export default function EmpleadosDashboardPage() {
    return (
        <DashboardLayout>
            <GestionUsuariosPage />
        </DashboardLayout>
    );
}
