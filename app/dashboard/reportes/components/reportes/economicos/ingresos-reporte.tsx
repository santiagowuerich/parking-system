"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { useReactToPrint } from "react-to-print";
import { formatCurrency } from "@/lib/utils";

type HistoryEntry = {
    entry_time: string | null;
    exit_time: string | null;
    fee?: number | null;
    pag_tipo?: string | null;
    mepa_metodo?: string | null;
};

interface PagoExtendido {
    amount: number;
    category: string;
    date: Date;
}

interface SummaryMetrics {
    totalIncome: number;
    dailyAverage: number;
    ticketAverage: number;
    operations: number;
}

interface BreakdownItem {
    label: string;
    amount: number;
    count: number;
}

interface TrendPoint {
    label: string;
    value: number;
}

function clamp01(value: number) {
    if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function diffDescriptor(current: number, previous: number) {
    if (!Number.isFinite(previous) || previous === 0) {
        if (!Number.isFinite(current) || current === 0) {
            return { label: "sin cambios", tone: "neutral" as const };
        }
        return { label: "+100%", tone: "positive" as const };
    }
    const delta = current - previous;
    const percent = (delta / previous) * 100;
    if (Math.abs(percent) < 0.5) {
        return { label: "estable", tone: "neutral" as const };
    }
    const rounded = percent > 99 ? Math.round(percent) : Math.round(percent * 10) / 10;
    const sign = percent > 0 ? "+" : "";
    return {
        label: `${sign}${rounded}%`,
        tone: percent > 0 ? ("positive" as const) : ("negative" as const)
    };
}

function normalizeHistory(history: HistoryEntry[]) {
    return history
        .map((item) => {
            const rawDate = item.exit_time || item.entry_time;
            if (!rawDate) return null;
            const parsed = new Date(rawDate);
            if (Number.isNaN(parsed.getTime())) return null;
            const category = (item.pag_tipo || item.mepa_metodo || "Tickets").toString().toLowerCase();
            const amount = item.fee ? Number(item.fee) : 0;
            return {
                amount,
                category,
                date: parsed
            } as PagoExtendido;
        })
        .filter((item): item is PagoExtendido => !!item);
}

function filterByRange(pagos: PagoExtendido[], from: Date, to: Date) {
    const start = from.getTime();
    const end = to.getTime();
    return pagos.filter((pago) => {
        const t = pago.date.getTime();
        return t >= start && t <= end;
    });
}

function sumAmounts(list: PagoExtendido[]) {
    return list.reduce((total, pago) => total + (pago.amount || 0), 0);
}

function averagePerDay(total: number, from: Date, to: Date) {
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / dayMs) + 1);
    return total / days;
}

function averagePerOperation(total: number, operations: number) {
    if (operations <= 0) return 0;
    return total / operations;
}

function buildSummary(pagos: PagoExtendido[], from: Date, to: Date): SummaryMetrics {
    const totalIncome = sumAmounts(pagos);
    const operations = pagos.length;
    const dailyAverage = averagePerDay(totalIncome, from, to);
    const ticketAverage = averagePerOperation(totalIncome, operations);
    return {
        totalIncome,
        dailyAverage,
        ticketAverage,
        operations
    };
}

function buildTrend(pagos: PagoExtendido[]) {
    const map = new Map<string, number>();
    pagos.forEach((pago) => {
        const key = pago.date.toISOString().slice(0, 10);
        map.set(key, (map.get(key) ?? 0) + pago.amount);
    });
    return Array.from(map.entries())
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .map(([label, value]) => ({ label, value } as TrendPoint));
}

