'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import VisualizacionPlazasPage from '@/app/visualizacion-plazas/page';

export default function VisualizacionPlazasDashboardPage() {
    return (
        <DashboardLayout>
            <VisualizacionPlazasPage />
        </DashboardLayout>
    );
}
