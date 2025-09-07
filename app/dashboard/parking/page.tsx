"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import UserParkings from "@/components/user-parkings";

export default function ParkingDashboardPage() {
    return (
        <DashboardLayout>
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Mis Estacionamientos</h1>
                    <p className="text-gray-600 mt-1">
                        Administra y cambia entre tus diferentes estacionamientos
                    </p>
                </div>
                <UserParkings />
            </div>
        </DashboardLayout>
    );
}