function buildBreakdown(pagos: PagoExtendido[]) {
    const map = new Map<string, BreakdownItem>();
    pagos.forEach((pago) => {
        const key = pago.category || "tickets";
        const entry = map.get(key) || { label: key, amount: 0, count: 0 };
        entry.amount += pago.amount;
        entry.count += 1;
        map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

function deriveInsights(
    currentSummary: SummaryMetrics,
    previousSummary: SummaryMetrics,
    breakdown: BreakdownItem[],
    trend: TrendPoint[]
) {
    const insights: string[] = [];
    const variance = diffDescriptor(currentSummary.totalIncome, previousSummary.totalIncome);
    insights.push(`Ingresos totales: ${formatCurrency(currentSummary.totalIncome)} (${variance.label} vs periodo anterior).`);

    if (breakdown.length) {
        const top = breakdown[0];
        const share = currentSummary.totalIncome > 0 ? Math.round((top.amount / currentSummary.totalIncome) * 100) : 0;
        insights.push(`La categoria ${capitalize(top.label)} explica ${share}% de los ingresos.`);
    }

    if (trend.length >= 2) {
        const first = trend[0];
        const last = trend[trend.length - 1];
        const trendDelta = diffDescriptor(last.value, first.value);
        insights.push(`La tendencia diaria muestra ${trendDelta.label} entre el inicio y el fin del periodo.`);
    }

    insights.push(`Ticket promedio: ${formatCurrency(currentSummary.ticketAverage)} por operacion.`);

    return insights;
}

function capitalize(text: string) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function valueSizeClasses(text: string) {
    const length = text.replace(/\s/g, "").length;
    if (length > 18) return "text-lg print:text-sm";
    if (length > 14) return "text-xl print:text-base";
    if (length > 10) return "text-2xl print:text-lg";
    return "text-2xl print:text-lg";
}

export function IngresosReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [history, setHistory] = useState<PagoExtendido[]>([]);
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef<HTMLDivElement>(null);
    const [contentScale, setContentScale] = useState(1);
    const lastScaleRef = useRef(1);

    const handlePrint = useReactToPrint({
        documentTitle: "Reporte - Ingresos por Periodos",
        content: () => printRef.current
    });

    useEffect(() => {
        const updateScale = () => {
            if (!printRef.current || !scaleRef.current) return;
            const container = printRef.current;
            const inner = scaleRef.current;
            const availWidth = container.clientWidth;
            const availHeight = container.clientHeight;
            const naturalWidth = inner.scrollWidth;
            const naturalHeight = inner.scrollHeight;
            if (!availWidth || !availHeight || !naturalWidth || !naturalHeight) {
                if (lastScaleRef.current !== 1) {
                    lastScaleRef.current = 1;
                    setContentScale(1);
                }
                return;
            }
            const next = Math.min(1, availWidth / naturalWidth, availHeight / naturalHeight);
            if (Math.abs(next - lastScaleRef.current) > 0.005) {
                lastScaleRef.current = next;
                setContentScale(next);
            }
        };
        updateScale();
        window.addEventListener("resize", updateScale);
        return () => window.removeEventListener("resize", updateScale);
    }, [history, dateRange]);

    useEffect(() => {
        if (!estId) return;
        const load = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/parking/history?est_id=${estId}`);
                const data = await response.json();
                const rows: HistoryEntry[] = Array.isArray(data.history) ? data.history : (data || []);
                setHistory(normalizeHistory(rows));
            } catch (error) {
                console.error("Error cargando historial de ingresos:", error);
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [estId]);

    const rangeInfo = useMemo(() => {
        const from = dateRange?.from ? new Date(dateRange.from) : (() => {
            const d = new Date();
            d.setDate(d.getDate() - 29);
            d.setHours(0, 0, 0, 0);
            return d;
        })();
        const to = dateRange?.to ? new Date(dateRange.to) : (() => {
            const d = new Date();
            d.setHours(23, 59, 59, 999);
            return d;
        })();
        const dayMs = 24 * 60 * 60 * 1000;
        const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / dayMs) + 1);
        const prevTo = new Date(from.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - (periodDays - 1) * dayMs);
        return { from, to, prevFrom, prevTo };
    }, [dateRange]);

    const currentPagos = useMemo(() => filterByRange(history, rangeInfo.from, rangeInfo.to), [history, rangeInfo.from, rangeInfo.to]);
    const previousPagos = useMemo(() => filterByRange(history, rangeInfo.prevFrom, rangeInfo.prevTo), [history, rangeInfo.prevFrom, rangeInfo.prevTo]);

    const currentSummary = useMemo(() => buildSummary(currentPagos, rangeInfo.from, rangeInfo.to), [currentPagos, rangeInfo]);
    const previousSummary = useMemo(() => buildSummary(previousPagos, rangeInfo.prevFrom, rangeInfo.prevTo), [previousPagos, rangeInfo]);

    const trendCurrent = useMemo(() => buildTrend(currentPagos), [currentPagos]);
    const trendPrevious = useMemo(() => buildTrend(previousPagos), [previousPagos]);
    const maxTrendCurrent = useMemo(() => Math.max(1, ...trendCurrent.map((item) => item.value)), [trendCurrent]);
    const maxTrendPrevious = useMemo(() => Math.max(1, ...trendPrevious.map((item) => item.value)), [trendPrevious]);
    const breakdown = useMemo(() => buildBreakdown(currentPagos), [currentPagos]);
    const insights = useMemo(() => deriveInsights(currentSummary, previousSummary, breakdown, trendCurrent), [currentSummary, previousSummary, breakdown, trendCurrent]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Ingresos por Periodos"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                showPrintButton
                onPrint={handlePrint}
            />

            <div
                ref={printRef}
                data-print-root
                className="print-a4 mx-auto bg-white shadow-sm print:shadow-none"
            >
                <div
                    ref={scaleRef}
                    className="print-a4-inner flex h-full flex-col gap-6 px-6 py-6 print:gap-3 print:px-4 print:py-3"
                    style={{ transform: `scale(${contentScale})`, transformOrigin: "top center" }}
                >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, idx) => (
                                <Skeleton key={idx} className="h-24 print:h-20" />
                            ))
                        ) : (
                            <>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Total facturado</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = formatCurrency(currentSummary.totalIncome);
                                            return (
                                                <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>
                                                    {text}
                                                </div>
                                            );
                                        })()}
                                        <div className={`text-xs ${diffDescriptor(currentSummary.totalIncome, previousSummary.totalIncome).tone === "positive" ? "text-emerald-600" : diffDescriptor(currentSummary.totalIncome, previousSummary.totalIncome).tone === "negative" ? "text-red-600" : "text-slate-500"}`}>
                                            {diffDescriptor(currentSummary.totalIncome, previousSummary.totalIncome).label}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Promedio diario</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = formatCurrency(currentSummary.dailyAverage);
                                            return (
                                                <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>
                                                    {text}
                                                </div>
                                            );
                                        })()}
                                        <div className={`text-xs ${diffDescriptor(currentSummary.dailyAverage, previousSummary.dailyAverage).tone === "positive" ? "text-emerald-600" : diffDescriptor(currentSummary.dailyAverage, previousSummary.dailyAverage).tone === "negative" ? "text-red-600" : "text-slate-500"}`}>
                                            {diffDescriptor(currentSummary.dailyAverage, previousSummary.dailyAverage).label}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Ticket promedio</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = formatCurrency(currentSummary.ticketAverage);
                                            return (
                                                <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>
                                                    {text}
                                                </div>
                                            );
                                        })()}
                                        <div className={`text-xs ${diffDescriptor(currentSummary.ticketAverage, previousSummary.ticketAverage).tone === "positive" ? "text-emerald-600" : diffDescriptor(currentSummary.ticketAverage, previousSummary.ticketAverage).tone === "negative" ? "text-red-600" : "text-slate-500"}`}>
                                            {diffDescriptor(currentSummary.ticketAverage, previousSummary.ticketAverage).label}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Operaciones registradas</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = currentSummary.operations.toLocaleString();
                                            return (
                                                <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>
                                                    {text}
                                                </div>
                                            );
                                        })()}
                                        <div className={`text-xs ${diffDescriptor(currentSummary.operations, previousSummary.operations).tone === "positive" ? "text-emerald-600" : diffDescriptor(currentSummary.operations, previousSummary.operations).tone === "negative" ? "text-red-600" : "text-slate-500"}`}>
                                            {diffDescriptor(currentSummary.operations, previousSummary.operations).label}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Evolucion de ingresos</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Muestra la variacion diaria del periodo actual y la referencia previa.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-48 print:h-32" />
                            ) : trendCurrent.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay registros en el periodo seleccionado.
                                </div>
                            ) : (
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <h4 className="mb-2 text-xs font-medium text-slate-500">Periodo actual</h4>
                                        <div className="flex h-48 items-end gap-1 print:h-32">
                                            {trendCurrent.map((point) => (
                                                <div key={point.label} className="flex flex-col items-center gap-1">
                                                    <div
                                                        className="w-6 rounded bg-indigo-500"
                                                        style={{ height: `${Math.min(100, Math.max(4, (point.value / maxTrendCurrent) * 100))}%` }}
                                                        title={`${point.label}: ${formatCurrency(point.value)}`}
                                                    />
                                                    <span className="text-[10px] text-slate-500">{point.label.slice(5)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="mb-2 text-xs font-medium text-slate-500">Periodo anterior</h4>
                                        <div className="flex h-48 items-end gap-1 print:h-32">
                                            {trendPrevious.map((point) => (
                                                <div key={point.label} className="flex flex-col items-center gap-1">
                                                    <div
                                                        className="w-6 rounded bg-slate-300"
                                                        style={{ height: `${Math.min(100, Math.max(4, (point.value / maxTrendPrevious) * 100))}%` }}
                                                        title={`${point.label}: ${formatCurrency(point.value)}`}
                                                    />
                                                    <span className="text-[10px] text-slate-500">{point.label.slice(5)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Distribucion por tipo de ingreso</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-48 print:h-32" />
                            ) : breakdown.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay informacion de pagos en el periodo.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {breakdown.map((item) => (
                                        <div key={item.label} className="flex items-center gap-3">
                                            <div className="w-32 text-sm text-slate-600 print:w-28">{capitalize(item.label)}</div>
                                            <div className="flex-1 h-3 rounded bg-slate-200">
                                                <div className="h-3 rounded bg-emerald-500" style={{ width: `${clamp01(item.amount / Math.max(currentSummary.totalIncome, 1)) * 100}%` }} />
                                            </div>
                                            <div className="w-24 text-right text-sm print:w-20">{formatCurrency(item.amount)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Insights automaticos</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-24 print:h-16" />
                            ) : insights.length ? (
                                <ul className="list-disc space-y-1 pl-5 text-sm print:space-y-1 print:text-xs">
                                    {insights.map((text, idx) => (
                                        <li key={idx}>{text}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No se generaron insights para el periodo indicado.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
