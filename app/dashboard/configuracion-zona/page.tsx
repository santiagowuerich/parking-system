'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { RouteGuard } from '@/components/route-guard';
import ConfiguracionZonaPage from '@/app/configuracion-zona/page';

export default function ConfiguracionZonaDashboardPage() {
    return (
        <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard/operador-simple">
            <DashboardLayout>
                <ConfiguracionZonaPage />
            </DashboardLayout>
        </RouteGuard>
    );
}
