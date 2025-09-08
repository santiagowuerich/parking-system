"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import ParkingApp from "@/components/parking-app";

export default function OperadorDashboardPage() {
    return (
        <DashboardLayout>
            <ParkingApp />
        </DashboardLayout>
    );
}
