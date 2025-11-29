
"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ReporteHeader } from "../../reporte-header";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, LineChart, Line, Pie, PieChart, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
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
const ABONO_PAYMENT_MATCHERS = ["abono", "extension"];

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

function buildExpiryBuckets(abonos: AbonoRecord[], referenceDate: Date) {
    const now = referenceDate.getTime();
    const buckets = [
        { label: "0-5 días", min: 0, max: 5, count: 0 },
        { label: "6-10 días", min: 6, max: 10, count: 0 },
        { label: "11-15 días", min: 11, max: 15, count: 0 },
        { label: "16-20 días", min: 16, max: 20, count: 0 },
        { label: "+20 días", min: 21, max: Infinity, count: 0 }
    ];

    abonos.forEach(abono => {
        const daysUntilExpiry = Math.ceil((abono.end.getTime() - now) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry >= 0) {
            const bucket = buckets.find(b => daysUntilExpiry >= b.min && daysUntilExpiry <= b.max);
            if (bucket) bucket.count++;
        }
    });

    return buckets;
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

            const fileName = `abonos-${new Date().toISOString().split('T')[0]}.pdf`;
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
                const response = await fetch(`/api/pagos?est_id=${estId}`);
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
        () => paymentsCurrent.filter((payment) => payment.kind.toLowerCase().includes("extension")).length,
        [paymentsCurrent]
    );
    const renewalsPrevious = useMemo(
        () => paymentsPrevious.filter((payment) => payment.kind.toLowerCase().includes("extension")).length,
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

    const expiryBuckets = useMemo(() => buildExpiryBuckets(abonos, rangeInfo.to), [abonos, rangeInfo.to]);

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
                onPrint={handlePrint}
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
                                                <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>{text}</div>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Total de Ingresos por Abonos</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = formatCurrency(revenueCurrent);
                                            return (
                                                <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>{text}</div>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>

                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Altas</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        {(() => {
                                            const text = newAbonosCurrent.length.toLocaleString();
                                            return (
                                                <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>{text}</div>
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
                                                <div className={`font-semibold leading-tight ${valueSizeClasses(text)}`}>{text}</div>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    <Card className="print:shadow-none">
                            <CardHeader className="pb-3 print:py-2 print:pb-1">
                                <CardTitle className="text-base print:text-sm">Tipos de abono</CardTitle>
                                <p className="text-sm text-slate-500 print:text-xs">
                                    Distribución de abonos activos por tipo.
                                </p>
                            </CardHeader>
                            <CardContent className="pt-0 print:pt-1 print:pb-2">
                                {isLoading ? (
                                    <Skeleton className="h-64 print:h-48" />
                                ) : typeBreakdown.length === 0 ? (
                                    <div className="text-sm text-slate-500 print:text-xs">Sin abonos activos en el periodo.</div>
                                ) : (
                                    <ChartContainer
                                        config={{
                                            count: {
                                                label: "Cantidad",
                                                color: "#6366f1",
                                            },
                                        }}
                                        className="h-[280px] w-full"
                                    >
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={typeBreakdown.map((item) => ({
                                                        name: item.label,
                                                        value: item.count,
                                                    }))}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    label={(entry) => {
                                                        const total = typeBreakdown.reduce((sum, item) => sum + item.count, 0);
                                                        const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
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
                                                                `${value} abonos`,
                                                                "Total",
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
                            <CardTitle className="text-base print:text-sm">Vencimientos próximos</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Cantidad de abonos próximos a vencer por rango de días.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {isLoading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : expiryBuckets.every((b) => b.count === 0) ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay abonos próximos a vencer.
                                </div>
                            ) : (
                                <ChartContainer
                                    config={{
                                        count: {
                                            label: "Cantidad",
                                            color: "#f59e0b",
                                        },
                                    }}
                                    className="h-[280px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={expiryBuckets}
                                            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 10 }}
                                                className="text-slate-600"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11 }}
                                                className="text-slate-600"
                                                label={{ value: "Cantidad", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value) => [
                                                            `${value} abonos`,
                                                            "Total",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="count"
                                                radius={[4, 4, 0, 0]}
                                                fill="#f59e0b"
                                            />
                                        </BarChart>
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
                            {isLoading ? (
                                <Skeleton className="h-24 print:h-16" />
                            ) : (
                                <ul className="space-y-2 text-sm print:space-y-1 print:text-xs">
                                    <li className="flex gap-2">
                                        <span className="text-blue-500 font-bold print:text-blue-600">•</span>
                                        <span>Total de abonos activos: <strong>{currentAbonos.length}</strong></span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-blue-500 font-bold print:text-blue-600">•</span>
                                        <span>Ingresos por abonos: <strong>{formatCurrency(revenueCurrent)}</strong></span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-blue-500 font-bold print:text-blue-600">•</span>
                                        <span>Nuevas altas: <strong>{newAbonosCurrent.length}</strong></span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-blue-500 font-bold print:text-blue-600">•</span>
                                        <span>Renovaciones: <strong>{renewalsCurrent}</strong></span>
                                    </li>
                                    {topType && (
                                        <li className="flex gap-2">
                                            <span className="text-blue-500 font-bold print:text-blue-600">•</span>
                                            <span>Tipo principal: <strong>{topType}</strong></span>
                                        </li>
                                    )}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
