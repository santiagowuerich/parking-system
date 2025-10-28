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
};

interface TurnoRecord {
    tur_id: number;
    play_id: number;
    est_id: number;
    tur_fecha: string;
    tur_fecha_salida?: string | null;
    tur_hora_entrada: string;
    tur_hora_salida: string | null;
    tur_estado: string;
    caja_inicio: number | null;
    caja_final: number | null;
    usuario?: {
        usu_id: number;
        nombre: string;
        apellido: string;
        email: string;
    };
}

interface NormalizedHistory {
    entry: Date | null;
    exit: Date | null;
    fee: number;
}

interface TurnoComputed {
    turno: TurnoRecord;
    start: Date;
    end: Date;
    operations: number;
    ingresos: number;
    incidenceCount: number;
    incidenceRate: number;
    compliance: number;
    efficiency: number;
    entries: number;
    exits: number;
    actualHours: number;
    employeeName: string;
    shiftLabel: string;
}

interface SummaryMetrics {
    avgMovements: number;
    avgIncome: number;
    avgIncidence: number;
    avgCompliance: number;
    avgEfficiency: number;
}

function clamp01(value: number) {
    if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function diffDescriptor(current: number, previous: number, isPercent = false) {
    if (!Number.isFinite(previous) || previous === 0) {
        if (!Number.isFinite(current) || current === 0) {
            return { label: "vs periodo anterior: sin cambios", tone: "neutral" as const };
        }
        return { label: "vs periodo anterior: +100%", tone: "positive" as const };
    }
    const delta = current - previous;
    const percent = (delta / previous) * 100;
    if (Math.abs(percent) < 0.5) {
        return { label: "vs periodo anterior: estable", tone: "neutral" as const };
    }
    const rounded = percent > 99 ? Math.round(percent) : Math.round(percent * 10) / 10;
    const sign = percent > 0 ? "+" : "";
    const suffix = isPercent ? "%" : "%";
    return {
        label: `vs periodo anterior: ${sign}${rounded}${suffix}`,
        tone: percent > 0 ? ("positive" as const) : ("negative" as const)
    };
}

function parseTurnoInstant(dateStr: string, timeStr: string | null, fallbackHours: number) {
    const base = new Date(`${dateStr}T${timeStr ?? "00:00"}`);
    if (timeStr) return base;
    return new Date(base.getTime() + fallbackHours * 60 * 60 * 1000);
}

function getTurnoEnd(turno: TurnoRecord, fallbackHours: number) {
    if (turno.tur_hora_salida) {
        const dateStr = turno.tur_fecha_salida || turno.tur_fecha;
        return new Date(`${dateStr}T${turno.tur_hora_salida}`);
    }
    return new Date(parseTurnoInstant(turno.tur_fecha, turno.tur_hora_entrada, 0).getTime() + fallbackHours * 60 * 60 * 1000);
}

function getShiftLabel(startHour: number) {
    if (startHour >= 5 && startHour < 13) return "Turno manana";
    if (startHour >= 13 && startHour < 21) return "Turno tarde";
    return "Turno noche";
}

function normalizeHistory(history: HistoryEntry[]): NormalizedHistory[] {
    return history.map((item) => ({
        entry: item.entry_time ? new Date(item.entry_time) : null,
        exit: item.exit_time ? new Date(item.exit_time) : null,
        fee: item.fee && Number.isFinite(item.fee) ? Number(item.fee) : 0
    }));
}

function computeStats(turnos: TurnoRecord[], history: NormalizedHistory[]) {
    if (turnos.length === 0) {
        return {
            detailed: [] as TurnoComputed[],
            summary: {
                avgMovements: 0,
                avgIncome: 0,
                avgIncidence: 0,
                avgCompliance: 0,
                avgEfficiency: 0
            } as SummaryMetrics
        };
    }

    const expectedHours = 8;
    const perTurno = turnos.map((turno) => {
        const start = parseTurnoInstant(turno.tur_fecha, turno.tur_hora_entrada, 0);
        const end = getTurnoEnd(turno, expectedHours);
        const employeeName = turno.usuario
            ? `${turno.usuario.nombre || ""} ${turno.usuario.apellido || ""}`.trim() || `Empleado ${turno.play_id}`
            : `Empleado ${turno.play_id}`;
        const shiftLabel = getShiftLabel(start.getHours());

        let entries = 0;
        let exits = 0;
        let ingresos = 0;
        let incidenceCount = 0;

        history.forEach((event) => {
            if (event.entry && event.entry >= start && event.entry < end) {
                entries += 1;
            }
            if (event.exit && event.exit >= start && event.exit < end) {
                exits += 1;
                if (event.fee <= 0) {
                    incidenceCount += 1;
                } else {
                    ingresos += event.fee;
                }
            }
        });

        const operations = entries + exits;
        const incidenceRate = operations > 0 ? incidenceCount / Math.max(1, operations) : 0;
        const durationHours = Math.max(0, (end.getTime() - start.getTime()) / (60 * 60 * 1000));
        const compliance = expectedHours > 0 ? clamp01(durationHours / expectedHours) : 0;

        return {
            turno,
            start,
            end,
            operations,
            ingresos,
            incidenceCount,
            incidenceRate,
            compliance,
            entries,
            exits,
            actualHours: durationHours,
            employeeName,
            shiftLabel
        };
    });

    const maxOperations = perTurno.reduce((max, item) => Math.max(max, item.operations), 0) || 1;
    const maxIncome = perTurno.reduce((max, item) => Math.max(max, item.ingresos), 0) || 1;

    const detailed: TurnoComputed[] = perTurno.map((item) => {
        const moveScore = clamp01(item.operations / maxOperations);
        const incomeScore = clamp01(item.ingresos / maxIncome);
        const efficiencyScore = (moveScore * 0.4) + (incomeScore * 0.3) + ((1 - clamp01(item.incidenceRate)) * 0.3);
        return {
            ...item,
            efficiency: Math.round(efficiencyScore * 100)
        };
    });

    const count = detailed.length;
    const summary: SummaryMetrics = {
        avgMovements: count ? detailed.reduce((sum, item) => sum + item.operations, 0) / count : 0,
        avgIncome: count ? detailed.reduce((sum, item) => sum + item.ingresos, 0) / count : 0,
        avgIncidence: count ? (detailed.reduce((sum, item) => sum + item.incidenceRate, 0) / count) * 100 : 0,
        avgCompliance: count ? (detailed.reduce((sum, item) => sum + item.compliance, 0) / count) * 100 : 0,
        avgEfficiency: count ? detailed.reduce((sum, item) => sum + item.efficiency, 0) / count : 0
    };

    return { detailed, summary };
}

function getWeekKey(date: Date) {
    const temp = new Date(date);
    const day = (temp.getDay() + 6) % 7;
    temp.setDate(temp.getDate() - day);
    temp.setHours(0, 0, 0, 0);
    return temp.toISOString().slice(0, 10);
}

function formatDateParam(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function TurnosReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [loading, setLoading] = useState(true);
    const [turnosRaw, setTurnosRaw] = useState<TurnoRecord[]>([]);
    const [historyRaw, setHistoryRaw] = useState<HistoryEntry[]>([]);
    const printRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef<HTMLDivElement>(null);
    const [contentScale, setContentScale] = useState(1);
    const lastScaleRef = useRef(1);

    const handlePrint = useReactToPrint({
        documentTitle: "Reporte - Desempeno de Turnos",
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
    }, [turnosRaw, historyRaw, dateRange]);

    useEffect(() => {
        if (!estId) return;
        const loadData = async () => {
            setLoading(true);
            try {
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
                const prevTo = new Date(from.getTime() - dayMs);
                const prevFrom = new Date(prevTo.getTime() - (periodDays - 1) * dayMs);

                const params = new URLSearchParams({
                    est_id: String(estId),
                    fecha_desde: formatDateParam(prevFrom),
                    fecha_hasta: formatDateParam(to)
                });

                const [turnosResponse, historyResponse] = await Promise.all([
                    fetch(`/api/turnos/gestion?${params}`),
                    fetch(`/api/parking/history?est_id=${estId}`)
                ]);

                if (turnosResponse.ok) {
                    const data = await turnosResponse.json();
                    setTurnosRaw(Array.isArray(data.turnos) ? data.turnos : []);
                } else {
                    setTurnosRaw([]);
                }

                if (historyResponse.ok) {
                    const historyJson = await historyResponse.json();
                    const rows: HistoryEntry[] = Array.isArray(historyJson.history)
                        ? historyJson.history
                        : (historyJson || []);
                    setHistoryRaw(rows);
                } else {
                    setHistoryRaw([]);
                }
            } catch (error) {
                console.error("Error cargando datos de turnos:", error);
                setTurnosRaw([]);
                setHistoryRaw([]);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [estId, dateRange]);

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
        const prevTo = new Date(from.getTime() - dayMs);
        const prevFrom = new Date(prevTo.getTime() - (periodDays - 1) * dayMs);
        return { from, to, prevFrom, prevTo };
    }, [dateRange]);

    const historyNormalized = useMemo(() => normalizeHistory(historyRaw), [historyRaw]);

    const { currentTurnos, previousTurnos } = useMemo(() => {
        const current: TurnoRecord[] = [];
        const previous: TurnoRecord[] = [];
        turnosRaw.forEach((turno) => {
            const start = parseTurnoInstant(turno.tur_fecha, turno.tur_hora_entrada, 0);
            if (start >= rangeInfo.from && start <= rangeInfo.to) {
                current.push(turno);
            } else if (start >= rangeInfo.prevFrom && start <= rangeInfo.prevTo) {
                previous.push(turno);
            }
        });
        return { currentTurnos: current, previousTurnos: previous };
    }, [turnosRaw, rangeInfo.from, rangeInfo.to, rangeInfo.prevFrom, rangeInfo.prevTo]);

    const { detailed: currentComputed, summary: currentSummary } = useMemo(
        () => computeStats(currentTurnos, historyNormalized),
        [currentTurnos, historyNormalized]
    );

    const previousSummary = useMemo(
        () => computeStats(previousTurnos, historyNormalized).summary,
        [previousTurnos, historyNormalized]
    );

    const efficiencyByEmployee = useMemo(() => {
        const map = new Map<string, { efficiency: number; count: number; operations: number }>();
        currentComputed.forEach((item) => {
            const key = item.employeeName || `Empleado ${item.turno.play_id}`;
            const entry = map.get(key) || { efficiency: 0, count: 0, operations: 0 };
            entry.efficiency += item.efficiency;
            entry.operations += item.operations;
            entry.count += 1;
            map.set(key, entry);
        });
        return Array.from(map.entries())
            .map(([name, data]) => ({
                name,
                efficiency: data.count ? Math.round(data.efficiency / data.count) : 0,
                operations: data.operations
            }))
            .sort((a, b) => b.efficiency - a.efficiency)
            .slice(0, 8);
    }, [currentComputed]);

    const trendSeries = useMemo(() => {
        const weekly = new Map<string, { sum: number; count: number }>();
        currentComputed.forEach((item) => {
            const key = getWeekKey(item.start);
            const entry = weekly.get(key) || { sum: 0, count: 0 };
            entry.sum += item.efficiency;
            entry.count += 1;
            weekly.set(key, entry);
        });
        return Array.from(weekly.entries())
            .sort((a, b) => (a[0] > b[0] ? 1 : -1))
            .map(([week, data]) => ({ week, value: data.count ? Math.round(data.sum / data.count) : 0 }));
    }, [currentComputed]);

    const shiftHighlights = useMemo(() => {
        const map = new Map<string, { movements: number; income: number; count: number; efficiency: number }>();
        currentComputed.forEach((item) => {
            const key = item.shiftLabel;
            const entry = map.get(key) || { movements: 0, income: 0, count: 0, efficiency: 0 };
            entry.movements += item.operations;
            entry.income += item.ingresos;
            entry.efficiency += item.efficiency;
            entry.count += 1;
            map.set(key, entry);
        });
        return Array.from(map.entries()).map(([shift, data]) => ({
            shift,
            avgMovements: data.count ? data.movements / data.count : 0,
            avgIncome: data.count ? data.income / data.count : 0,
            avgEfficiency: data.count ? data.efficiency / data.count : 0
        }));
    }, [currentComputed]);

    const insights = useMemo(() => {
        const list: string[] = [];
        if (currentComputed.length === 0) return list;

        const bestEmployee = efficiencyByEmployee[0];
        if (bestEmployee) {
            list.push(`${bestEmployee.name} lidera la eficiencia con ${bestEmployee.efficiency} puntos y procesa ${bestEmployee.operations} movimientos por turno.`);
        }

        const shiftByIncome = [...shiftHighlights].sort((a, b) => b.avgIncome - a.avgIncome)[0];
        if (shiftByIncome && shiftByIncome.avgIncome > 0) {
            list.push(`${shiftByIncome.shift} genera en promedio ${formatCurrency(shiftByIncome.avgIncome || 0)} por turno.`);
        }

        if (currentSummary.avgIncidence > 3) {
            list.push(`La tasa de incidencias promedio es ${currentSummary.avgIncidence.toFixed(1)}%, superior al objetivo del 3%.`);
        } else if (currentSummary.avgEfficiency > 0) {
            list.push(`La eficiencia global promedia ${currentSummary.avgEfficiency.toFixed(1)} puntos en el periodo analizado.`);
        }

        return list;
    }, [currentComputed, efficiencyByEmployee, shiftHighlights, currentSummary.avgIncidence, currentSummary.avgEfficiency]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Desempeno de Turnos"
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
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Movimientos por turno</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-semibold print:text-xl">
                                            {currentSummary.avgMovements.toFixed(1)}
                                        </div>
                                        <div className={`text-xs ${diffDescriptor(currentSummary.avgMovements, previousSummary.avgMovements).tone === "positive" ? "text-emerald-600" : diffDescriptor(currentSummary.avgMovements, previousSummary.avgMovements).tone === "negative" ? "text-red-600" : "text-slate-500"}`}>
                                            {diffDescriptor(currentSummary.avgMovements, previousSummary.avgMovements).label}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Ingresos promedio</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-semibold print:text-xl">
                                            {formatCurrency(currentSummary.avgIncome || 0)}
                                        </div>
                                        <div className={`text-xs ${diffDescriptor(currentSummary.avgIncome, previousSummary.avgIncome).tone === "positive" ? "text-emerald-600" : diffDescriptor(currentSummary.avgIncome, previousSummary.avgIncome).tone === "negative" ? "text-red-600" : "text-slate-500"}`}>
                                            {diffDescriptor(currentSummary.avgIncome, previousSummary.avgIncome).label}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Tasa de incidencias</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-semibold print:text-xl">
                                            {currentSummary.avgIncidence.toFixed(1)}%
                                        </div>
                                        <div className={`text-xs ${diffDescriptor(currentSummary.avgIncidence, previousSummary.avgIncidence, true).tone === "positive" ? "text-emerald-600" : diffDescriptor(currentSummary.avgIncidence, previousSummary.avgIncidence, true).tone === "negative" ? "text-red-600" : "text-slate-500"}`}>
                                            {diffDescriptor(currentSummary.avgIncidence, previousSummary.avgIncidence, true).label}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Cumplimiento de horario</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-semibold print:text-xl">
                                            {currentSummary.avgCompliance.toFixed(1)}%
                                        </div>
                                        <div className={`text-xs ${diffDescriptor(currentSummary.avgCompliance, previousSummary.avgCompliance, true).tone === "positive" ? "text-emerald-600" : diffDescriptor(currentSummary.avgCompliance, previousSummary.avgCompliance, true).tone === "negative" ? "text-red-600" : "text-slate-500"}`}>
                                            {diffDescriptor(currentSummary.avgCompliance, previousSummary.avgCompliance, true).label}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Ranking de eficiencia por empleado</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Comparativo de eficiencia ponderada (0-100) para los principales responsables de turno.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-48 print:h-32" />
                            ) : efficiencyByEmployee.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No se registraron turnos en el periodo seleccionado.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {efficiencyByEmployee.map((item) => (
                                        <div key={item.name} className="flex items-center gap-3">
                                            <div className="w-36 print:w-32 text-sm text-slate-600">{item.name}</div>
                                            <div className="flex-1 h-3 rounded bg-slate-200">
                                                <div className="h-3 rounded bg-indigo-500" style={{ width: `${item.efficiency}%` }} />
                                            </div>
                                            <div className="w-12 text-sm text-right">{item.efficiency}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Tendencia semanal de eficiencia</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-32 print:h-24" />
                            ) : trendSeries.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No hay datos suficientes para construir la serie temporal.
                                </div>
                            ) : (
                                <div className="flex items-end gap-2 h-40 print:h-28">
                                    {trendSeries.map((point) => (
                                        <div key={point.week} className="flex flex-col items-center gap-1">
                                            <div className="w-8 bg-emerald-500 rounded" style={{ height: `${Math.max(2, point.value)}%` }} title={`${point.week}: ${point.value}`} />
                                            <div className="text-[10px] text-slate-500">{point.week.slice(5)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Indicadores por turno</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-32 print:h-24" />
                            ) : shiftHighlights.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No se encontraron turnos en el periodo seleccionado.
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
                                    {shiftHighlights.map((shift) => (
                                        <div key={shift.shift} className="rounded-md border border-slate-200 p-3 print:p-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{shift.shift}</span>
                                            </div>
                                            <div className="mt-2 text-sm text-slate-600">
                                                Movimientos: <span className="font-semibold">{shift.avgMovements.toFixed(1)}</span>
                                            </div>
                                            <div className="text-sm text-slate-600">
                                                Ingresos: <span className="font-semibold">{formatCurrency(shift.avgIncome || 0)}</span>
                                            </div>
                                            <div className="text-sm text-slate-600">
                                                Eficiencia: <span className="font-semibold">{shift.avgEfficiency.toFixed(1)} pts</span>
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
                                <ul className="list-disc pl-5 space-y-1 text-sm print:text-xs print:space-y-1">
                                    {insights.map((text, idx) => (
                                        <li key={idx}>{text}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No se detectaron insights relevantes para el periodo.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
