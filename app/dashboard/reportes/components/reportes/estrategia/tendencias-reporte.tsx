
"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ReporteHeader } from "../../reporte-header";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { formatCurrency } from "@/lib/utils";

interface HistoryEntry {
    entry_time: string | null;
    exit_time: string | null;
    fee?: number | null;
}

interface NormalizedSample {
    entry: Date;
    exit?: Date | null;
    fee: number;
    stayHours: number;
}

interface PeriodPoint {
    label: string;
    start: Date;
    end: Date;
    vehicles: number;
    revenue: number;
    avgStay: number;
}

interface ForecastPoint {
    label: string;
    value: number;
}

interface ForecastBundle {
    base: ForecastPoint[];
    optimistic: ForecastPoint[];
    conservative: ForecastPoint[];
}

interface Descriptor {
    label: string;
    tone: "positive" | "negative" | "neutral";
}

function startOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function endOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
}

function addDays(date: Date, amount: number) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
}

function diffDescriptor(current: number, previous: number): Descriptor {
    if (!Number.isFinite(previous) || previous === 0) {
        if (!Number.isFinite(current) || current === 0) {
            return { label: "sin cambios", tone: "neutral" };
        }
        return { label: "+100%", tone: "positive" };
    }
    const delta = current - previous;
    const percent = (delta / previous) * 100;
    if (Math.abs(percent) < 0.5) {
        return { label: "estable", tone: "neutral" };
    }
    const rounded = percent > 99 ? Math.round(percent) : Math.round(percent * 10) / 10;
    const sign = percent > 0 ? "+" : "";
    return {
        label: `${sign}${rounded}%`,
        tone: percent > 0 ? "positive" : "negative"
    };
}

function formatHours(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "0h";
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    if (!minutes) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function formatPeriodLabel(start: Date, end: Date) {
    const sm = (start.getMonth() + 1).toString().padStart(2, "0");
    const sd = start.getDate().toString().padStart(2, "0");
    const em = (end.getMonth() + 1).toString().padStart(2, "0");
    const ed = end.getDate().toString().padStart(2, "0");
    if (sm === em) {
        return `${sm}-${sd}/${ed}`;
    }
    return `${sm}-${sd}/${em}-${ed}`;
}

function safeParse(value: string | null | undefined) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function valueSizeClasses(text: string) {
    const length = text.replace(/\s/g, "").length;
    if (length > 18) return "text-lg print:text-sm";
    if (length > 14) return "text-xl print:text-base";
    if (length > 10) return "text-2xl print:text-lg";
    return "text-3xl print:text-xl";
}

function normalizeHistory(rows: HistoryEntry[]): NormalizedSample[] {
    return rows
        .map((row) => {
            const entry = safeParse(row.entry_time);
            if (!entry) return null;
            const exit = safeParse(row.exit_time);
            let stayHours = 0;
            if (exit) {
                const diffMs = Math.max(0, exit.getTime() - entry.getTime());
                stayHours = diffMs / (1000 * 60 * 60);
            }
            const fee = Number(row.fee ?? 0);
            return {
                entry,
                exit,
                fee: Number.isFinite(fee) ? fee : 0,
                stayHours
            } as NormalizedSample;
        })
        .filter((item): item is NormalizedSample => !!item);
}

function buildPeriods(samples: NormalizedSample[], from: Date, to: Date, periodDays: number): PeriodPoint[] {
    if (!samples.length) return [];
    const result: PeriodPoint[] = [];
    let cursorStart = startOfDay(from);
    const limit = endOfDay(to);
    while (cursorStart.getTime() <= limit.getTime()) {
        const cursorEnd = endOfDay(addDays(cursorStart, periodDays - 1));
        const bucket = samples.filter((sample) => sample.entry.getTime() >= cursorStart.getTime() && sample.entry.getTime() <= cursorEnd.getTime());
        const revenue = bucket.reduce((sum, sample) => sum + sample.fee, 0);
        const vehicles = bucket.length;
        const avgStay = vehicles > 0 ? bucket.reduce((sum, sample) => sum + sample.stayHours, 0) / vehicles : 0;
        result.push({
            label: formatPeriodLabel(cursorStart, cursorEnd),
            start: cursorStart,
            end: cursorEnd,
            vehicles,
            revenue,
            avgStay
        });
        cursorStart = addDays(cursorEnd, 1);
    }
    return result;
}

function linearRegression(points: Array<{ x: number; y: number }>) {
    const n = points.length;
    if (!n) return { slope: 0, intercept: 0 };
    const sumX = points.reduce((total, point) => total + point.x, 0);
    const sumY = points.reduce((total, point) => total + point.y, 0);
    const sumXY = points.reduce((total, point) => total + point.x * point.y, 0);
    const sumX2 = points.reduce((total, point) => total + point.x * point.x, 0);
    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) < 1e-6) {
        return {
            slope: 0,
            intercept: n ? sumY / n : 0
        };
    }
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

