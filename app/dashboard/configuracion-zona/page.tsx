'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import ConfiguracionZonaPage from '@/app/configuracion-zona/page';

export default function ConfiguracionZonaDashboardPage() {
    return (
        <DashboardLayout>
            <ConfiguracionZonaPage />
        </DashboardLayout>
    );
}
