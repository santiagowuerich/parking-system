"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { MisReservasPanel } from "@/components/reservas/mis-reservas-panel";

export default function ReservasPage() {
    const router = useRouter();

    return (
        <DashboardLayout>
            <div className="h-screen bg-gray-50 flex flex-col">
                <div className="border-b bg-card h-16 flex items-center">
                    <div className="px-6 py-3 flex justify-between items-center w-full">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Mis Reservas</h1>
                            <p className="text-gray-600 mt-1">
                                Gestiona tus reservas de estacionamiento
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => router.push('/conductor')}
                            >
                                <Calendar className="w-4 h-4 mr-2" />
                                Ver Estacionamientos
                            </Button>
                            <Button
                                onClick={() => router.push('/conductor')}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Nueva Reserva
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    <MisReservasPanel />
                </div>
            </div>
        </DashboardLayout>
    );
}
