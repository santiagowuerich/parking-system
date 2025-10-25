"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function ServiciosReservasPage() {
    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Reservas del Estacionamiento</h1>
                        <p className="text-gray-600 dark:text-zinc-400">Gestiona todas las reservas del estacionamiento</p>
                    </div>
                </div>

                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-20">
                        <div className="text-center space-y-4">
                            <div className="text-6xl mb-4">🚧</div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                                En Construcción
                            </h2>
                            <p className="text-gray-600 dark:text-zinc-400 max-w-md">
                                Esta funcionalidad está en desarrollo. Pronto podrás gestionar todas las reservas de tu estacionamiento desde aquí.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
