"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/lib/use-user-role";
import {
    Calendar,
    Construction,
    Clock,
    CheckCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function AbonosPage() {
    const { isDriver, isEmployee, isOwner, loading: roleLoading } = useUserRole();
    const router = useRouter();

    // Si no es conductor, no mostrar nada (DashboardLayout manejará la redirección)
    if (!isDriver && !roleLoading) {
        return <DashboardLayout><div></div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="h-screen bg-gray-50 flex flex-col">
                <div className="border-b bg-card h-16 flex items-center">
                    <div className="px-6 py-3 flex justify-between items-center w-full">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Mis Abonos</h1>
                            <p className="text-gray-600 mt-1">
                                Gestioná tus suscripciones y benefíciate de tarifas especiales
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-6">
                    <Card className="max-w-2xl w-full">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                                <Construction className="w-8 h-8 text-orange-600" />
                            </div>
                            <CardTitle className="text-2xl text-gray-900">
                                Página en Construcción
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center space-y-6">
                            <div className="space-y-2">
                                <p className="text-lg text-gray-700">
                                    Estamos trabajando en esta funcionalidad
                                </p>
                                <p className="text-gray-600">
                                    Pronto podrás gestionar tus abonos y suscripciones desde aquí.
                                </p>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-6 space-y-4">
                                <div className="flex items-center justify-center gap-2 text-blue-800">
                                    <Clock className="w-5 h-5" />
                                    <span className="font-semibold">Próximamente disponible</span>
                                </div>

                                <div className="space-y-3 text-left">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <span className="text-sm text-gray-700">Visualizar abonos activos</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <span className="text-sm text-gray-700">Contratar nuevos abonos</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <span className="text-sm text-gray-700">Renovar suscripciones</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <span className="text-sm text-gray-700">Historial de pagos</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Button
                                    onClick={() => router.push('/conductor')}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Ir al Mapa de Estacionamientos
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => router.push('/conductor/vehiculos')}
                                >
                                    Mis Vehículos
                                </Button>
                            </div>

                            <div className="text-xs text-gray-500 pt-4 border-t">
                                ¿Necesitas ayuda? Contacta con soporte técnico
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
