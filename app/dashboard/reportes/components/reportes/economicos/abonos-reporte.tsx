
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ReporteHeader } from "../../reporte-header";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/utils";

type AbonoApiRow = {
    abo_nro: number;
    conductor_nombre: string;
    conductor_apellido: string;
    conductor_dni: string;
    zona: string;
    pla_numero: number;
    tipo_abono: string;
    fecha_inicio: string;
    fecha_fin: string;
    dias_restantes: number;
    estado: string;
};

type AbonoStatus = "activo" | "por_vencer" | "vencido";

interface AbonoRecord {
    id: number;
    titular: string;
    dni: string;
    zone: string;
    spot: number | null;
    type: string;
    start: Date;
    end: Date;
    status: AbonoStatus;
    remainingDays: number;
}

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
    date: Date;
    kind: string;
    method: string;
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

function valueSizeClasses(text: string) {
    const length = text.replace(/\s/g, "").length;
    if (length > 18) return "text-lg print:text-sm";
    if (length > 14) return "text-xl print:text-base";
    if (length > 10) return "text-2xl print:text-lg";
    return "text-3xl print:text-xl";
}

function toStatus(value: string | undefined | null): AbonoStatus {
    const normalized = (value || "").toString().toLowerCase();
    if (normalized.includes("por") && normalized.includes("venc")) return "por_vencer";
    if (normalized.includes("venc")) return "vencido";
    return "activo";
}

