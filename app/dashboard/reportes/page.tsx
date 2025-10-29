"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReporteCard } from "./components/reporte-card";
import { MetricasRapidas } from "./components/metricas-rapidas";
import { ReporteModal } from "./components/reporte-modal";
import { useReportesMetrics } from "./hooks/use-reportes-metrics";
import { cn, formatCurrency } from "@/lib/utils";
import {
    BarChart3,
    TrendingUp,
    Clock,
    Activity,
    DollarSign,
    CreditCard,
    Calendar,
    LineChart,
    PieChart,
    TrendingDown,
    Car,
    Users,
    TrendingDown as TrendingDownIcon,
    Timer,
    Wallet,
    Percent,
    Building
} from "lucide-react";

// Import report components
import { OcupacionReporte } from "./components/reportes/operativos/ocupacion-reporte";
import { MovimientosReporte } from "./components/reportes/operativos/movimientos-reporte";
import { TurnosReporte } from "./components/reportes/operativos/turnos-reporte";
import { IngresosReporte } from "./components/reportes/economicos/ingresos-reporte";
import { MediosPagoReporte } from "./components/reportes/economicos/medios-pago-reporte";
import { AbonosReporte } from "./components/reportes/economicos/abonos-reporte";
import { TendenciasReporte } from "./components/reportes/estrategia/tendencias-reporte";
import { RentabilidadReporte } from "./components/reportes/estrategia/rentabilidad-reporte";
import { ComparativoReporte } from "./components/reportes/estrategia/comparativo-reporte";

type ReporteType =
    | "ocupacion"
    | "movimientos"
    | "turnos"
    | "ingresos"
    | "medios-pago"
    | "abonos"
    | "tendencias"
    | "rentabilidad"
    | "comparativo"
    | null;

