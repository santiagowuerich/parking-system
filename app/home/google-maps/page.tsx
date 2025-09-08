"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, AlertCircle } from "lucide-react";

export default function GoogleMapsDashboardPage() {
    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100 mb-2">
                        Configuración de Google Maps
                    </h1>
                    <p className="text-gray-600 dark:text-zinc-400">
                        Configura la ubicación y mapas de tus estacionamientos
                    </p>
                </div>

                <Card className="max-w-2xl mx-auto">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
                            <AlertCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <CardTitle className="text-xl">Funcionalidad en Desarrollo</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-gray-600 dark:text-zinc-400">
                            La configuración avanzada de Google Maps estará disponible próximamente.
                            Por ahora puedes gestionar la ubicación básica desde otros paneles.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Button variant="outline" onClick={() => window.history.back()}>
                                Volver
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
