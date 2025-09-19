'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { RouteGuard } from '@/components/route-guard';
import VisualizacionPlazasPage from '@/app/visualizacion-plazas/page';

export default function VisualizacionPlazasDashboardPage() {
    return (
        <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard/operador-simple">
            <DashboardLayout>
                <VisualizacionPlazasPage />
            </DashboardLayout>
        </RouteGuard>
    );
}
