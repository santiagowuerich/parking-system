"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type ComparisonPeriod = "mes-anterior" | "trimestre-anterior" | "año-anterior";

interface HistoryEntry {
    entry_time: string | null;
    exit_time: string | null;
    fee?: number | null;
    catv_segmento?: "AUT" | "MOT" | "CAM" | null;
}

function hoursBetween(start: Date, end: Date) {
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    return diffMs / (1000 * 60 * 60);
}

export function ComparativoReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [comparisonPeriod, setComparisonPeriod] = useState<ComparisonPeriod>("mes-anterior");
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
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

            const fileName = `comparativo-${new Date().toISOString().split('T')[0]}.pdf`;
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
                // Historial completo para comparar períodos
                const res = await fetch(`/api/parking/history?est_id=${estId}`);
                const json = await res.json();
                const rows: HistoryEntry[] = Array.isArray(json.history) ? json.history : (json || []);
                
                setHistory(rows);
            } catch (e) {
                console.error("Error cargando datos comparativos:", e);
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [estId, dateRange]);

    // Cálculos comparativos
    const {
        periodoActual,
        periodoAnterior,
        comparativas,
        tendencias,
        insights,
        periodoDates
    } = useMemo(() => {
        const result = {
            periodoActual: {
                ingresos: 0,
                movimientos: 0,
                ticketPromedio: 0,
                ocupacionPromedio: 0,
                duracionPromedio: 0
            },
            periodoAnterior: {
                ingresos: 0,
                movimientos: 0,
                ticketPromedio: 0,
                ocupacionPromedio: 0,
                duracionPromedio: 0
            },
            comparativas: {
                ingresos: { valor: 0, porcentaje: 0 },
                movimientos: { valor: 0, porcentaje: 0 },
                ticketPromedio: { valor: 0, porcentaje: 0 },
                ocupacionPromedio: { valor: 0, porcentaje: 0 },
                duracionPromedio: { valor: 0, porcentaje: 0 }
            },
            tendencias: [] as Array<{ fecha: string; ingresos: number; movimientos: number }>,
            insights: [] as string[],
            periodoDates: {
                actualFrom: "",
                actualTo: "",
                anteriorFrom: "",
                anteriorTo: "",
                label: ""
            }
        };

        if (!history.length) {
            return result;
        }

        // Definir períodos según el tipo de comparación
        const now = new Date();
        const from = dateRange?.from ? new Date(dateRange.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const to = dateRange?.to ? new Date(dateRange.to) : now;

        let anteriorFrom: Date, anteriorTo: Date;
        let periodoLabel = "";
        const duracionActual = to.getTime() - from.getTime();

        if (comparisonPeriod === "mes-anterior") {
            anteriorTo = new Date(from.getTime() - 1);
            anteriorFrom = new Date(anteriorTo.getTime() - duracionActual);
            periodoLabel = "Mes anterior";
        } else if (comparisonPeriod === "trimestre-anterior") {
            anteriorTo = new Date(from.getTime() - 90 * 24 * 60 * 60 * 1000);
            anteriorFrom = new Date(anteriorTo.getTime() - duracionActual);
            periodoLabel = "Trimestre anterior";
        } else { // año-anterior
            anteriorTo = new Date(from.getTime() - 365 * 24 * 60 * 60 * 1000);
            anteriorFrom = new Date(anteriorTo.getTime() - duracionActual);
            periodoLabel = "Año anterior";
        }

        // Formatear fechas para mostrar
        const formatDate = (d: Date) => d.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        result.periodoDates = {
            actualFrom: formatDate(from),
            actualTo: formatDate(to),
            anteriorFrom: formatDate(anteriorFrom),
            anteriorTo: formatDate(anteriorTo),
            label: periodoLabel
        };

        // Filtrar datos por período
        const datosActuales = history.filter(entry => {
            const entryTime = entry.entry_time ? new Date(entry.entry_time) : null;
            const exitTime = entry.exit_time ? new Date(entry.exit_time) : null;
            return (entryTime && entryTime >= from && entryTime <= to) ||
                   (exitTime && exitTime >= from && exitTime <= to) ||
                   (entryTime && exitTime && entryTime < from && exitTime > to);
        });

        const datosAnteriores = history.filter(entry => {
            const entryTime = entry.entry_time ? new Date(entry.entry_time) : null;
            const exitTime = entry.exit_time ? new Date(entry.exit_time) : null;
            return (entryTime && entryTime >= anteriorFrom && entryTime <= anteriorTo) ||
                   (exitTime && exitTime >= anteriorFrom && exitTime <= anteriorTo) ||
                   (entryTime && exitTime && entryTime < anteriorFrom && exitTime > anteriorTo);
        });

        // Calcular métricas período actual
        result.periodoActual.ingresos = datosActuales.reduce((sum, entry) => sum + (entry.fee || 0), 0);
        result.periodoActual.movimientos = datosActuales.length;
        result.periodoActual.ticketPromedio = result.periodoActual.movimientos > 0 ? 
            result.periodoActual.ingresos / result.periodoActual.movimientos : 0;
        
        const duracionTotalActual = datosActuales.reduce((sum, entry) => {
            const entryTime = entry.entry_time ? new Date(entry.entry_time) : null;
            const exitTime = entry.exit_time ? new Date(entry.exit_time) : null;
            if (entryTime && exitTime) {
                return sum + hoursBetween(entryTime, exitTime);
            }
            return sum;
        }, 0);
        result.periodoActual.duracionPromedio = result.periodoActual.movimientos > 0 ? 
            duracionTotalActual / result.periodoActual.movimientos : 0;

        // Calcular métricas período anterior
        result.periodoAnterior.ingresos = datosAnteriores.reduce((sum, entry) => sum + (entry.fee || 0), 0);
        result.periodoAnterior.movimientos = datosAnteriores.length;
        result.periodoAnterior.ticketPromedio = result.periodoAnterior.movimientos > 0 ? 
            result.periodoAnterior.ingresos / result.periodoAnterior.movimientos : 0;
        
        const duracionTotalAnterior = datosAnteriores.reduce((sum, entry) => {
            const entryTime = entry.entry_time ? new Date(entry.entry_time) : null;
            const exitTime = entry.exit_time ? new Date(entry.exit_time) : null;
            if (entryTime && exitTime) {
                return sum + hoursBetween(entryTime, exitTime);
            }
            return sum;
        }, 0);
        result.periodoAnterior.duracionPromedio = result.periodoAnterior.movimientos > 0 ? 
            duracionTotalAnterior / result.periodoAnterior.movimientos : 0;

        // Calcular comparativas
        const calcularComparativa = (actual: number, anterior: number) => {
            const valor = actual - anterior;
            const porcentaje = anterior !== 0 ? (valor / anterior) * 100 : 0;
            return { valor, porcentaje };
        };

        result.comparativas.ingresos = calcularComparativa(result.periodoActual.ingresos, result.periodoAnterior.ingresos);
        result.comparativas.movimientos = calcularComparativa(result.periodoActual.movimientos, result.periodoAnterior.movimientos);
        result.comparativas.ticketPromedio = calcularComparativa(result.periodoActual.ticketPromedio, result.periodoAnterior.ticketPromedio);
        result.comparativas.duracionPromedio = calcularComparativa(result.periodoActual.duracionPromedio, result.periodoAnterior.duracionPromedio);

        // Generar tendencias diarias
        const tendenciasMap: Record<string, { ingresos: number; movimientos: number }> = {};
        
        [...datosActuales, ...datosAnteriores].forEach(entry => {
            const fecha = entry.entry_time ? new Date(entry.entry_time).toISOString().split('T')[0] : 
                         entry.exit_time ? new Date(entry.exit_time).toISOString().split('T')[0] : null;
            if (fecha) {
                if (!tendenciasMap[fecha]) {
                    tendenciasMap[fecha] = { ingresos: 0, movimientos: 0 };
                }
                tendenciasMap[fecha].ingresos += entry.fee || 0;
                tendenciasMap[fecha].movimientos += 1;
            }
        });

        result.tendencias = Object.entries(tendenciasMap)
            .map(([fecha, datos]) => ({ fecha, ...datos }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));

        // Insights
        if (result.comparativas.ingresos.porcentaje > 0) {
            result.insights.push(`Los ingresos aumentaron ${Math.round(result.comparativas.ingresos.porcentaje)}% respecto al período anterior.`);
        } else if (result.comparativas.ingresos.porcentaje < 0) {
            result.insights.push(`Los ingresos disminuyeron ${Math.round(Math.abs(result.comparativas.ingresos.porcentaje))}% respecto al período anterior.`);
        }

        if (result.comparativas.movimientos.porcentaje > 0) {
            result.insights.push(`El flujo de vehículos aumentó ${Math.round(result.comparativas.movimientos.porcentaje)}% respecto al período anterior.`);
        } else if (result.comparativas.movimientos.porcentaje < 0) {
            result.insights.push(`El flujo de vehículos disminuyó ${Math.round(Math.abs(result.comparativas.movimientos.porcentaje))}% respecto al período anterior.`);
        }

        if (result.comparativas.ticketPromedio.porcentaje > 0) {
            result.insights.push(`El ticket promedio aumentó ${Math.round(result.comparativas.ticketPromedio.porcentaje)}% respecto al período anterior.`);
        } else if (result.comparativas.ticketPromedio.porcentaje < 0) {
            result.insights.push(`El ticket promedio disminuyó ${Math.round(Math.abs(result.comparativas.ticketPromedio.porcentaje))}% respecto al período anterior.`);
        }

        return result;
    }, [history, comparisonPeriod, dateRange]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Comparativo de Períodos"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onPrint={handlePrint}
            />
            
            <div className="flex items-center gap-2 print:hidden">
                <span className="text-sm text-slate-600">Comparar con:</span>
                <Select value={comparisonPeriod} onValueChange={(v: ComparisonPeriod) => setComparisonPeriod(v)}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Seleccionar período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="mes-anterior">Mes anterior</SelectItem>
                        <SelectItem value="trimestre-anterior">Trimestre anterior</SelectItem>
                        <SelectItem value="año-anterior">Año anterior</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Contenido imprimible en A4 */}
            <div
                ref={printRef}
                data-print-root
                className="print-a4 mx-auto bg-white shadow-sm print:shadow-none"
            >
            <div className="flex h-full flex-col gap-6 px-6 py-6 print:gap-3 print:px-4 print:py-3">
            {/* Aclaración de comparación */}
            <Card className="print:shadow-none bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                    <p className="text-sm text-slate-700">
                        <span className="font-semibold">Comparación: </span>
                        {periodoDates.label} ({periodoDates.anteriorFrom} al {periodoDates.anteriorTo})
                        <br />vs Período actual ({periodoDates.actualFrom} al {periodoDates.actualTo})
                    </p>
                </CardContent>
            </Card>

            {/* KPIs Comparativos */}
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
                                <CardTitle className="text-sm font-medium text-slate-600">Ingresos Actuales</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:py-1">
                                <div className="text-2xl font-semibold print:text-xl">{formatCurrency(periodoActual.ingresos)}</div>
                                <div className="text-xs text-slate-500">
                                    {comparativas.ingresos.porcentaje > 0 ? "+" : ""}{Math.round(comparativas.ingresos.porcentaje)}% vs {periodoDates.label}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">Movimientos Actuales</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:py-1">
                                <div className="text-2xl font-semibold print:text-xl">{periodoActual.movimientos}</div>
                                <div className="text-xs text-slate-500">
                                    {comparativas.movimientos.porcentaje > 0 ? "+" : ""}{Math.round(comparativas.movimientos.porcentaje)}% vs {periodoDates.label}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">Ticket Promedio</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:py-1">
                                <div className="text-2xl font-semibold print:text-xl">{formatCurrency(periodoActual.ticketPromedio)}</div>
                                <div className="text-xs text-slate-500">
                                    {comparativas.ticketPromedio.porcentaje > 0 ? "+" : ""}{Math.round(comparativas.ticketPromedio.porcentaje)}% vs {periodoDates.label}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Comparativa detallada */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Comparativa Detallada</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-40 print:h-28" />
                    ) : (
                        <div className="space-y-3">
                            {[
                                { label: "Ingresos", actual: periodoActual.ingresos, anterior: periodoAnterior.ingresos, comparativa: comparativas.ingresos, formato: "currency" },
                                { label: "Movimientos", actual: periodoActual.movimientos, anterior: periodoAnterior.movimientos, comparativa: comparativas.movimientos, formato: "number" },
                                { label: "Ticket Promedio", actual: periodoActual.ticketPromedio, anterior: periodoAnterior.ticketPromedio, comparativa: comparativas.ticketPromedio, formato: "currency" },
                                { label: "Duración Promedio", actual: periodoActual.duracionPromedio, anterior: periodoAnterior.duracionPromedio, comparativa: comparativas.duracionPromedio, formato: "hours" }
                            ].map((item) => (
                                <div key={item.label} className="flex items-center gap-4 p-3 border rounded-lg">
                                    <div className="w-32 text-sm font-medium text-slate-700">{item.label}</div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span>Período actual:</span>
                                            <span className="font-semibold">
                                                {item.formato === "currency" ? formatCurrency(item.actual) :
                                                 item.formato === "hours" ? `${Math.round(item.actual)}h` :
                                                 item.actual}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>{periodoDates.label}:</span>
                                            <span>
                                                {item.formato === "currency" ? formatCurrency(item.anterior) :
                                                 item.formato === "hours" ? `${Math.round(item.anterior)}h` :
                                                 item.anterior}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Variación:</span>
                                            <span className={`font-semibold ${item.comparativa.porcentaje >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {item.comparativa.porcentaje > 0 ? "+" : ""}{Math.round(item.comparativa.porcentaje)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tendencia temporal */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Tendencia de Ingresos Diarios</CardTitle>
                    <p className="text-sm text-slate-500 print:text-xs">
                        Comparativa de ingresos diarios entre ambos períodos
                    </p>
                </CardHeader>
                <CardContent className="pt-0 print:pt-1 print:pb-2">
                    {loading ? (
                        <Skeleton className="h-64 print:h-48" />
                    ) : tendencias.length === 0 ? (
                        <div className="text-sm text-slate-500 print:text-xs">Sin datos de tendencia.</div>
                    ) : (
                        <ChartContainer
                            config={{
                                ingresos: {
                                    label: "Ingresos",
                                    color: "#3b82f6",
                                },
                            }}
                            className="h-[280px] w-full"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={tendencias}
                                    margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                    <XAxis
                                        dataKey="fecha"
                                        tick={{ fontSize: 11 }}
                                        className="text-slate-600"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11 }}
                                        className="text-slate-600"
                                    />
                                    <ChartTooltip
                                        content={
                                            <ChartTooltipContent
                                                formatter={(value) => formatCurrency(value as number)}
                                            />
                                        }
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="ingresos"
                                        stroke="#3b82f6"
                                        dot={false}
                                        isAnimationActive={false}
                                        strokeWidth={2}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* Insights */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Análisis Comparativo</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-20 print:h-16" />
                    ) : insights.length ? (
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            {insights.map((t, i) => (<li key={i}>{t}</li>))}
                        </ul>
                    ) : (
                        <div className="text-sm text-slate-500">No se detectaron cambios significativos para el período.</div>
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