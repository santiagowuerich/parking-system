"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ReporteCard } from "./components/reporte-card";
import { ReporteModal } from "./components/reporte-modal";
import {
    BarChart3,
    Clock,
    Activity,
    DollarSign,
    CreditCard,
    Calendar,
} from "lucide-react";

// Import report components
import { OcupacionReporte } from "./components/reportes/operativos/ocupacion-reporte";
import { MovimientosReporte } from "./components/reportes/operativos/movimientos-reporte";
import { TurnosReporte } from "./components/reportes/operativos/turnos-reporte";
import { IngresosReporte } from "./components/reportes/economicos/ingresos-reporte";
import { MediosPagoReporte } from "./components/reportes/economicos/medios-pago-reporte";
import { AbonosReporte } from "./components/reportes/economicos/abonos-reporte";

type ReporteType =
    | "ocupacion"
    | "movimientos"
    | "turnos"
    | "ingresos"
    | "medios-pago"
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
            titulo: "Movimientos Diarios",
            component: <MovimientosReporte />
        },
        turnos: {
            titulo: "Desempeño de Turnos",
            component: <TurnosReporte />
        },
        ingresos: {
            titulo: "Ingresos por Período",
            component: <IngresosReporte />
        },
        "medios-pago": {
            titulo: "Medios de Pago",
            component: <MediosPagoReporte />
        },
        abonos: {
            titulo: "Abonos y Suscripciones",
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
                            description="Tasa de ocupación por zona y horario con identificación de horas pico."
                            onClick={() => abrirReporte("ocupacion")}
                            color="blue"
                        />

                        <ReporteCard
                            icon={Activity}
                            title="Movimientos Diarios"
                            description="Registro de entradas y salidas con tiempos de permanencia."
                            onClick={() => abrirReporte("movimientos")}
                            color="green"
                        />

                        <ReporteCard
                            icon={Clock}
                            title="Desempeño de Turnos"
                            description="Rendimiento de playeros y eficiencia operativa por turno."
                            onClick={() => abrirReporte("turnos")}
                            color="purple"
                        />

                        <ReporteCard
                            icon={DollarSign}
                            title="Ingresos por Período"
                            description="Evolución de ingresos con análisis de tendencias y comparativas."
                            onClick={() => abrirReporte("ingresos")}
                            color="green"
                        />

                        <ReporteCard
                            icon={CreditCard}
                            title="Medios de Pago"
                            description="Distribución de cobros: efectivo, transferencia, MercadoPago y QR."
                            onClick={() => abrirReporte("medios-pago")}
                            color="blue"
                        />

                        <ReporteCard
                            icon={Calendar}
                            title="Abonos y Suscripciones"
                            description="Ingresos recurrentes, renovaciones y próximos vencimientos."
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