export default function ReportesPage() {
    const [reporteActivo, setReporteActivo] = useState<ReporteType>(null);
    const { plazasData, movimientosData, ingresosData, strategicMetrics, loading } = useReportesMetrics();

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
        },
        tendencias: {
            titulo: "Tendencias y Proyecciones",
            component: <TendenciasReporte />
        },
        rentabilidad: {
            titulo: "Rentabilidad por Zona",
            component: <RentabilidadReporte />
        },
        comparativo: {
            titulo: "Comparativo de Períodos",
            component: <ComparativoReporte />
        }
    };
    return (
        <DashboardLayout title="Reportes" description="Análisis y reportes del negocio">
            <div className="space-y-8">
                <Tabs defaultValue="operativos" className="w-full">
                    <div className="flex justify-center mb-8 mt-4">
                        <TabsList className="!inline-flex !h-auto !bg-transparent gap-2 !p-0">
                            <TabsTrigger
                                value="operativos"
                                className={cn(
                                    "!rounded-2xl !px-4 !py-3 !text-base !gap-3 !transition-all !duration-200 !relative !min-h-[48px]",
                                    "!flex !items-center !justify-center !outline-none !border-0",
                                    // Estado activo - igual que sidebar pero con barra abajo
                                    "data-[state=active]:!bg-gradient-to-r data-[state=active]:!from-blue-50 data-[state=active]:!to-blue-100/40",
                                    "dark:data-[state=active]:!from-blue-900/30 dark:data-[state=active]:!to-blue-800/20",
                                    "data-[state=active]:!shadow-[0_8px_20px_-8px_rgba(59,130,246,0.25)]",
                                    "data-[state=active]:!ring-1 data-[state=active]:!ring-blue-200 dark:data-[state=active]:!ring-blue-800",
                                    "data-[state=active]:!font-semibold data-[state=active]:!text-neutral-900 dark:data-[state=active]:!text-white",
                                    "data-[state=active]:before:!absolute data-[state=active]:before:!bottom-0",
                                    "data-[state=active]:before:!left-1.5 data-[state=active]:before:!right-1.5",
                                    "data-[state=active]:before:!h-1 data-[state=active]:before:!rounded-full data-[state=active]:before:!bg-blue-500",
                                    // Estado inactivo
                                    "data-[state=inactive]:!text-slate-600 dark:data-[state=inactive]:!text-slate-400",
                                    "data-[state=inactive]:!bg-transparent",
                                    // Hover
                                    "hover:!text-slate-900 dark:hover:!text-slate-200",
                                    "hover:!bg-slate-50/80 dark:hover:!bg-slate-800/40",
                                    "hover:!shadow-sm hover:!-translate-y-[1px]"
                                )}
                            >
                                <Activity className="h-5 w-5" />
                                <span>Operativos</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="economicos"
                                className={cn(
                                    "!rounded-2xl !px-4 !py-3 !text-base !gap-3 !transition-all !duration-200 !relative !min-h-[48px]",
                                    "!flex !items-center !justify-center !outline-none !border-0",
                                    // Estado activo
                                    "data-[state=active]:!bg-gradient-to-r data-[state=active]:!from-blue-50 data-[state=active]:!to-blue-100/40",
                                    "dark:data-[state=active]:!from-blue-900/30 dark:data-[state=active]:!to-blue-800/20",
                                    "data-[state=active]:!shadow-[0_8px_20px_-8px_rgba(59,130,246,0.25)]",
                                    "data-[state=active]:!ring-1 data-[state=active]:!ring-blue-200 dark:data-[state=active]:!ring-blue-800",
                                    "data-[state=active]:!font-semibold data-[state=active]:!text-neutral-900 dark:data-[state=active]:!text-white",
                                    "data-[state=active]:before:!absolute data-[state=active]:before:!bottom-0",
                                    "data-[state=active]:before:!left-1.5 data-[state=active]:before:!right-1.5",
                                    "data-[state=active]:before:!h-1 data-[state=active]:before:!rounded-full data-[state=active]:before:!bg-blue-500",
                                    // Estado inactivo
                                    "data-[state=inactive]:!text-slate-600 dark:data-[state=inactive]:!text-slate-400",
                                    "data-[state=inactive]:!bg-transparent",
                                    // Hover
                                    "hover:!text-slate-900 dark:hover:!text-slate-200",
                                    "hover:!bg-slate-50/80 dark:hover:!bg-slate-800/40",
                                    "hover:!shadow-sm hover:!-translate-y-[1px]"
                                )}
                            >
                                <DollarSign className="h-5 w-5" />
                                <span>Económicos</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="estrategia"
                                className={cn(
                                    "!rounded-2xl !px-4 !py-3 !text-base !gap-3 !transition-all !duration-200 !relative !min-h-[48px]",
                                    "!flex !items-center !justify-center !outline-none !border-0",
                                    // Estado activo
                                    "data-[state=active]:!bg-gradient-to-r data-[state=active]:!from-blue-50 data-[state=active]:!to-blue-100/40",
                                    "dark:data-[state=active]:!from-blue-900/30 dark:data-[state=active]:!to-blue-800/20",
                                    "data-[state=active]:!shadow-[0_8px_20px_-8px_rgba(59,130,246,0.25)]",
                                    "data-[state=active]:!ring-1 data-[state=active]:!ring-blue-200 dark:data-[state=active]:!ring-blue-800",
                                    "data-[state=active]:!font-semibold data-[state=active]:!text-neutral-900 dark:data-[state=active]:!text-white",
                                    "data-[state=active]:before:!absolute data-[state=active]:before:!bottom-0",
                                    "data-[state=active]:before:!left-1.5 data-[state=active]:before:!right-1.5",
                                    "data-[state=active]:before:!h-1 data-[state=active]:before:!rounded-full data-[state=active]:before:!bg-blue-500",
                                    // Estado inactivo
                                    "data-[state=inactive]:!text-slate-600 dark:data-[state=inactive]:!text-slate-400",
                                    "data-[state=inactive]:!bg-transparent",
                                    // Hover
                                    "hover:!text-slate-900 dark:hover:!text-slate-200",
                                    "hover:!bg-slate-50/80 dark:hover:!bg-slate-800/40",
                                    "hover:!shadow-sm hover:!-translate-y-[1px]"
                                )}
                            >
                                <TrendingUp className="h-5 w-5" />
                                <span>Estrategia</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* TAB: OPERATIVOS */}
                    <TabsContent value="operativos" className="mt-0 space-y-8">
                        <MetricasRapidas
                            titulo="Métricas operativas"
                            metricas={[
                                {
                                    label: "Ocupación Actual",
                                    value: loading ? "..." : plazasData ?
                                        `${Math.round((plazasData.total_general.ocupadas / plazasData.total_general.total) * 100)}%` :
                                        "0%",
                                    subtitle: "En tiempo real",
                                    icon: Percent,
                                },
                                {
                                    label: "Plazas Libres",
                                    value: loading ? "..." : plazasData ?
                                        `${plazasData.total_general.disponibles}` :
                                        "0",
                                    subtitle: `de ${plazasData?.total_general.total || 0} plazas`,
                                    icon: Car,
                                },
                                {
                                    label: "Movimientos Hoy",
                                    value: loading ? "..." : movimientosData ?
                                        `${movimientosData.ingresos_hoy} / ${movimientosData.egresos_hoy}` :
                                        "0 / 0",
                                    subtitle: "Ingreso / Egreso",
                                    icon: Activity,
                                }
                            ]}
                        />

                        <div className="space-y-3 max-w-6xl mx-auto">
                            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Reportes disponibles
                            </h3>
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
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB: ECONÓMICOS */}
                    <TabsContent value="economicos" className="mt-0 space-y-8">
                        <MetricasRapidas
                            titulo="Métricas económicas"
                            metricas={[
                                {
                                    label: "Ingresos Hoy",
                                    value: loading ? "..." : ingresosData ?
                                        formatCurrency(ingresosData.hoy) :
                                        "$0",
                                    subtitle: "Acumulado del día",
                                    icon: DollarSign,
                                },
                                {
                                    label: "Ingresos Semana",
                                    value: loading ? "..." : ingresosData ?
                                        formatCurrency(ingresosData.semana) :
                                        "$0",
                                    subtitle: "Últimos 7 días",
                                    icon: TrendingUp,
                                },
                                {
                                    label: "Ingresos Mes",
                                    value: loading ? "..." : ingresosData ?
                                        formatCurrency(ingresosData.mes) :
                                        "$0",
                                    subtitle: "Últimos 30 días",
                                    icon: Calendar,
                                }
                            ]}
                        />

                        <div className="space-y-3 max-w-6xl mx-auto">
                            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Reportes disponibles
                            </h3>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    </TabsContent>

                    {/* TAB: ESTRATEGIA */}
                    <TabsContent value="estrategia" className="mt-0 space-y-8">
                        <MetricasRapidas
                            titulo="Métricas estratégicas"
                            metricas={[
                                {
                                    label: "Ticket Promedio",
                                    value: loading ? "..." : strategicMetrics ?
                                        formatCurrency(strategicMetrics.ticketPromedio) :
                                        "$0",
                                    subtitle: "Por vehículo (30 días)",
                                    icon: DollarSign,
                                },
                                {
                                    label: "Ocupación Promedio",
                                    value: loading ? "..." : strategicMetrics ?
                                        `${strategicMetrics.ocupacionPromedio}%` :
                                        "0%",
                                    subtitle: "Últimos 30 días",
                                    icon: Building,
                                },
                                {
                                    label: "Flujo de Vehículos",
                                    value: loading ? "..." : strategicMetrics ?
                                        `${strategicMetrics.flujoVehiculos}` :
                                        "0",
                                    subtitle: "Promedio por día (30 días)",
                                    icon: Activity,
                                }
                            ]}
                        />

                        <div className="space-y-3 max-w-6xl mx-auto">
                            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Reportes disponibles
                            </h3>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <ReporteCard
                                    icon={LineChart}
                                    title="Tendencias y Proyecciones"
                                    description="Análisis histórico con proyecciones basadas en patrones."
                                    onClick={() => abrirReporte("tendencias")}
                                    color="purple"
                                />

                                <ReporteCard
                                    icon={PieChart}
                                    title="Rentabilidad por Zona"
                                    description="ROI por zona, tipo de vehículo y franja horaria."
                                    onClick={() => abrirReporte("rentabilidad")}
                                    color="orange"
                                />

                                <ReporteCard
                                    icon={TrendingDown}
                                    title="Comparativo de Períodos"
                                    description="Métricas clave: mes vs mes, trimestre y año vs año."
                                    onClick={() => abrirReporte("comparativo")}
                                    color="blue"
                                />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
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
