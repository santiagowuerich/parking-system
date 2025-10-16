"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { CrearAbonoPanel } from "@/components/abonos/crear-abono-panel";
import { useUserRole } from "@/lib/use-user-role";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function CrearAbonoPage() {
    const { isEmployee, loading: roleLoading } = useUserRole();
    const [estacionamientoId, setEstacionamientoId] = useState<number | null>(null);
    const [estacionamientoNombre, setEstacionamientoNombre] = useState<string>("");
    const [loadingEstacionamiento, setLoadingEstacionamiento] = useState(true);
    const [error, setError] = useState<string>("");

    // Obtener estacionamiento asignado
    useEffect(() => {
        const obtenerEstacionamiento = async () => {
            try {
                const response = await fetch("/api/auth/get-employee-parking");
                const data = await response.json();

                console.log('📍 Respuesta de get-employee-parking:', data);

                if (data.has_assignment && data.est_id) {
                    setEstacionamientoId(data.est_id);
                    setEstacionamientoNombre(data.est_nombre || "Estacionamiento");
                    console.log(`✅ Estacionamiento asignado: ${data.est_id} - ${data.est_nombre}`);
                } else {
                    setError(data.message || "No se pudo obtener el estacionamiento asignado");
                    console.log('❌ No hay asignación:', data.message);
                }
            } catch (err) {
                console.error("Error obteniendo estacionamiento:", err);
                setError("Error al obtener el estacionamiento");
            } finally {
                setLoadingEstacionamiento(false);
            }
        };

        if (isEmployee && !roleLoading) {
            obtenerEstacionamiento();
        }
    }, [isEmployee, roleLoading]);

    // Verificar acceso
    if (!isEmployee && !roleLoading) {
        return (
            <DashboardLayout>
                <div className="h-screen flex items-center justify-center p-4">
                    <Alert variant="destructive" className="max-w-md">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            No tienes permisos para acceder a esta página.
                        </AlertDescription>
                    </Alert>
                </div>
            </DashboardLayout>
        );
    }

    if (roleLoading || loadingEstacionamiento) {
        return (
            <DashboardLayout>
                <div className="h-screen flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <p className="text-gray-600">Cargando...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !estacionamientoId) {
        return (
            <DashboardLayout>
                <div className="h-screen flex items-center justify-center p-4">
                    <Alert variant="destructive" className="max-w-md">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {error || "No se encontró un estacionamiento asignado"}
                        </AlertDescription>
                    </Alert>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="border-b bg-white">
                    <div className="px-6 py-4">
                        <h1 className="text-2xl font-bold text-gray-900">Crear Abono</h1>
                        <p className="text-gray-600 mt-1">
                            Registra nuevos conductores y crea abonos de estacionamiento en {estacionamientoNombre}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <CrearAbonoPanel
                        estacionamientoId={estacionamientoId}
                        estacionamientoNombre={estacionamientoNombre}
                    />
                </div>
            </div>
        </DashboardLayout>
    );
}
