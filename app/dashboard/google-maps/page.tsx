"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import GoogleMapsSetupPage from "@/app/google-maps-setup/page";

export default function GoogleMapsDashboardPage() {
    return (
        <DashboardLayout>
            <GoogleMapsSetupPage />
        </DashboardLayout>
    );
}
