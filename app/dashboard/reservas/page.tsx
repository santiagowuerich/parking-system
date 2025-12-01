"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { MisReservasPanel } from "@/components/reservas/mis-reservas-panel";

export default function ReservasPage() {

    return (
        <DashboardLayout>
            <div className="flex h-screen bg-background">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="container mx-auto p-6 space-y-6">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Mis Reservas</h1>
                                <p className="text-gray-600">Gestiona tus reservas de estacionamiento</p>
                            </div>

                            <MisReservasPanel />
                        </div>
                    </main>
                </div>
            </div>
        </DashboardLayout>
    );
}