function toTypeLabel(value: string | undefined | null) {
    if (!value) return "sin definir";
    const trimmed = value.toString().trim();
    if (!trimmed) return "sin definir";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function safeParse(dateLike: string | null | undefined) {
    if (!dateLike) return null;
    const parsed = new Date(dateLike);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function normalizeAbonos(rows: AbonoApiRow[]): AbonoRecord[] {
    return rows
        .map((row) => {
            const start = safeParse(row.fecha_inicio);
            const end = safeParse(row.fecha_fin);
            if (!start || !end) {
                return null;
            }
            return {
                id: row.abo_nro,
                titular: `${row.conductor_nombre || ""} ${row.conductor_apellido || ""}`.trim() || "Sin titular",
                dni: row.conductor_dni || "N/A",
                zone: row.zona || "General",
                spot: typeof row.pla_numero === "number" ? row.pla_numero : null,
                type: toTypeLabel(row.tipo_abono),
                start,
                end,
                status: toStatus(row.estado),
                remainingDays: Number.isFinite(row.dias_restantes) ? row.dias_restantes : 0
            } as AbonoRecord;
        })
        .filter((item): item is AbonoRecord => !!item);
}
const ABONO_PAYMENT_MATCHERS = ["abono", "extension", "renov"];

function isAbonoPayment(kind?: string | null) {
    if (!kind) return false;
    const normalized = kind.toString().toLowerCase().trim();
    if (!normalized) return false;
    return ABONO_PAYMENT_MATCHERS.some((token) => normalized.includes(token));
}

function normalizePayments(history: HistoryEntry[]) {
    return history
        .map((entry) => {
            const rawDate = entry.exit_time || entry.entry_time;
            const date = safeParse(rawDate || null);
            if (!date) return null;
            const kind = entry.pag_tipo || "";
            if (!isAbonoPayment(kind)) return null;
            const amount = Number(entry.fee ?? entry.pag_monto ?? 0);
            if (!Number.isFinite(amount) || amount <= 0) return null;
            const method = entry.mepa_metodo ? entry.mepa_metodo.toString() : "Desconocido";
            return {
                amount,
                date,
                kind: kind.toString(),
                method
            } as PaymentRecord;
        })
        .filter((item): item is PaymentRecord => !!item);
}

function enumerateDays(from: Date, to: Date) {
    const days: string[] = [];
    const cursor = startOfDay(from);
    const end = startOfDay(to);
    while (cursor.getTime() <= end.getTime()) {
        days.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

function overlapsRange(abono: AbonoRecord, from: Date, to: Date) {
    return abono.start.getTime() <= to.getTime() && abono.end.getTime() >= from.getTime();
}

function between(date: Date, from: Date, to: Date) {
    const time = date.getTime();
    return time >= from.getTime() && time <= to.getTime();
}

function sumAmounts(list: PaymentRecord[]) {
    return list.reduce((total, item) => total + item.amount, 0);
}

function buildActiveSeries(abonos: AbonoRecord[], from: Date, to: Date) {
    const dayKeys = enumerateDays(from, to);
    return dayKeys.map((key) => {
        const day = new Date(`${key}T00:00:00`);
        const count = abonos.filter((item) => overlapsRange(item, day, day)).length;
        return { label: key, value: count };
    });
}

function buildTypeBreakdown(abonos: AbonoRecord[]) {
    const map = new Map<string, { label: string; count: number }>();
    abonos.forEach((abono) => {
        const key = abono.type || "sin definir";
        const entry = map.get(key) || { label: key, count: 0 };
        entry.count += 1;
        map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function buildStatusBreakdown(abonos: AbonoRecord[]) {
    const map: Record<AbonoStatus, number> = {
        activo: 0,
        por_vencer: 0,
        vencido: 0
    };
    abonos.forEach((abono) => {
        map[abono.status] += 1;
    });
    return [
        { label: "Activos", key: "activo", count: map.activo },
        { label: "Por vencer", key: "por_vencer", count: map.por_vencer },
        { label: "Vencidos", key: "vencido", count: map.vencido }
    ];
}

function buildExpiryList(abonos: AbonoRecord[], from: Date, to: Date, limit = 6) {
    const upcoming = abonos
        .filter((item) => between(item.end, from, to))
        .sort((a, b) => a.end.getTime() - b.end.getTime())
        .slice(0, limit)
        .map((item) => ({
            id: item.id,
            titular: item.titular,
            end: item.end,
            remaining: Math.max(0, Math.ceil((item.end.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))),
            zone: item.zone,
            type: item.type
        }));
    return upcoming;
}

function buildInsights(
    activeCurrent: number,
    activeDescriptor: Descriptor,
    revenueCurrent: number,
    revenueDescriptor: Descriptor,
    newCurrent: number,
    renewalsCurrent: number,
    expiringSoon: number,
    topType: string | null
) {
    const insights: string[] = [];
    insights.push(`Se registran ${activeCurrent} abonos activos (${activeDescriptor.label} vs periodo anterior).`);
    insights.push(`Los cobros recurrentes sumaron ${formatCurrency(revenueCurrent)} (${revenueDescriptor.label}).`);
    if (newCurrent > 0) {
        insights.push(`${newCurrent} abonos comenzaron dentro del periodo analizado.`);
    } else {
        insights.push("No se detectaron altas nuevas en el periodo.");
    }
    if (renewalsCurrent > 0) {
        insights.push(`${renewalsCurrent} renovaciones se concretaron con pagos de extension o abono.`);
    } else {
        insights.push("No hubo renovaciones registradas en el periodo.");
    }
    if (expiringSoon > 0) {
        insights.push(`${expiringSoon} abonos vencen en los proximos 15 dias.`);
    }
    if (topType) {
        insights.push(`El tipo con mayor adopcion fue ${topType}.`);
    }
    return insights;
}
export function AbonosReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [abonos, setAbonos] = useState<AbonoRecord[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingPayments, setLoadingPayments] = useState(true);
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
    }, [abonos, payments, dateRange, loading, loadingPayments]);

    useEffect(() => {
        if (!estId) return;
        const loadAbonos = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/abonos/list?est_id=${estId}&incluir_vencidos=true`);
                const data = await response.json();
                if (data?.abonos && Array.isArray(data.abonos)) {
                    setAbonos(normalizeAbonos(data.abonos));
                } else {
                    setAbonos([]);
                }
            } catch (error) {
                console.error("Error cargando abonos:", error);
                setAbonos([]);
            } finally {
                setLoading(false);
            }
        };
        loadAbonos();
    }, [estId]);

    useEffect(() => {
        if (!estId) return;
        const loadPayments = async () => {
            setLoadingPayments(true);
            try {
                const response = await fetch(`/api/parking/history?est_id=${estId}`);
                const data = await response.json();
                const rows: HistoryEntry[] = Array.isArray(data.history) ? data.history : data || [];
                setPayments(normalizePayments(rows));
            } catch (error) {
                console.error("Error cargando pagos de abonos:", error);
                setPayments([]);
            } finally {
                setLoadingPayments(false);
            }
        };
        loadPayments();
    }, [estId]);
    const rangeInfo = useMemo(() => {
        const from = dateRange?.from
            ? startOfDay(new Date(dateRange.from))
            : (() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 29);
                  return startOfDay(d);
              })();
        const to = dateRange?.to ? endOfDay(new Date(dateRange.to)) : endOfDay(new Date());
        const dayMs = 24 * 60 * 60 * 1000;
        const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / dayMs) + 1);
        const prevTo = new Date(from.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - (periodDays - 1) * dayMs);
        return {
            from,
            to,
            prevFrom: startOfDay(prevFrom),
            prevTo: endOfDay(prevTo),
            periodDays
        };
    }, [dateRange]);

    const currentAbonos = useMemo(() => abonos.filter((abono) => overlapsRange(abono, rangeInfo.from, rangeInfo.to)), [abonos, rangeInfo.from, rangeInfo.to]);
    const previousAbonos = useMemo(
        () => abonos.filter((abono) => overlapsRange(abono, rangeInfo.prevFrom, rangeInfo.prevTo)),
        [abonos, rangeInfo.prevFrom, rangeInfo.prevTo]
    );

    const newAbonosCurrent = useMemo(
        () => abonos.filter((abono) => between(abono.start, rangeInfo.from, rangeInfo.to)),
        [abonos, rangeInfo.from, rangeInfo.to]
    );
    const newAbonosPrevious = useMemo(
        () => abonos.filter((abono) => between(abono.start, rangeInfo.prevFrom, rangeInfo.prevTo)),
        [abonos, rangeInfo.prevFrom, rangeInfo.prevTo]
    );

    const paymentsCurrent = useMemo(
        () => payments.filter((payment) => between(payment.date, rangeInfo.from, rangeInfo.to)),
        [payments, rangeInfo.from, rangeInfo.to]
    );
    const paymentsPrevious = useMemo(
        () => payments.filter((payment) => between(payment.date, rangeInfo.prevFrom, rangeInfo.prevTo)),
        [payments, rangeInfo.prevFrom, rangeInfo.prevTo]
    );

    const revenueCurrent = useMemo(() => sumAmounts(paymentsCurrent), [paymentsCurrent]);
    const revenuePrevious = useMemo(() => sumAmounts(paymentsPrevious), [paymentsPrevious]);

    const renewalsCurrent = useMemo(
        () => paymentsCurrent.filter((payment) => payment.kind.toLowerCase().includes("extension") || payment.kind.toLowerCase().includes("renov")).length,
        [paymentsCurrent]
    );
    const renewalsPrevious = useMemo(
        () => paymentsPrevious.filter((payment) => payment.kind.toLowerCase().includes("extension") || payment.kind.toLowerCase().includes("renov")).length,
        [paymentsPrevious]
    );

    const expiringSoon = useMemo(() => {
        const futureLimit = new Date(rangeInfo.to);
        futureLimit.setDate(futureLimit.getDate() + 15);
        return abonos.filter((abono) => between(abono.end, rangeInfo.to, futureLimit)).length;
    }, [abonos, rangeInfo.to]);

    const activeDescriptor = useMemo(
        () => diffDescriptor(currentAbonos.length, previousAbonos.length),
        [currentAbonos.length, previousAbonos.length]
    );
    const revenueDescriptor = useMemo(() => diffDescriptor(revenueCurrent, revenuePrevious), [revenueCurrent, revenuePrevious]);
    const newDescriptor = useMemo(() => diffDescriptor(newAbonosCurrent.length, newAbonosPrevious.length), [newAbonosCurrent.length, newAbonosPrevious.length]);
    const renewalsDescriptor = useMemo(
        () => diffDescriptor(renewalsCurrent, renewalsPrevious),
        [renewalsCurrent, renewalsPrevious]
    );

    const activeSeries = useMemo(() => buildActiveSeries(abonos, rangeInfo.from, rangeInfo.to), [abonos, rangeInfo.from, rangeInfo.to]);
    const maxActiveValue = useMemo(() => Math.max(1, ...activeSeries.map((item) => item.value)), [activeSeries]);

    const statusBreakdown = useMemo(() => buildStatusBreakdown(currentAbonos), [currentAbonos]);
    const typeBreakdown = useMemo(() => buildTypeBreakdown(currentAbonos), [currentAbonos]);
    const topType = typeBreakdown.length ? typeBreakdown[0].label : null;

    const upcomingExpirations = useMemo(() => buildExpiryList(abonos, rangeInfo.to, new Date(rangeInfo.to.getTime() + 30 * 24 * 60 * 60 * 1000)), [abonos, rangeInfo.to]);

    const insights = useMemo(
        () =>
            buildInsights(
                currentAbonos.length,
                activeDescriptor,
                revenueCurrent,
                revenueDescriptor,
                newAbonosCurrent.length,
                renewalsCurrent,
                expiringSoon,
                topType
            ),
        [
            currentAbonos.length,
            activeDescriptor,
            revenueCurrent,
            revenueDescriptor,
            newAbonosCurrent.length,
            renewalsCurrent,
            expiringSoon,
            topType
        ]
    );

    const isLoading = loading || loadingPayments;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <ReporteHeader
                title="Abonos y Subscripciones"
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
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-24 print:h-20" />)
                        ) : (
                            <>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Abonos activos</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = currentAbonos.length.toLocaleString();
                                            return (
                                                <>
                                                    <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>{text}</div>
                                                    <div
                                                        className={`mt-1 text-xs ${
                                                            activeDescriptor.tone === "positive"
                                                                ? "text-emerald-600"
                                                                : activeDescriptor.tone === "negative"
                                                                ? "text-red-600"
                                                                : "text-slate-500"
                                                        }`}
                                                    >
                                                        {activeDescriptor.label}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Ingresos recurrentes</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = formatCurrency(revenueCurrent);
                                            return (
                                                <>
                                                    <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>{text}</div>
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
                                                </>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Altas en el periodo</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = newAbonosCurrent.length.toLocaleString();
                                            return (
                                                <>
                                                    <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>{text}</div>
                                                    <div
                                                        className={`mt-1 text-xs ${
                                                            newDescriptor.tone === "positive"
                                                                ? "text-emerald-600"
                                                                : newDescriptor.tone === "negative"
                                                                ? "text-red-600"
                                                                : "text-slate-500"
                                                        }`}
                                                    >
                                                        {newDescriptor.label}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Renovaciones</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = renewalsCurrent.toLocaleString();
                                            return (
                                                <>
                                                    <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>{text}</div>
                                                    <div
                                                        className={`mt-1 text-xs ${
                                                            renewalsDescriptor.tone === "positive"
                                                                ? "text-emerald-600"
                                                                : renewalsDescriptor.tone === "negative"
                                                                ? "text-red-600"
                                                                : "text-slate-500"
                                                        }`}
                                                    >
                                                        {renewalsDescriptor.label}
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
                            <CardTitle className="text-base print:text-sm">Evolucion de abonos activos</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {isLoading ? (
                                <Skeleton className="h-48 print:h-32" />
                            ) : activeSeries.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">Sin registros en el periodo.</div>
                            ) : (
                                <div className="flex h-48 items-end gap-[3px] rounded bg-slate-100 px-3 py-3 print:h-32 print:px-2 print:py-2">
                                    {activeSeries.map((point, idx) => (
                                        <div
                                            key={`${point.label}-${idx}`}
                                            className="flex-1 rounded-t bg-indigo-500 print:bg-indigo-500"
                                            style={{
                                                height: `${maxActiveValue > 0 ? Math.max(4, (point.value / maxActiveValue) * 100) : 4}%`
                                            }}
                                            title={`${point.label}: ${point.value} activos`}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2 print:gap-2">
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-3 print:py-2 print:pb-1">
                                <CardTitle className="text-base print:text-sm">Estado actual</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:pt-1 print:pb-0">
                                {isLoading ? (
                                    <Skeleton className="h-40 print:h-28" />
                                ) : (
                                    <div className="space-y-3 print:space-y-2">
                                        {statusBreakdown.map((item) => (
                                            <div key={item.key} className="space-y-1 print:space-y-[3px]">
                                                <div className="flex items-center justify-between text-sm font-medium text-slate-700 print:text-xs">
                                                    <span>{item.label}</span>
                                                    <span>{item.count.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 flex-1 rounded bg-slate-200 print:h-[6px]">
                                                        <div
                                                            className={`h-2 rounded ${
                                                                item.key === "activo"
                                                                    ? "bg-emerald-500"
                                                                    : item.key === "por_vencer"
                                                                    ? "bg-amber-500"
                                                                    : "bg-red-500"
                                                            } print:h-[6px]`}
                                                            style={{
                                                                width: `${currentAbonos.length > 0 ? Math.max(4, (item.count / currentAbonos.length) * 100) : 4}%`
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="w-12 text-right text-xs text-slate-500 print:w-10">
                                                        {currentAbonos.length > 0 ? Math.round((item.count / currentAbonos.length) * 100) : 0}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="print:shadow-none">
                            <CardHeader className="pb-3 print:py-2 print:pb-1">
                                <CardTitle className="text-base print:text-sm">Tipos de abono</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:pt-1 print:pb-0">
                                {isLoading ? (
                                    <Skeleton className="h-40 print:h-28" />
                                ) : typeBreakdown.length === 0 ? (
                                    <div className="text-sm text-slate-500 print:text-xs">Sin abonos activos en el periodo.</div>
                                ) : (
                                    <div className="space-y-3 print:space-y-2">
                                        {typeBreakdown.map((item) => (
                                            <div key={item.label} className="flex items-center gap-3">
                                                <div className="w-32 text-sm font-medium text-slate-700 print:w-24 print:text-xs">{item.label}</div>
                                                <div className="h-2 flex-1 rounded bg-slate-200 print:h-[6px]">
                                                    <div
                                                        className="h-2 rounded bg-indigo-500 print:h-[6px]"
                                                        style={{
                                                            width: `${currentAbonos.length > 0 ? Math.max(4, (item.count / currentAbonos.length) * 100) : 4}%`
                                                        }}
                                                    />
                                                </div>
                                                <div className="w-12 text-right text-xs text-slate-500 print:w-10">
                                                    {currentAbonos.length > 0 ? Math.round((item.count / currentAbonos.length) * 100) : 0}%
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Vencimientos proximos</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {isLoading ? (
                                <Skeleton className="h-40 print:h-28" />
                            ) : upcomingExpirations.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay abonos por vencer dentro de los proximos 30 dias.
                                </div>
                            ) : (
                                <div className="space-y-2 print:space-y-[6px]">
                                    {upcomingExpirations.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm print:px-2 print:py-1.5 print:text-xs"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-700">{item.titular}</span>
                                                <span className="text-xs text-slate-500">
                                                    {item.type} - {item.zone} - #{item.id}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-slate-700 print:text-xs">
                                                    {item.end.toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-slate-500">{item.remaining} dias restantes</div>
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
                            {isLoading ? (
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
