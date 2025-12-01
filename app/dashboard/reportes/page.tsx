"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ReporteCard } from "./components/reporte-card";
import { ReporteModal } from "./components/reporte-modal";
import {
    BarChart3,
    Activity,
    DollarSign,
    Calendar,
} from "lucide-react";

// Import report components
import { OcupacionReporte } from "./components/reportes/operativos/ocupacion-reporte";
import { MovimientosReporte } from "./components/reportes/operativos/movimientos-reporte";
import { IngresosReporte } from "./components/reportes/economicos/ingresos-reporte";
import { AbonosReporte } from "./components/reportes/economicos/abonos-reporte";

type ReporteType =
    | "ocupacion"
    | "movimientos"
    | "ingresos"
    | "abonos"
    | null;

export default function ReportesPage() {
    const [reporteActivo, setReporteActivo] = useState<ReporteType>(null);

    const abrirReporte = (reporte: ReporteType) => {
        setReporteActivo(reporte);
    };

    const cerrarReporte = () => {
        setReporteActivo(null);
    };

    const reporteConfig = {
        ocupacion: {
            titulo: "Ocupación y Disponibilidad",
            component: <OcupacionReporte />
        },
        movimientos: {
            titulo: "Movimientos de Playa",
            component: <MovimientosReporte />
        },
        ingresos: {
            titulo: "Ingresos",
            component: <IngresosReporte />
        },
        abonos: {
            titulo: "Abonos",
            component: <AbonosReporte />
        }
    };
    return (
        <DashboardLayout title="Reportes" description="Análisis y reportes del negocio">
            <div className="container mx-auto p-6 space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
                    <p className="text-gray-600">Análisis y reportes del negocio</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <ReporteCard
                            icon={BarChart3}
                            title="Ocupación y Disponibilidad"
                            description="Tasa de ocupación por hora y día operativos, con tiempos de permanencias."
                            onClick={() => abrirReporte("ocupacion")}
                            color="blue"
                        />

                        <ReporteCard
                            icon={Activity}
                            title="Movimientos de Playa"
                            description="Registro de entradas y salidas, con tipo de vehículos."
                            onClick={() => abrirReporte("movimientos")}
                            color="green"
                        />

                        <ReporteCard
                            icon={DollarSign}
                            title="Ingresos"
                            description="Desglose de ingresos por categoría, con métodos de pago."
                            onClick={() => abrirReporte("ingresos")}
                            color="orange"
                        />

                        <ReporteCard
                            icon={Calendar}
                            title="Abonos"
                            description="Desglose de abonos activos, nuevos, renovaciones y próximos vencimientos."
                            onClick={() => abrirReporte("abonos")}
                            color="purple"
                        />
                    </div>
            </div>

            {/* Render all modals */}
            {reporteActivo && reporteConfig[reporteActivo] && (
                <ReporteModal
                    isOpen={true}
                    onClose={cerrarReporte}
                    titulo={reporteConfig[reporteActivo].titulo}
                >
                    {reporteConfig[reporteActivo].component}
                </ReporteModal>
            )}
        </DashboardLayout>
    );
}
