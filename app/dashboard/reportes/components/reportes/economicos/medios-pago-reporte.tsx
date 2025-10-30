"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/utils";

type HistoryEntry = {
    entry_time: string | null;
    exit_time: string | null;
    fee?: number | null;
    pag_monto?: number | null;
    pag_tipo?: string | null;
    mepa_metodo?: string | null;
};

interface PaymentRecord {
    amount: number;
    method: string;
    date: Date;
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

interface MethodTrend {
    method: string;
    points: TrendPoint[];
    total: number;
}

interface ComparisonItem {
    method: string;
    currentAmount: number;
    previousAmount: number;
    currentCount: number;
    previousCount: number;
}

interface Descriptor {
    label: string;
    tone: "positive" | "negative" | "neutral";
}

const METHOD_COLOR_CLASSES: Record<string, string> = {
    Efectivo: "bg-amber-500",
    Transferencia: "bg-sky-500",
    MercadoPago: "bg-emerald-500",
    QR: "bg-indigo-500",
    Tarjeta: "bg-purple-500",
    "Link de Pago": "bg-cyan-500",
    Otros: "bg-slate-400"
};

const COMMISSION_RATES: Record<string, number> = {
    Efectivo: 0,
    Transferencia: 0,
    MercadoPago: 0.038,
    QR: 0.018,
    Tarjeta: 0.055,
    "Link de Pago": 0.04,
    Otros: 0.03
};

const PHYSICAL_METHODS = new Set(["Efectivo", "Transferencia"]);

function methodColorClass(method: string) {
    return METHOD_COLOR_CLASSES[method] ?? METHOD_COLOR_CLASSES.Otros;
}

function commissionRateForMethod(method: string) {
    return COMMISSION_RATES[method] ?? COMMISSION_RATES.Otros;
}

function clamp01(value: number) {
    if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
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

function percentPointsDescriptor(current: number, previous: number): Descriptor {
    if (!Number.isFinite(previous)) {
        if (!Number.isFinite(current)) {
            return { label: "estable", tone: "neutral" };
        }
        return { label: "+100%", tone: "positive" };
    }
    const delta = current - previous;
    if (Math.abs(delta) < 0.5) {
        return { label: "estable", tone: "neutral" };
    }
    const rounded = Math.round(delta * 10) / 10;
    const sign = rounded > 0 ? "+" : "";
    return {
        label: `${sign}${rounded} pts`,
        tone: rounded > 0 ? "positive" : "negative"
    };
}

function valueSizeClasses(text: string) {
    const length = text.replace(/\s/g, "").length;
    if (length > 18) return "text-lg print:text-sm";
    if (length > 14) return "text-xl print:text-base";
    if (length > 10) return "text-2xl print:text-lg";
    return "text-3xl print:text-xl";
}

function normalizePaymentMethod(method?: string | null) {
    if (!method) return "Efectivo";
    const normalized = method.toString().trim().toLowerCase();
    if (!normalized) return "Efectivo";
    const ascii = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (ascii === "efectivo" || ascii === "cash") return "Efectivo";
    if (ascii.includes("transfer")) return "Transferencia";
    if (ascii.includes("mercado") || ascii === "mp" || ascii.includes("mercadopago")) return "MercadoPago";
    if (ascii.includes("qr")) return "QR";
    if (ascii.includes("link")) return "Link de Pago";
    if (ascii.includes("debito") || ascii.includes("credito") || ascii.includes("tarjeta")) return "Tarjeta";
    if (ascii.includes("abono") || ascii.includes("extension")) return "Otros";
    const fallback = ascii.charAt(0).toUpperCase() + ascii.slice(1);
    return fallback || "Otros";
}

function normalizeHistory(history: HistoryEntry[]) {
    return history
        .map((item) => {
            const rawDate = item.exit_time || item.entry_time;
            if (!rawDate) return null;
            const parsed = new Date(rawDate);
            if (Number.isNaN(parsed.getTime())) return null;
            const amount = Number(item.fee ?? item.pag_monto ?? 0);
            if (!Number.isFinite(amount)) return null;
            const method = normalizePaymentMethod(item.mepa_metodo ?? item.pag_tipo);
            return {
                amount,
                method,
                date: parsed
            } as PaymentRecord;
        })
        .filter((item): item is PaymentRecord => !!item);
}

function filterByRange(pagos: PaymentRecord[], from: Date, to: Date) {
    const start = from.getTime();
    const end = to.getTime();
    return pagos.filter((pago) => {
        const time = pago.date.getTime();
        return time >= start && time <= end;
    });
}

function sumAmounts(list: PaymentRecord[]) {
    return list.reduce((total, pago) => total + (pago.amount || 0), 0);
}

function enumerateDays(from: Date, to: Date) {
    const days: string[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= end.getTime()) {
        days.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

function buildBreakdown(pagos: PaymentRecord[]) {
    const map = new Map<string, BreakdownItem>();
    pagos.forEach((pago) => {
        const method = pago.method;
        const entry = map.get(method) || { label: method, amount: 0, count: 0 };
        entry.amount += pago.amount;
        entry.count += 1;
        map.set(method, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

function buildTrendByMethod(pagos: PaymentRecord[], from: Date, to: Date): MethodTrend[] {
    const dayKeys = enumerateDays(from, to);
    const methodSet = new Set<string>();
    const byMethod = new Map<string, Map<string, number>>();

    pagos.forEach((pago) => {
        methodSet.add(pago.method);
        const day = pago.date.toISOString().slice(0, 10);
        const map = byMethod.get(pago.method) ?? new Map<string, number>();
        map.set(day, (map.get(day) ?? 0) + pago.amount);
        byMethod.set(pago.method, map);
    });

    return Array.from(methodSet)
        .map((method) => {
            const map = byMethod.get(method) ?? new Map<string, number>();
            const points = dayKeys.map((key) => ({
                label: key,
                value: map.get(key) ?? 0
            }));
            const total = points.reduce((sum, point) => sum + point.value, 0);
            return { method, points, total } as MethodTrend;
        })
        .sort((a, b) => b.total - a.total);
}

function buildComparison(current: BreakdownItem[], previous: BreakdownItem[]): ComparisonItem[] {
    const previousMap = new Map<string, BreakdownItem>();
    previous.forEach((item) => previousMap.set(item.label, item));
    const seen = new Set<string>();
    const result: ComparisonItem[] = [];

    current.forEach((item) => {
        const prev = previousMap.get(item.label);
        result.push({
            method: item.label,
            currentAmount: item.amount,
            previousAmount: prev?.amount ?? 0,
            currentCount: item.count,
            previousCount: prev?.count ?? 0
        });
        seen.add(item.label);
    });

    previous.forEach((item) => {
        if (seen.has(item.label)) return;
        result.push({
            method: item.label,
            currentAmount: 0,
            previousAmount: item.amount,
            currentCount: 0,
            previousCount: item.count
        });
    });

    return result.sort((a, b) => b.currentAmount - a.currentAmount);
}

function calculateWeightedCommission(pagos: PaymentRecord[]) {
    const total = sumAmounts(pagos);
    if (total <= 0) return 0;
    const commission = pagos.reduce((sum, pago) => sum + pago.amount * commissionRateForMethod(pago.method), 0);
    return commission / total;
}

function deriveInsights(
    totalCurrent: number,
    totalPrevious: number,
    digitalPercentCurrent: number,
    digitalPercentPrevious: number,
    breakdown: BreakdownItem[],
    comparison: ComparisonItem[],
    commissionAverage: number
) {
    const insights: string[] = [];

    if (totalCurrent <= 0) {
        if (totalPrevious > 0) {
            return ["No hubo cobros registrados en el periodo actual."];
        }
        return ["Sin registros de pagos en los periodos analizados."];
    }

    const totalVariance = diffDescriptor(totalCurrent, totalPrevious);
    insights.push(`Se cobraron ${formatCurrency(totalCurrent)} (${totalVariance.label} vs periodo anterior).`);

    const digitalDescriptor = percentPointsDescriptor(digitalPercentCurrent, digitalPercentPrevious);
    if (digitalDescriptor.label === "estable") {
        insights.push(`Los medios digitales representan ${Math.round(digitalPercentCurrent)}% del total, sin variaciones relevantes.`);
    } else {
        insights.push(
            `Los medios digitales representan ${Math.round(digitalPercentCurrent)}% del total (${digitalDescriptor.label} vs periodo anterior).`
        );
    }

    if (breakdown.length) {
        const top = breakdown[0];
        const share = totalCurrent > 0 ? Math.round((top.amount / totalCurrent) * 100) : 0;
        const previousItem = comparison.find((item) => item.method === top.label);
        const previousShare = totalPrevious > 0 && previousItem ? Math.round((previousItem.previousAmount / totalPrevious) * 100) : 0;
        const shareDescriptor = percentPointsDescriptor(share, previousShare);
        if (shareDescriptor.label === "estable") {
            insights.push(`${top.label} sigue siendo el medio principal con ${share}% del total.`);
        } else {
            insights.push(`${top.label} concentra ${share}% (${shareDescriptor.label} vs periodo anterior).`);
        }
    }

    const growing = comparison
        .map((item) => ({
            method: item.method,
            delta: item.currentAmount - item.previousAmount
        }))
        .sort((a, b) => b.delta - a.delta);
    const topGrowth = growing.find((item) => item.delta > 0);
    if (topGrowth && topGrowth.delta > 0) {
        insights.push(
            `${topGrowth.method} fue el medio con mayor crecimiento absoluto (${formatCurrency(topGrowth.delta)} mas que el periodo previo).`
        );
    }

    if (commissionAverage > 0) {
        insights.push(`La comision promedio estimada del mix fue ${(commissionAverage * 100).toFixed(1)}%.`);
    }

    return insights;
}

export function MediosPagoReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [history, setHistory] = useState<PaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef<HTMLDivElement>(null);
    const [contentScale, setContentScale] = useState(1);
    const lastScaleRef = useRef(1);

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
    }, [history, dateRange, loading]);

    useEffect(() => {
        if (!estId) return;
        const load = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/parking/history?est_id=${estId}`);
                const data = await response.json();
                const rows: HistoryEntry[] = Array.isArray(data.history) ? data.history : data || [];
                setHistory(normalizeHistory(rows));
            } catch (error) {
                console.error("Error cargando historial de pagos:", error);
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [estId]);

    const rangeInfo = useMemo(() => {
        const from = dateRange?.from
            ? new Date(dateRange.from)
            : (() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 29);
                  d.setHours(0, 0, 0, 0);
                  return d;
              })();
        const to = dateRange?.to
            ? new Date(dateRange.to)
            : (() => {
                  const d = new Date();
                  d.setHours(23, 59, 59, 999);
                  return d;
              })();
        const dayMs = 24 * 60 * 60 * 1000;
        const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / dayMs) + 1);
        const prevTo = new Date(from.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - (periodDays - 1) * dayMs);
        prevFrom.setHours(0, 0, 0, 0);
        prevTo.setHours(23, 59, 59, 999);
        return { from, to, prevFrom, prevTo };
    }, [dateRange]);

    const currentPayments = useMemo(() => filterByRange(history, rangeInfo.from, rangeInfo.to), [history, rangeInfo.from, rangeInfo.to]);
    const previousPayments = useMemo(
        () => filterByRange(history, rangeInfo.prevFrom, rangeInfo.prevTo),
        [history, rangeInfo.prevFrom, rangeInfo.prevTo]
    );

    const currentBreakdown = useMemo(() => buildBreakdown(currentPayments), [currentPayments]);
    const previousBreakdown = useMemo(() => buildBreakdown(previousPayments), [previousPayments]);
    const comparison = useMemo(() => buildComparison(currentBreakdown, previousBreakdown), [currentBreakdown, previousBreakdown]);
    const trendByMethod = useMemo(
        () => buildTrendByMethod(currentPayments, rangeInfo.from, rangeInfo.to),
        [currentPayments, rangeInfo.from, rangeInfo.to]
    );
    const maxTrendValue = useMemo(
        () => Math.max(1, ...trendByMethod.flatMap((serie) => serie.points.map((point) => point.value))),
        [trendByMethod]
    );

    const totalCurrent = useMemo(() => sumAmounts(currentPayments), [currentPayments]);
    const totalPrevious = useMemo(() => sumAmounts(previousPayments), [previousPayments]);

    const digitalAmountCurrent = useMemo(
        () => currentPayments.reduce((sum, pago) => sum + (PHYSICAL_METHODS.has(pago.method) ? 0 : pago.amount), 0),
        [currentPayments]
    );
    const digitalAmountPrevious = useMemo(
        () => previousPayments.reduce((sum, pago) => sum + (PHYSICAL_METHODS.has(pago.method) ? 0 : pago.amount), 0),
        [previousPayments]
    );
    const digitalPercentCurrent = totalCurrent > 0 ? (digitalAmountCurrent / totalCurrent) * 100 : 0;
    const digitalPercentPrevious = totalPrevious > 0 ? (digitalAmountPrevious / totalPrevious) * 100 : 0;
    const physicalPercentCurrent = clamp01(1 - digitalPercentCurrent / 100) * 100;

    const commissionAverageCurrent = useMemo(() => calculateWeightedCommission(currentPayments), [currentPayments]);
    const commissionAveragePrevious = useMemo(() => calculateWeightedCommission(previousPayments), [previousPayments]);

    const topMethod = currentBreakdown[0] ?? null;
    const topMethodShare = topMethod && totalCurrent > 0 ? (topMethod.amount / totalCurrent) * 100 : 0;
    const previousTopItem = topMethod ? previousBreakdown.find((item) => item.label === topMethod.label) : undefined;
    const previousTopShare = previousTopItem && totalPrevious > 0 ? (previousTopItem.amount / totalPrevious) * 100 : 0;

    const totalDescriptor = diffDescriptor(totalCurrent, totalPrevious);
    const digitalDescriptor = percentPointsDescriptor(digitalPercentCurrent, digitalPercentPrevious);
    const commissionDescriptor = percentPointsDescriptor(commissionAverageCurrent * 100, commissionAveragePrevious * 100);
    const topMethodDescriptor = percentPointsDescriptor(topMethodShare, previousTopShare);

    const insights = useMemo(
        () =>
            deriveInsights(
                totalCurrent,
                totalPrevious,
                digitalPercentCurrent,
                digitalPercentPrevious,
                currentBreakdown,
                comparison,
                commissionAverageCurrent
            ),
        [
            totalCurrent,
            totalPrevious,
            digitalPercentCurrent,
            digitalPercentPrevious,
            currentBreakdown,
            comparison,
            commissionAverageCurrent
        ]
    );

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <ReporteHeader
                title="Medios de Pago"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
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
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Total cobrado
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = formatCurrency(totalCurrent);
                                            return (
                                                <>
                                                    <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>
                                                        {text}
                                                    </div>
                                                    <div
                                                        className={`mt-1 text-xs ${
                                                            totalDescriptor.tone === "positive"
                                                                ? "text-emerald-600"
                                                                : totalDescriptor.tone === "negative"
                                                                ? "text-red-600"
                                                                : "text-slate-500"
                                                        }`}
                                                    >
                                                        {totalDescriptor.label} vs periodo anterior
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Digital vs fisico
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const digitalText = `${Math.round(digitalPercentCurrent)}%`;
                                            const physicalText = `${Math.round(physicalPercentCurrent)}%`;
                                            const toneClass =
                                                digitalDescriptor.tone === "positive"
                                                    ? "text-emerald-600"
                                                    : digitalDescriptor.tone === "negative"
                                                    ? "text-red-600"
                                                    : "text-slate-500";
                                            return (
                                                <>
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <div className={`font-semibold leading-tight ${valueSizeClasses(digitalText)}`}>
                                                            {digitalText}
                                                        </div>
                                                        <span className="text-xs uppercase tracking-wide text-emerald-600 print:text-[10px]">
                                                            Digital
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 flex items-baseline justify-between gap-2">
                                                        <div className={`font-semibold leading-tight ${valueSizeClasses(physicalText)}`}>
                                                            {physicalText}
                                                        </div>
                                                        <span className="text-xs uppercase tracking-wide text-slate-600 print:text-[10px]">
                                                            Fisico
                                                        </span>
                                                    </div>
                                                    <div className={`mt-2 text-xs ${toneClass}`}>
                                                        {digitalDescriptor.label === "estable"
                                                            ? "Mix sin cambios relevantes."
                                                            : `${digitalDescriptor.label} en digital vs periodo anterior.`}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Medio mas usado
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {topMethod ? (
                                            <>
                                                <div className="text-2xl font-semibold text-slate-800 print:text-lg">
                                                    {topMethod.label}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    {Math.round(topMethodShare)}% del total ({topMethod.count} operaciones)
                                                </div>
                                                <div
                                                    className={`mt-2 text-xs ${
                                                        topMethodDescriptor.tone === "positive"
                                                            ? "text-emerald-600"
                                                            : topMethodDescriptor.tone === "negative"
                                                            ? "text-red-600"
                                                            : "text-slate-500"
                                                    }`}
                                                >
                                                    {topMethodDescriptor.label === "estable"
                                                        ? "Participacion estable vs periodo anterior."
                                                        : `${topMethodDescriptor.label} en cuota del total vs periodo anterior.`}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-slate-500">Sin datos disponibles.</div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Comision promedio
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = `${(commissionAverageCurrent * 100).toFixed(1)}%`;
                                            const toneClass =
                                                commissionDescriptor.tone === "positive"
                                                    ? "text-emerald-600"
                                                    : commissionDescriptor.tone === "negative"
                                                    ? "text-red-600"
                                                    : "text-slate-500";
                                            return (
                                                <>
                                                    <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>
                                                        {text}
                                                    </div>
                                                    <div className={`mt-1 text-xs ${toneClass}`}>
                                                        {commissionDescriptor.label === "estable"
                                                            ? "Costo financiero estable."
                                                            : `${commissionDescriptor.label} vs periodo anterior.`}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Distribucion de cobros</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-48 print:h-32" />
                            ) : currentBreakdown.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">No hay cobros en el periodo.</div>
                            ) : (
                                <div className="space-y-3 print:space-y-2">
                                    {currentBreakdown.map((item) => {
                                        const share = totalCurrent > 0 ? clamp01(item.amount / totalCurrent) * 100 : 0;
                                        return (
                                            <div key={item.label} className="space-y-1 print:space-y-[3px]">
                                                <div className="flex items-center justify-between text-sm text-slate-700 print:text-xs">
                                                    <span className="font-medium">{item.label}</span>
                                                    <span className="text-slate-500">{formatCurrency(item.amount)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 flex-1 rounded bg-slate-200 print:h-[6px]">
                                                        <div
                                                            className={`h-2 rounded ${methodColorClass(item.label)} print:h-[6px]`}
                                                            style={{ width: `${Math.max(4, share)}%` }}
                                                        />
                                                    </div>
                                                    <span className="w-12 text-right text-xs text-slate-500 print:w-10">
                                                        {Math.round(share)}%
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Evolucion por medio</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-48 print:h-32" />
                            ) : trendByMethod.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay registros suficientes para graficar.
                                </div>
                            ) : (
                                <div className="space-y-4 print:space-y-2">
                                    {trendByMethod.map((serie) => {
                                        const firstLabel = serie.points.length ? serie.points[0].label.slice(5) : "";
                                        const lastPoint = serie.points.length ? serie.points[serie.points.length - 1] : undefined;
                                        const lastLabel = lastPoint ? lastPoint.label.slice(5) : "";
                                        return (
                                            <div key={serie.method}>
                                                <div className="flex items-center justify-between text-xs text-slate-500">
                                                    <span className="font-medium text-slate-700">{serie.method}</span>
                                                    <span>{formatCurrency(serie.total)}</span>
                                                </div>
                                                <div className="mt-1 flex h-20 items-end gap-[3px] rounded bg-slate-100 px-2 py-2 print:h-16 print:px-1.5">
                                                    {serie.points.map((point, idx) => (
                                                        <div
                                                            key={`${point.label}-${idx}`}
                                                            className={`flex-1 rounded-t ${methodColorClass(serie.method)}`}
                                                            style={{
                                                                height: `${maxTrendValue > 0 ? Math.max(4, (point.value / maxTrendValue) * 100) : 4}%`
                                                            }}
                                                            title={`${serie.method} ${point.label}: ${formatCurrency(point.value)}`}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                                                    <span>{firstLabel}</span>
                                                    <span>{lastLabel}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Comparativo vs periodo anterior</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-40 print:h-28" />
                            ) : comparison.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay datos del periodo anterior para comparar.
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
                                    {comparison.map((item) => {
                                        const descriptor = diffDescriptor(item.currentAmount, item.previousAmount);
                                        return (
                                            <div key={item.method} className="rounded border border-slate-200 p-3 print:p-2">
                                                <div className="flex items-baseline justify-between text-sm font-medium text-slate-700 print:text-xs">
                                                    <span>{item.method}</span>
                                                    <span>{formatCurrency(item.currentAmount)}</span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    Prev: {formatCurrency(item.previousAmount)} | Ops: {item.currentCount}/{item.previousCount}
                                                </div>
                                                <div
                                                    className={`mt-1 text-xs ${
                                                        descriptor.tone === "positive"
                                                            ? "text-emerald-600"
                                                            : descriptor.tone === "negative"
                                                            ? "text-red-600"
                                                            : "text-slate-500"
                                                    }`}
                                                >
                                                    {descriptor.label}
                                                </div>
                                            </div>
                                        );
                                    })}
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
