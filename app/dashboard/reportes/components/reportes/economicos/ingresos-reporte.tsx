"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Pie, PieChart, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { formatCurrency } from "@/lib/utils";

type HistoryEntry = {
    entry_time: string | null;
    exit_time: string | null;
    fee?: number | null;
    pag_tipo?: string | null;
    mepa_metodo?: string | null;
    abo_nro?: number | null;
};

interface PagoExtendido {
    amount: number;
    category: string;
    date: Date;
    paymentMethod?: string | null;
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

            // Categorize by income type based on pag_tipo
            let category = "Rotación";
            if (item.pag_tipo === 'abono_inicial') {
                category = "Abonos";
            } else if (item.pag_tipo === 'reserva') {
                category = "Reservas";
            }

            const amount = item.fee ? Number(item.fee) : 0;
            return {
                amount,
                category,
                date: parsed,
                paymentMethod: item.mepa_metodo || null
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

function buildCategoryTotals(pagos: PagoExtendido[]) {
    const categories = { "Rotación": 0, "Abonos": 0, "Reservas": 0 };
    pagos.forEach((pago) => {
        const cat = pago.category as keyof typeof categories;
        if (cat in categories) {
            categories[cat] += pago.amount;
        }
    });
    return [
        { name: "Rotación", amount: categories["Rotación"] },
        { name: "Abonos", amount: categories["Abonos"] },
        { name: "Reservas", amount: categories["Reservas"] }
    ];
}

function buildPaymentMethodTotals(pagos: PagoExtendido[]) {
    const methods = new Map<string, number>();
    pagos.forEach((pago) => {
        if (pago.paymentMethod) {
            const method = pago.paymentMethod;
            methods.set(method, (methods.get(method) ?? 0) + pago.amount);
        }
    });
    return Array.from(methods.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
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

            const fileName = `ingresos-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('Error al generar PDF:', error);
            alert('Error al generar el PDF. Por favor intenta nuevamente.');
        }
    };

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
                const response = await fetch(`/api/pagos?est_id=${estId}`);
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
        const from = dateRange?.from ? (() => {
            const d = new Date(dateRange.from);
            d.setHours(0, 0, 0, 0);
            return d;
        })() : (() => {
            const d = new Date();
            d.setDate(d.getDate() - 29);
            d.setHours(0, 0, 0, 0);
            return d;
        })();
        const to = dateRange?.to ? (() => {
            const d = new Date(dateRange.to);
            d.setHours(23, 59, 59, 999);
            return d;
        })() : (() => {
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
    const categoryTotals = useMemo(() => buildCategoryTotals(currentPagos), [currentPagos]);
    const paymentMethodTotals = useMemo(() => buildPaymentMethodTotals(currentPagos), [currentPagos]);
    const insights = useMemo(() => deriveInsights(currentSummary, previousSummary, breakdown, trendCurrent), [currentSummary, previousSummary, breakdown, trendCurrent]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Ingresos por Periodos"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 print:grid-cols-2 print:gap-2">
                        {loading ? (
                            Array.from({ length: 2 }).map((_, idx) => (
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
                                                <div className={`font-bold leading-tight ${valueSizeClasses(text)}`}>
                                                    {text}
                                                </div>
                                            );
                                        })()}
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
                                                <div className={`font-bold leading-tight ${valueSizeClasses(text)}`}>
                                                    {text}
                                                </div>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Ingresos por categoría</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Total de ingresos dividido por tipo de ingreso.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : categoryTotals.every(c => c.amount === 0) ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay registros en el periodo seleccionado.
                                </div>
                            ) : (
                                <ChartContainer
                                    config={{
                                        amount: {
                                            label: "Ingresos",
                                            color: "#3b82f6",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={categoryTotals}
                                            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 10 }}
                                                className="text-slate-600"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11 }}
                                                className="text-slate-600"
                                                label={{ value: "Ingresos ($)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value) => [
                                                            formatCurrency(value as number),
                                                            "Ingresos",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="amount"
                                                radius={[4, 4, 0, 0]}
                                                fill="#3b82f6"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Distribucion por tipo de ingreso</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Porcentaje de ingresos por categoría.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : categoryTotals.every(c => c.amount === 0) ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay registros en el periodo seleccionado.
                                </div>
                            ) : (
                                <ChartContainer
                                    config={{
                                        amount: {
                                            label: "Ingresos",
                                            color: "#3b82f6",
                                        },
                                    }}
                                    className="h-[300px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryTotals}
                                                dataKey="amount"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                label={(entry) => {
                                                    const total = categoryTotals.reduce((sum, item) => sum + item.amount, 0);
                                                    const percent = total > 0 ? Math.round((entry.amount / total) * 100) : 0;
                                                    return `${entry.name} ${percent}%`;
                                                }}
                                            >
                                                <Cell fill="#3b82f6" />
                                                <Cell fill="#10b981" />
                                                <Cell fill="#f59e0b" />
                                            </Pie>
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value) => [
                                                            formatCurrency(value as number),
                                                            "Ingresos",
                                                        ]}
                                                    />
                                                }
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Distribucion por metodo de pago</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Porcentaje de ingresos por método de pago.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : paymentMethodTotals.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay datos de métodos de pago en el periodo seleccionado.
                                </div>
                            ) : (
                                <ChartContainer
                                    config={{
                                        amount: {
                                            label: "Ingresos",
                                            color: "#3b82f6",
                                        },
                                    }}
                                    className="h-[300px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={paymentMethodTotals}
                                                dataKey="amount"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                label={(entry) => {
                                                    const total = paymentMethodTotals.reduce((sum, item) => sum + item.amount, 0);
                                                    const percent = total > 0 ? Math.round((entry.amount / total) * 100) : 0;
                                                    return `${entry.name} ${percent}%`;
                                                }}
                                            >
                                                <Cell fill="#3b82f6" />
                                                <Cell fill="#10b981" />
                                                <Cell fill="#f59e0b" />
                                                <Cell fill="#8b5cf6" />
                                            </Pie>
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value) => [
                                                            formatCurrency(value as number),
                                                            "Ingresos",
                                                        ]}
                                                    />
                                                }
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Resumen del reporte</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-24 print:h-16" />
                            ) : currentSummary.totalIncome > 0 ? (
                                <ul className="space-y-2 text-sm print:space-y-1 print:text-xs">
                                    <li className="flex gap-2">
                                        <span className="text-blue-500 font-bold print:text-blue-600">•</span>
                                        <span>Total de ingresos en el período: <strong>{formatCurrency(currentSummary.totalIncome)}</strong></span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-blue-500 font-bold print:text-blue-600">•</span>
                                        <span>Operaciones registradas: <strong>{currentSummary.operations.toLocaleString()}</strong></span>
                                    </li>
                                    {categoryTotals.some(c => c.amount > 0) && (
                                        <li className="flex gap-2">
                                            <span className="text-blue-500 font-bold print:text-blue-600">•</span>
                                            <span>Categoría principal: <strong>{categoryTotals.find(c => c.amount === Math.max(...categoryTotals.map(x => x.amount)))?.name}</strong></span>
                                        </li>
                                    )}
                                    {paymentMethodTotals.length > 0 && (
                                        <li className="flex gap-2">
                                            <span className="text-blue-500 font-bold print:text-blue-600">•</span>
                                            <span>Método de pago principal: <strong>{paymentMethodTotals[0]?.name}</strong></span>
                                        </li>
                                    )}
                                </ul>
                            ) : (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay datos disponibles para el período seleccionado.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