function buildForecastSeries(
    values: number[],
    lastEnd: Date | null,
    periodDays: number,
    periodsCount: number,
    regression?: { slope: number; intercept: number }
): ForecastBundle {
    if (!values.length || !lastEnd) {
        return { base: [], optimistic: [], conservative: [] };
    }
    const points = values.map((value, idx) => ({ x: idx, y: value }));
    const model = regression ?? linearRegression(points);
    const lastIndex = values.length - 1;
    const base: ForecastPoint[] = [];
    const optimistic: ForecastPoint[] = [];
    const conservative: ForecastPoint[] = [];
    for (let i = 1; i <= periodsCount; i += 1) {
        const x = lastIndex + i;
        const projection = Math.max(0, model.intercept + model.slope * x);
        const start = addDays(lastEnd, periodDays * (i - 1) + 1);
        const end = endOfDay(addDays(start, periodDays - 1));
        const label = formatPeriodLabel(start, end);
        base.push({ label, value: projection });
        optimistic.push({ label, value: projection * 1.1 });
        conservative.push({ label, value: Math.max(0, projection * 0.9) });
    }
    return { base, optimistic, conservative };
}

function buildInsights(
    lastRevenue: number,
    revenueDescriptor: Descriptor,
    lastVehicles: number,
    vehicleDescriptor: Descriptor,
    projectedRevenue: number,
    projectedVehicles: number,
    optimisticRevenue: number,
    revenueSlope: number,
    avgStay: number,
    periodDays: number
) {
    const lines: string[] = [];
    lines.push(`Ingresos del ultimo periodo: ${formatCurrency(lastRevenue)} (${revenueDescriptor.label}).`);
    lines.push(`La base proyectada estima ${formatCurrency(projectedRevenue)} para los proximos ${periodDays * 4} dias.`);
    lines.push(`Se esperan ${Math.round(projectedVehicles)} movimientos en el mismo lapso (${vehicleDescriptor.label}).`);
    lines.push(`El escenario optimista alcanzaria ${formatCurrency(optimisticRevenue)} si se mantiene la inercia actual.`);
    lines.push(`El periodo reciente registro ${lastVehicles.toLocaleString()} movimientos.`);
    if (avgStay > 0) {
        lines.push(`La permanencia promedio se mantiene en ${formatHours(avgStay)}, clave para dimensionar capacidad.`);
    }
    if (Math.abs(revenueSlope) > 0.01) {
        const direction = revenueSlope > 0 ? "crecimiento" : "contraccion";
        lines.push(`La pendiente de ingresos indica ${direction} de ${revenueSlope.toFixed(2)} unidades por periodo.`);
    }
    return lines.slice(0, 5);
}
export function TendenciasReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [samples, setSamples] = useState<NormalizedSample[]>([]);
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

            const fileName = `tendencias-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('Error al generar PDF:', error);
            alert('Error al generar el PDF. Por favor intenta nuevamente.');
        }
    };

    useEffect(() => {
        const updateScale = () => {
            const container = printRef.current;
            const inner = scaleRef.current;
            if (!container || !inner) return;
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
            const normalized = Number.isFinite(next) ? next : 1;
            if (Math.abs(normalized - lastScaleRef.current) > 0.005) {
                lastScaleRef.current = normalized;
                setContentScale(normalized);
            }
        };
        updateScale();
        window.addEventListener("resize", updateScale);
        return () => window.removeEventListener("resize", updateScale);
    }, [samples, dateRange, loading]);

    useEffect(() => {
        if (!estId) return;
        const load = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/parking/history?est_id=${estId}`);
                const data = await response.json();
                const rows: HistoryEntry[] = Array.isArray(data.history) ? data.history : data || [];
                setSamples(normalizeHistory(rows));
            } catch (error) {
                console.error("Error cargando historial para tendencias:", error);
                setSamples([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [estId]);

    const rangeInfo = useMemo(() => {
        const defaultFrom = startOfDay(addDays(new Date(), -83));
        const from = dateRange?.from ? startOfDay(new Date(dateRange.from)) : defaultFrom;
        const to = dateRange?.to ? endOfDay(new Date(dateRange.to)) : endOfDay(new Date());
        const dayMs = 24 * 60 * 60 * 1000;
        const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / dayMs) + 1);
        const prevTo = startOfDay(addDays(from, -1));
        const prevFrom = startOfDay(addDays(prevTo, -(spanDays - 1)));
        return { from, to, prevFrom, prevTo: endOfDay(prevTo), spanDays };
    }, [dateRange]);

    const periodSpan = useMemo(() => {
        if (rangeInfo.spanDays > 120) return 21;
        if (rangeInfo.spanDays > 90) return 14;
        if (rangeInfo.spanDays > 60) return 10;
        if (rangeInfo.spanDays > 35) return 7;
        if (rangeInfo.spanDays > 21) return 5;
        return 3;
    }, [rangeInfo.spanDays]);

    const currentSamples = useMemo(
        () =>
            samples.filter(
                (sample) => sample.entry.getTime() >= rangeInfo.from.getTime() && sample.entry.getTime() <= rangeInfo.to.getTime()
            ),
        [samples, rangeInfo.from, rangeInfo.to]
    );

    const previousSamples = useMemo(
        () =>
            samples.filter(
                (sample) => sample.entry.getTime() >= rangeInfo.prevFrom.getTime() && sample.entry.getTime() <= rangeInfo.prevTo.getTime()
            ),
        [samples, rangeInfo.prevFrom, rangeInfo.prevTo]
    );

    const currentPeriods = useMemo(
        () => (currentSamples.length ? buildPeriods(currentSamples, rangeInfo.from, rangeInfo.to, periodSpan) : []),
        [currentSamples, rangeInfo.from, rangeInfo.to, periodSpan]
    );

    const previousPeriods = useMemo(
        () => (previousSamples.length ? buildPeriods(previousSamples, rangeInfo.prevFrom, rangeInfo.prevTo, periodSpan) : []),
        [previousSamples, rangeInfo.prevFrom, rangeInfo.prevTo, periodSpan]
    );

    const revenueValues = useMemo(() => currentPeriods.map((period) => period.revenue), [currentPeriods]);
    const vehicleValues = useMemo(() => currentPeriods.map((period) => period.vehicles), [currentPeriods]);

    const revenueRegression = useMemo(
        () => linearRegression(revenueValues.map((value, idx) => ({ x: idx, y: value }))),
        [revenueValues]
    );

    const vehiclesRegression = useMemo(
        () => linearRegression(vehicleValues.map((value, idx) => ({ x: idx, y: value }))),
        [vehicleValues]
    );

    const lastPeriodEnd = currentPeriods.length ? currentPeriods[currentPeriods.length - 1].end : null;

    const revenueForecast = useMemo(
        () => buildForecastSeries(revenueValues, lastPeriodEnd, periodSpan, 4, revenueRegression),
        [revenueValues, lastPeriodEnd, periodSpan, revenueRegression]
    );

    const vehiclesForecast = useMemo(
        () => buildForecastSeries(vehicleValues, lastPeriodEnd, periodSpan, 4, vehiclesRegression),
        [vehicleValues, lastPeriodEnd, periodSpan, vehiclesRegression]
    );

    const lastRevenue = currentPeriods.length ? currentPeriods[currentPeriods.length - 1].revenue : 0;
    const prevRevenue = previousPeriods.length ? previousPeriods[previousPeriods.length - 1].revenue : 0;
    const lastVehicles = currentPeriods.length ? currentPeriods[currentPeriods.length - 1].vehicles : 0;
    const prevVehicles = previousPeriods.length ? previousPeriods[previousPeriods.length - 1].vehicles : 0;
    const avgStayCurrent = currentPeriods.length ? currentPeriods[currentPeriods.length - 1].avgStay : 0;
    const avgStayPrevious = previousPeriods.length ? previousPeriods[previousPeriods.length - 1].avgStay : 0;

    const revenueDescriptor = useMemo(() => diffDescriptor(lastRevenue, prevRevenue), [lastRevenue, prevRevenue]);
    const vehicleDescriptor = useMemo(() => diffDescriptor(lastVehicles, prevVehicles), [lastVehicles, prevVehicles]);
    const stayDescriptor = useMemo(() => diffDescriptor(avgStayCurrent, avgStayPrevious), [avgStayCurrent, avgStayPrevious]);

    const projectedRevenueTotal = useMemo(
        () => revenueForecast.base.reduce((sum, point) => sum + point.value, 0),
        [revenueForecast.base]
    );
    const projectedVehiclesTotal = useMemo(
        () => vehiclesForecast.base.reduce((sum, point) => sum + point.value, 0),
        [vehiclesForecast.base]
    );
    const optimisticRevenueTotal = useMemo(
        () => revenueForecast.optimistic.reduce((sum, point) => sum + point.value, 0),
        [revenueForecast.optimistic]
    );

    const revenueChart = useMemo(() => {
        const actual = currentPeriods.map((period) => ({ label: period.label, value: period.revenue, type: "actual" as const }));
        const projected = revenueForecast.base.map((point) => ({ label: point.label, value: point.value, type: "forecast" as const }));
        return [...actual, ...projected];
    }, [currentPeriods, revenueForecast.base]);

    const vehicleChart = useMemo(() => {
        const actual = currentPeriods.map((period) => ({ label: period.label, value: period.vehicles, type: "actual" as const }));
        const projected = vehiclesForecast.base.map((point) => ({ label: point.label, value: point.value, type: "forecast" as const }));
        return [...actual, ...projected];
    }, [currentPeriods, vehiclesForecast.base]);

    const maxRevenueValue = useMemo(() => Math.max(1, ...revenueChart.map((point) => point.value)), [revenueChart]);
    const maxVehicleValue = useMemo(() => Math.max(1, ...vehicleChart.map((point) => point.value)), [vehicleChart]);

    const scenarioRows = useMemo(() => {
        const base = revenueForecast.base[0]?.value ?? 0;
        const optimistic = revenueForecast.optimistic[0]?.value ?? 0;
        const conservative = revenueForecast.conservative[0]?.value ?? 0;
        const baseVehicles = vehiclesForecast.base[0]?.value ?? 0;
        const optimisticVehicles = vehiclesForecast.optimistic[0]?.value ?? 0;
        const conservativeVehicles = vehiclesForecast.conservative[0]?.value ?? 0;
        return [
            { label: "Base", revenue: base, vehicles: baseVehicles },
            { label: "Optimista", revenue: optimistic, vehicles: optimisticVehicles },
            { label: "Conservadora", revenue: conservative, vehicles: conservativeVehicles }
        ];
    }, [revenueForecast, vehiclesForecast]);

    const insights = useMemo(
        () =>
            buildInsights(
                lastRevenue,
                revenueDescriptor,
                lastVehicles,
                vehicleDescriptor,
                projectedRevenueTotal,
                projectedVehiclesTotal,
                optimisticRevenueTotal,
                revenueRegression.slope,
                avgStayCurrent,
                periodSpan
            ),
        [
            lastRevenue,
            revenueDescriptor,
            lastVehicles,
            vehicleDescriptor,
            projectedRevenueTotal,
            projectedVehiclesTotal,
            optimisticRevenueTotal,
            revenueRegression.slope,
            avgStayCurrent,
            periodSpan
        ]
    );

    const isEmpty = !loading && !currentPeriods.length;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <ReporteHeader
                title="Tendencias y Proyecciones"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onPrint={handlePrint}
            />

            <div ref={printRef} data-print-root className="print-a4 mx-auto bg-white shadow-sm print:shadow-none">
                <div
                    ref={scaleRef}
                    className="print-a4-inner flex h-full flex-col gap-6 px-6 py-6 print:gap-3 print:px-4 print:py-3"
                    style={{ transform: `scale(${contentScale})`, transformOrigin: "top center" }}
                >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-24 print:h-20" />)
                        ) : (
                            <>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Ingresos periodo actual</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className={`font-semibold leading-tight ${valueSizeClasses(formatCurrency(lastRevenue))}`}>
                                            {formatCurrency(lastRevenue)}
                                        </div>
                                        <div
                                            className={`mt-1 text-xs ${
                                                revenueDescriptor.tone === "positive"
                                                    ? "text-emerald-600"
                                                    : revenueDescriptor.tone === "negative"
                                                    ? "text-red-600"
                                                    : "text-slate-500"
                                            }`}
                                        >
                                            {revenueDescriptor.label}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Ingresos proyectados (4 periodos)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className={`font-semibold leading-tight ${valueSizeClasses(formatCurrency(projectedRevenueTotal))}`}>
                                            {formatCurrency(projectedRevenueTotal)}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            Proyeccion base en intervalos de {periodSpan} dias
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Movimientos periodo actual</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className={`font-semibold leading-tight ${valueSizeClasses(lastVehicles.toLocaleString())}`}>
                                            {lastVehicles.toLocaleString()}
                                        </div>
                                        <div
                                            className={`mt-1 text-xs ${
                                                vehicleDescriptor.tone === "positive"
                                                    ? "text-emerald-600"
                                                    : vehicleDescriptor.tone === "negative"
                                                    ? "text-red-600"
                                                    : "text-slate-500"
                                            }`}
                                        >
                                            {vehicleDescriptor.label}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Permanencia promedio</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className={`font-semibold leading-tight ${valueSizeClasses(formatHours(avgStayCurrent))}`}>
                                            {formatHours(avgStayCurrent)}
                                        </div>
                                        <div
                                            className={`mt-1 text-xs ${
                                                stayDescriptor.tone === "positive"
                                                    ? "text-emerald-600"
                                                    : stayDescriptor.tone === "negative"
                                                    ? "text-red-600"
                                                    : "text-slate-500"
                                            }`}
                                        >
                                            {stayDescriptor.label}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Ingresos historicos vs proyeccion</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Comparación de ingresos reales con proyección estimada por regresión lineal.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : isEmpty ? (
                                <div className="text-sm text-slate-500 print:text-xs">Sin datos suficientes para calcular tendencias.</div>
                            ) : (
                                <ChartContainer
                                    config={{
                                        actual: {
                                            label: "Histórico",
                                            color: "#3b82f6",
                                        },
                                        forecast: {
                                            label: "Proyección",
                                            color: "#93c5fd",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={revenueChart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11 }}
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
                                                        formatter={(value, name) => [
                                                            formatCurrency(value as number),
                                                            name === "actual" ? "Histórico" : "Proyección",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#3b82f6"
                                                dot={{ fill: "#3b82f6", r: 3 }}
                                                activeDot={{ r: 5 }}
                                                name="Ingresos"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Movimientos historicos vs proyeccion</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Comparación de operaciones reales con proyección estimada por regresión lineal.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : isEmpty ? (
                                <div className="text-sm text-slate-500 print:text-xs">Sin informacion suficiente para proyectar movimientos.</div>
                            ) : (
                                <ChartContainer
                                    config={{
                                        actual: {
                                            label: "Histórico",
                                            color: "#10b981",
                                        },
                                        forecast: {
                                            label: "Proyección",
                                            color: "#86efac",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={vehicleChart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11 }}
                                                className="text-slate-600"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11 }}
                                                className="text-slate-600"
                                                label={{ value: "Movimientos", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value, name) => [
                                                            `${Math.round(value as number)}`,
                                                            name === "actual" ? "Histórico" : "Proyección",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#10b981"
                                                dot={{ fill: "#10b981", r: 3 }}
                                                activeDot={{ r: 5 }}
                                                name="Movimientos"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Escenarios proyectados</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-40 print:h-28" />
                            ) : isEmpty ? (
                                <div className="text-sm text-slate-500 print:text-xs">Se necesitan al menos dos periodos historicos para proyectar.</div>
                            ) : (
                                <div className="space-y-2 print:space-y-[6px]">
                                    {scenarioRows.map((row) => (
                                        <div
                                            key={row.label}
                                            className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm print:px-2 print:py-1.5 print:text-xs"
                                        >
                                            <div className="font-medium text-slate-700">{row.label}</div>
                                            <div className="flex items-center gap-6 print:gap-4">
                                                <div className="text-right">
                                                    <div className="text-xs uppercase tracking-wide text-slate-500">Ingresos</div>
                                                    <div className="font-semibold">{formatCurrency(row.revenue)}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs uppercase tracking-wide text-slate-500">Movimientos</div>
                                                    <div className="font-semibold">{Math.round(row.vehicles).toLocaleString()}</div>
                                                </div>
                                            </div>
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
                                <ul className="list-disc space-y-1 pl-5 text-sm print:space-y-[6px] print:text-xs">
                                    {insights.map((text, idx) => (
                                        <li key={idx}>{text}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-sm text-slate-500 print:text-xs">No se generaron insights para el periodo indicado.</div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}


