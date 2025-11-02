"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { formatCurrency } from "@/lib/utils";

interface HistoryEntry {
    entry_time: string | null;
    exit_time: string | null;
    fee?: number | null;
    pag_tipo?: string | null;
    abo_nro?: number | null;
    mepa_metodo?: string | null;
    veh_patente?: string | null;
    pla_numero?: number | null;
    catv_segmento?: "AUT" | "MOT" | "CAM" | null;
}

interface TarifaData {
    plantilla_id: number;
    nombre_plantilla: string;
    catv_segmento: "AUT" | "MOT" | "CAM";
    tarifas: Record<number, {
        precio: number;
        fraccion: number;
        tipo: number;
        fecha: string;
    }>;
}

interface PlazasApi {
    plazas: Array<{
        pla_numero: number;
        pla_estado: "Libre" | "Ocupada" | "Abonado";
        plantillas?: { 
            catv_segmento?: "AUT" | "MOT" | "CAM";
            plantilla_id?: number;
        } | null;
    }>;
}

function hoursBetween(start: Date, end: Date) {
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    return diffMs / (1000 * 60 * 60);
}

export function RentabilidadReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [tarifas, setTarifas] = useState<TarifaData[]>([]);
    const [plazasData, setPlazasData] = useState<PlazasApi | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Función para generar PDF con html2canvas
    const handlePrint = async () => {
        const element = printRef.current;
        if (!element) return;

        try {
            const canvas = await html2canvas(element, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                windowWidth: 1920,
                windowHeight: element.scrollHeight,
                backgroundColor: '#ffffff',
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            const pdf = new jsPDF('p', 'mm', 'a4');

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const pdfUsableHeight = pdfHeight - 10;

            const imgWidth = pdfWidth - 10;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let finalImgWidth = imgWidth;
            let finalImgHeight = imgHeight;

            if (imgHeight > pdfUsableHeight) {
                const scaleFactor = pdfUsableHeight / imgHeight;
                finalImgWidth = imgWidth * scaleFactor;
                finalImgHeight = pdfUsableHeight;
            }

            const xOffset = (pdfWidth - finalImgWidth) / 2;
            const yOffset = (pdfHeight - finalImgHeight) / 2;

            pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalImgWidth, finalImgHeight);

            const fileName = `rentabilidad-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('Error al generar PDF:', error);
            alert('Error al generar el PDF. Por favor intenta nuevamente.');
        }
    };


    // Carga inicial y al cambiar filtros base
    useEffect(() => {
        const from = dateRange?.from ? new Date(dateRange.from) : new Date(new Date().setDate(new Date().getDate() - 30));
        const to = dateRange?.to ? new Date(dateRange.to) : new Date();
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);

        const load = async () => {
            if (!estId) return;
            setLoading(true);
            try {
                // Historial
                const res = await fetch(`/api/parking/history?est_id=${estId}`);
                const json = await res.json();
                const rows: HistoryEntry[] = Array.isArray(json.history) ? json.history : [];
                
                // Tarifas
                const tarifasRes = await fetch(`/api/tarifas?est_id=${estId}`);
                const tarifasJson = await tarifasRes.json();
                const tarifasData: TarifaData[] = Array.isArray(tarifasJson.tarifas) ? tarifasJson.tarifas : [];
                
                // Plazas actuales
                const plazasRes = await fetch(`/api/plazas?est_id=${estId}`);
                const plazasJson: PlazasApi = await plazasRes.json();
                setPlazasData(plazasJson);

                // Filtro temporal + tipo de vehículo
                const filtered = Array.isArray(rows) ? rows.filter((r) => {
                    const entry = r.entry_time ? new Date(r.entry_time) : null;
                    const exit = r.exit_time ? new Date(r.exit_time) : null;
                    const inRange = (
                        (entry && entry <= to && entry >= from) ||
                        (exit && exit <= to && exit >= from) ||
                        (entry && exit && entry < from && exit > to)
                    );
                    return inRange;
                }) : [];
                
                setHistory(filtered);
                setTarifas(tarifasData);
            } catch (e) {
                console.error("Error cargando datos de rentabilidad:", e);
                setHistory([]);
                setTarifas([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [estId, dateRange]);

    // Cálculos de rentabilidad
    const {
        rentabilidadPorTipo,
        ingresosTotales,
        ocupacionPorTipo,
        ticketPromedioPorTipo,
        insights
    } = useMemo(() => {
        const result = {
            rentabilidadPorTipo: [] as Array<{
                tipo: string;
                ingresos: number;
                ocupacion: number;
                ticketPromedio: number;
                rentabilidad: number;
                plazas: number;
            }>,
            ingresosTotales: 0,
            ocupacionPorTipo: {} as Record<string, number>,
            ticketPromedioPorTipo: {} as Record<string, number>,
            insights: [] as string[]
        };

        if (!history.length || !tarifas.length || !plazasData) {
            return result;
        }

        // Agrupar por tipo de vehículo
        const tipoMap: Record<string, string> = {
            'AUT': 'Autos',
            'MOT': 'Motos', 
            'CAM': 'Camionetas'
        };

        const ingresosPorTipo: Record<string, number> = {};
        const movimientosPorTipo: Record<string, number> = {};
        const horasPorTipo: Record<string, number> = {};

        history.forEach((entry) => {
            // El API ahora retorna catv_segmento directamente desde la plaza
            let segmento: "AUT" | "MOT" | "CAM" = entry.catv_segmento || 'AUT';

            const tipo = tipoMap[segmento] || 'Autos';
            const fee = entry.fee || 0;
            const entryTime = entry.entry_time ? new Date(entry.entry_time) : null;
            const exitTime = entry.exit_time ? new Date(entry.exit_time) : null;
            
            ingresosPorTipo[tipo] = (ingresosPorTipo[tipo] || 0) + fee;
            movimientosPorTipo[tipo] = (movimientosPorTipo[tipo] || 0) + 1;
            
            if (entryTime && exitTime) {
                const horas = hoursBetween(entryTime, exitTime);
                horasPorTipo[tipo] = (horasPorTipo[tipo] || 0) + horas;
            }
        });

        // Calcular ocupación por tipo de plaza
        const plazasPorTipo: Record<string, number> = {};
        (plazasData.plazas || []).forEach(plaza => {
            const segmento = plaza.plantillas?.catv_segmento;
            if (segmento && tipoMap[segmento]) {
                const tipo = tipoMap[segmento];
                plazasPorTipo[tipo] = (plazasPorTipo[tipo] || 0) + 1;
            }
        });

        // Calcular métricas por tipo
        Object.keys(tipoMap).forEach(codigo => {
            const tipo = tipoMap[codigo];
            const ingresos = ingresosPorTipo[tipo] || 0;
            const movimientos = movimientosPorTipo[tipo] || 0;
            const plazas = plazasPorTipo[tipo] || 0;
            const horas = horasPorTipo[tipo] || 0;

            const ocupacion = plazas > 0 ? (movimientos / plazas) * 100 : 0;
            const ticketPromedio = movimientos > 0 ? ingresos / movimientos : 0;
            const rentabilidad = plazas > 0 ? ingresos / plazas : 0;

            result.rentabilidadPorTipo.push({
                tipo,
                ingresos,
                ocupacion: Math.round(ocupacion),
                ticketPromedio,
                rentabilidad,
                plazas
            });

            result.ocupacionPorTipo[tipo] = ocupacion;
            result.ticketPromedioPorTipo[tipo] = ticketPromedio;
        });

        result.ingresosTotales = Object.values(ingresosPorTipo).reduce((sum, val) => sum + val, 0);

        // Ordenar por rentabilidad descendente
        result.rentabilidadPorTipo.sort((a, b) => b.rentabilidad - a.rentabilidad);

        // Insights
        if (result.rentabilidadPorTipo.length > 0) {
            const mejor = result.rentabilidadPorTipo[0];
            const peor = result.rentabilidadPorTipo[result.rentabilidadPorTipo.length - 1];
            
            result.insights.push(`El tipo ${mejor.tipo} genera la mayor rentabilidad por plaza: ${formatCurrency(mejor.rentabilidad)}.`);
            
            if (mejor.tipo !== peor.tipo) {
                result.insights.push(`El tipo ${peor.tipo} presenta menor rentabilidad: ${formatCurrency(peor.rentabilidad)}.`);
            }
            
            const tipoMayorOcupacion = Object.entries(result.ocupacionPorTipo)
                .sort(([,a], [,b]) => b - a)[0];
            if (tipoMayorOcupacion) {
                result.insights.push(`El tipo ${tipoMayorOcupacion[0]} tiene la mayor ocupación: ${Math.round(tipoMayorOcupacion[1])}%.`);
            }
        }

        return result;
    }, [history, tarifas, plazasData, dateRange]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Rentabilidad por Tipo de Plaza"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onPrint={handlePrint}
            />
            

            {/* Contenido imprimible en A4 */}
            <div
                ref={printRef}
                data-print-root
                className="print-a4 mx-auto bg-white shadow-sm print:shadow-none"
            >
            <div className="flex h-full flex-col gap-6 px-6 py-6 print:gap-3 print:px-4 print:py-3">
            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
                {loading ? (
                    <>
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                    </>
                ) : (
                    <>
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">Ingresos Totales</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:py-1">
                                <div className="text-2xl font-semibold print:text-xl">{formatCurrency(ingresosTotales)}</div>
                                <div className="text-xs text-slate-500">del período</div>
                            </CardContent>
                        </Card>
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">Tipo Más Rentable</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:py-1">
                                <div className="text-2xl font-semibold print:text-xl">
                                    {rentabilidadPorTipo.length > 0 ? rentabilidadPorTipo[0].tipo : "-"}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {rentabilidadPorTipo.length > 0 ? formatCurrency(rentabilidadPorTipo[0].rentabilidad) : "0"} por plaza
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">Tipos Analizados</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:py-1">
                                <div className="text-2xl font-semibold print:text-xl">{rentabilidadPorTipo.length}</div>
                                <div className="text-xs text-slate-500">categorías de vehículos</div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Rentabilidad por tipo */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Rentabilidad por Tipo de Plaza</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-40 print:h-28" />
                    ) : (
                        <div className="space-y-3">
                            {rentabilidadPorTipo.length === 0 && (
                                <div className="text-sm text-slate-500">Sin datos de rentabilidad para el período.</div>
                            )}
                            {rentabilidadPorTipo.map((item, idx) => (
                                <div key={item.tipo} className="flex items-center gap-4 p-3 border rounded-lg">
                                    <div className="w-24 text-sm font-medium text-slate-700">{item.tipo}</div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span>Rentabilidad por plaza:</span>
                                            <span className="font-semibold">{formatCurrency(item.rentabilidad)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Ingresos totales:</span>
                                            <span>{formatCurrency(item.ingresos)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Ocupación:</span>
                                            <span>{item.ocupacion}%</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Ticket promedio:</span>
                                            <span>{formatCurrency(item.ticketPromedio)}</span>
                                        </div>
                                    </div>
                                    <div className="w-16 text-right">
                                        <Badge variant={idx === 0 ? "default" : "secondary"} className="text-xs">
                                            {item.plazas} plazas
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Comparativa de ocupación */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Ocupación por Tipo</CardTitle>
                    <p className="text-sm text-slate-500 print:text-xs">
                        Porcentaje de ocupación por tipo de vehículo.
                    </p>
                </CardHeader>
                <CardContent className="pt-0 print:pt-1 print:pb-2">
                    {loading ? (
                        <Skeleton className="h-64 print:h-48" />
                    ) : Object.keys(ocupacionPorTipo).length === 0 ? (
                        <div className="text-sm text-slate-500 print:text-xs">Sin datos de ocupación.</div>
                    ) : (
                        <ChartContainer
                            config={{
                                ocupacion: {
                                    label: "Ocupación (%)",
                                    color: "#10b981",
                                },
                            }}
                            className="h-[280px] w-full"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={Object.entries(ocupacionPorTipo).map(([tipo, ocupacion]) => ({
                                        tipo,
                                        ocupacion: Math.round(ocupacion),
                                    }))}
                                    layout="vertical"
                                    margin={{ top: 5, right: 5, left: 100, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                    <XAxis
                                        type="number"
                                        domain={[0, 100]}
                                        tick={{ fontSize: 11 }}
                                        className="text-slate-600"
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="tipo"
                                        tick={{ fontSize: 11 }}
                                        className="text-slate-600"
                                        width={90}
                                    />
                                    <ChartTooltip
                                        content={
                                            <ChartTooltipContent
                                                formatter={(value) => [
                                                    `${value}%`,
                                                    "Ocupación",
                                                ]}
                                            />
                                        }
                                    />
                                    <Bar
                                        dataKey="ocupacion"
                                        radius={[0, 4, 4, 0]}
                                        fill="#10b981"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* Ticket promedio por tipo */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Ticket Promedio por Tipo</CardTitle>
                    <p className="text-sm text-slate-500 print:text-xs">
                        Monto promedio por transacción por tipo de vehículo.
                    </p>
                </CardHeader>
                <CardContent className="pt-0 print:pt-1 print:pb-2">
                    {loading ? (
                        <Skeleton className="h-64 print:h-48" />
                    ) : Object.keys(ticketPromedioPorTipo).length === 0 ? (
                        <div className="text-sm text-slate-500 print:text-xs">Sin datos de tickets.</div>
                    ) : (
                        <ChartContainer
                            config={{
                                ticket: {
                                    label: "Ticket Promedio",
                                    color: "#3b82f6",
                                },
                            }}
                            className="h-[280px] w-full"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={Object.entries(ticketPromedioPorTipo).map(([tipo, ticket]) => ({
                                        tipo,
                                        ticket: Math.round(ticket * 100) / 100,
                                    }))}
                                    layout="vertical"
                                    margin={{ top: 5, right: 5, left: 100, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                    <XAxis
                                        type="number"
                                        tick={{ fontSize: 11 }}
                                        className="text-slate-600"
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="tipo"
                                        tick={{ fontSize: 11 }}
                                        className="text-slate-600"
                                        width={90}
                                    />
                                    <ChartTooltip
                                        content={
                                            <ChartTooltipContent
                                                formatter={(value) => [
                                                    formatCurrency(value as number),
                                                    "Ticket Promedio",
                                                ]}
                                            />
                                        }
                                    />
                                    <Bar
                                        dataKey="ticket"
                                        radius={[0, 4, 4, 0]}
                                        fill="#3b82f6"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* Insights */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Insights de Rentabilidad</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-20 print:h-16" />
                    ) : insights.length ? (
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            {insights.map((t, i) => (<li key={i}>{t}</li>))}
                        </ul>
                    ) : (
                        <div className="text-sm text-slate-500">No se detectaron insights destacados para el período.</div>
                    )}
                </CardContent>
            </Card>
            </div>
            </div>
        <style jsx global>{`
            @media print {
                @page { size: A4 portrait; margin: 0; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        `}</style>
        </div>
    );
}