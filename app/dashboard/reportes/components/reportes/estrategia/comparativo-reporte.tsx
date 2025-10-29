"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { useReactToPrint } from "react-to-print";
import { formatCurrency } from "@/lib/utils";

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
    const scaleRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: "Reporte - Comparativo de Períodos" });

    // Ajustar el contenido para caber en A4 (vertical)
    useEffect(() => {
        const resize = () => {
            if (!printRef.current || !scaleRef.current) return;
            const A4_WIDTH_PX = 794;  // ~210mm @96dpi
            const A4_HEIGHT_PX = 1123; // ~297mm @96dpi
            const paddingPx = 32; // total padding interno
            const availW = A4_WIDTH_PX - paddingPx;
            const availH = A4_HEIGHT_PX - paddingPx;
            const inner = scaleRef.current;
            // Reset scale to measure natural size
            inner.style.transform = "scale(1)";
            const rect = inner.getBoundingClientRect();
            const nextScale = Math.min(1, Math.min(availW / Math.max(1, rect.width), availH / Math.max(1, rect.height)));
            setScale(nextScale);
            inner.style.transform = `scale(${nextScale})`;
            inner.style.transformOrigin = "top left";
        };
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, [history, comparisonPeriod, dateRange]);

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
        insights
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
            insights: [] as string[]
        };

        if (!history.length) {
            return result;
        }

        // Definir períodos según el tipo de comparación
        const now = new Date();
        const from = dateRange?.from ? new Date(dateRange.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const to = dateRange?.to ? new Date(dateRange.to) : now;
        
        let anteriorFrom: Date, anteriorTo: Date;
        const duracionActual = to.getTime() - from.getTime();
        
        if (comparisonPeriod === "mes-anterior") {
            anteriorTo = new Date(from.getTime() - 1);
            anteriorFrom = new Date(anteriorTo.getTime() - duracionActual);
        } else if (comparisonPeriod === "trimestre-anterior") {
            anteriorTo = new Date(from.getTime() - 90 * 24 * 60 * 60 * 1000);
            anteriorFrom = new Date(anteriorTo.getTime() - duracionActual);
        } else { // año-anterior
            anteriorTo = new Date(from.getTime() - 365 * 24 * 60 * 60 * 1000);
            anteriorFrom = new Date(anteriorTo.getTime() - duracionActual);
        }

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

    const getPeriodLabel = () => {
        switch (comparisonPeriod) {
            case "mes-anterior": return "Mes anterior";
            case "trimestre-anterior": return "Trimestre anterior";
            case "año-anterior": return "Año anterior";
            default: return "Período anterior";
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Comparativo de Períodos"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                showPrintButton
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
                className="bg-white shadow-sm mx-auto print:shadow-none"
                style={{ width: "210mm", height: "297mm", padding: 16, overflow: "hidden" }}
            >
            <div ref={scaleRef} className="space-y-6 print:space-y-4">
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
                                    {comparativas.ingresos.porcentaje > 0 ? "+" : ""}{Math.round(comparativas.ingresos.porcentaje)}% vs {getPeriodLabel()}
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
                                    {comparativas.movimientos.porcentaje > 0 ? "+" : ""}{Math.round(comparativas.movimientos.porcentaje)}% vs {getPeriodLabel()}
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
                                    {comparativas.ticketPromedio.porcentaje > 0 ? "+" : ""}{Math.round(comparativas.ticketPromedio.porcentaje)}% vs {getPeriodLabel()}
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
                                            <span>{getPeriodLabel()}:</span>
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
                    <CardTitle className="text-base print:text-sm">Tendencia Temporal</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-40 print:h-28" />
                    ) : (
                        <div className="space-y-2">
                            <div className="text-xs text-slate-500 mb-2">Ingresos diarios</div>
                            <div className="flex items-end gap-1 h-32 print:h-24">
                                {tendencias.map((t, idx) => {
                                    const maxIngresos = Math.max(...tendencias.map(t => t.ingresos));
                                    const height = maxIngresos > 0 ? (t.ingresos / maxIngresos) * 100 : 0;
                                    return (
                                        <div 
                                            key={idx} 
                                            className="w-2 print:w-1.5 bg-blue-500" 
                                            style={{ height: `${height}%` }} 
                                            title={`${t.fecha}: ${formatCurrency(t.ingresos)}`} 
                                        />
                                    );
                                })}
                            </div>
                        </div>
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