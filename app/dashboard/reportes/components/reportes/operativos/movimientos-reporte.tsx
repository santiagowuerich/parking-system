"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface HistoryEntry {
    entry_time: string | null;
    exit_time: string | null;
    fee?: number | null;
    catv_segmento?: "AUT" | "MOT" | "CAM" | null;
    pla_zona?: string | null;
    vehiculo_patente?: string | null;
    veh_patente?: string | null;
    vehicle_plate?: string | null;
    patente?: string | null;
    placa?: string | null;
}

interface PlazasApi {
    plazas: Array<{
        pla_estado: "Libre" | "Ocupada" | "Abonado";
        plantillas?: { catv_segmento?: "AUT" | "MOT" | "CAM" } | null;
        pla_zona?: string | null;
    }>;
}

interface NormalizedHistory {
    raw: HistoryEntry;
    entry: Date | null;
    exit: Date | null;
    stayHours: number | null;
    identifier: string | null;
}

function hoursBetween(start: Date, end: Date) {
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    return diffMs / (1000 * 60 * 60);
}

function formatHourLabel(hour: number) {
    return `${hour.toString().padStart(2, "0")}:00`;
}

function formatHourRange(start: Date) {
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const startLabel = `${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")}`;
    const endLabel = `${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
    return `${startLabel} - ${endLabel}`;
}

function formatDuration(hoursValue: number) {
    if (!Number.isFinite(hoursValue)) return "0 h";
    const absolute = Math.max(0, hoursValue);
    const hours = Math.floor(absolute);
    const minutes = Math.round((absolute - hours) * 60);
    if (hours === 0) return `${minutes} min`;
    if (hours >= 8) return `${hours} h`;
    return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
}

function diffDescriptor(current: number, previous: number, suffix = "") {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
        return { label: "vs dia anterior: sin dato", tone: "neutral" as const };
    }
    if (previous === 0 && current === 0) {
        return { label: "vs dia anterior: sin cambios", tone: "neutral" as const };
    }
    if (previous === 0) {
        return { label: "vs dia anterior: +100%", tone: "positive" as const };
    }
    const delta = current - previous;
    const percent = (delta / previous) * 100;
    if (Math.abs(percent) < 0.5) {
        return { label: "vs dia anterior: estable", tone: "neutral" as const };
    }
    const rounded = percent > 99 ? Math.round(percent) : Math.round(percent * 10) / 10;
    const arrow = percent > 0 ? "+" : "";
    return {
        label: `vs dia anterior: ${arrow}${rounded}%${suffix}`,
        tone: percent > 0 ? ("positive" as const) : ("negative" as const)
    };
}

export function MovimientosReporte() {
    const { estId } = useAuth();
    const initialRange = useMemo(() => {
        const now = new Date();
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        const to = new Date(now);
        to.setHours(23, 59, 59, 999);
        return { from, to };
    }, []);

    const [dateRange, setDateRange] = useState<DateRange | undefined>(initialRange);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [totalPlazas, setTotalPlazas] = useState<number>(0);

    const printRef = useRef<HTMLDivElement>(null);

    // Función para generar PDF con html2canvas - TODO en una página A4
    const handlePrint = async () => {
        const element = printRef.current;
        if (!element) return;

        try {
            // Capturar elemento como canvas a resolución optimizada
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
            const pdfUsableHeight = pdfHeight - 10; // 5mm margins top y bottom

            // Calcular dimensiones de imagen con margins
            const imgWidth = pdfWidth - 10; // 5mm margins left y right
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Si la imagen no cabe en una página, escalarla
            let finalImgWidth = imgWidth;
            let finalImgHeight = imgHeight;

            if (imgHeight > pdfUsableHeight) {
                // Calcular factor de escala para que quepa en una página
                const scaleFactor = pdfUsableHeight / imgHeight;
                finalImgWidth = imgWidth * scaleFactor;
                finalImgHeight = pdfUsableHeight;
            }

            // Centrar horizontalmente si es necesario
            const xOffset = (pdfWidth - finalImgWidth) / 2;
            const yOffset = (pdfHeight - finalImgHeight) / 2;

            // Agregar imagen en una sola página A4
            pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalImgWidth, finalImgHeight);

            // Descargar PDF
            const fileName = `movimientos-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('Error al generar PDF:', error);
            alert('Error al generar el PDF. Por favor intenta nuevamente.');
        }
    };

    useEffect(() => {
        if (!estId) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const [historyRes, plazasRes] = await Promise.all([
                    fetch(`/api/parking/history?est_id=${estId}`),
                    fetch(`/api/plazas?est_id=${estId}`)
                ]);

                const historyJson = await historyRes.json();
                const plazasJson: PlazasApi = await plazasRes.json();

                const rows: HistoryEntry[] = Array.isArray(historyJson.history)
                    ? historyJson.history
                    : (historyJson || []);

                setHistory(rows);

                const total = Array.isArray(plazasJson?.plazas) ? plazasJson.plazas.length : 0;
                setTotalPlazas(total);
            } catch (error) {
                console.error("Error al cargar movimientos diarios:", error);
                setHistory([]);
                setTotalPlazas(0);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [estId]);

    const range = useMemo(() => {
        const from = dateRange?.from ? new Date(dateRange.from) : (() => {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            return start;
        })();
        const to = dateRange?.to ? new Date(dateRange.to) : (() => {
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            return end;
        })();
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        const dayMs = 24 * 60 * 60 * 1000;
        const dayCount = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / dayMs) || 1);
        const previousFrom = new Date(from.getTime() - dayMs);
        const previousTo = new Date(from.getTime() - 1);

        return { from, to, dayCount, previousFrom, previousTo };
    }, [dateRange]);

    const normalizedHistory = useMemo<NormalizedHistory[]>(() => {
        return history.map((item) => {
            const entry = item.entry_time ? new Date(item.entry_time) : null;
            const exit = item.exit_time ? new Date(item.exit_time) : null;
            const stayHours = entry && exit ? hoursBetween(entry, exit) : null;
            const identifier =
                item.vehiculo_patente ??
                item.veh_patente ??
                item.vehicle_plate ??
                item.patente ??
                item.placa ??
                null;

            return {
                raw: item,
                entry,
                exit,
                stayHours,
                identifier
            };
        });
    }, [history]);

    const baseStats = useMemo(() => {
        const compute = (start: Date, end: Date) => {
            let entries = 0;
            let exits = 0;
            const stayDurations: number[] = [];
            const identifiers = new Map<string, number>();

            normalizedHistory.forEach((event) => {
                if (event.entry && event.entry >= start && event.entry <= end) {
                    entries += 1;
                    if (event.identifier) {
                        identifiers.set(event.identifier, (identifiers.get(event.identifier) ?? 0) + 1);
                    }
                }
                if (event.exit && event.exit >= start && event.exit <= end) {
                    exits += 1;
                }
                if (event.entry && event.exit && event.exit >= start && event.exit <= end && event.stayHours !== null) {
                    stayDurations.push(event.stayHours);
                }
            });

            const repeatVehicles = Array.from(identifiers.values()).filter((v) => v > 1).length;
            const reentryRate = identifiers.size ? (repeatVehicles / identifiers.size) * 100 : 0;

            return {
                entries,
                exits,
                stayDurations,
                reentryRate,
                uniqueVehicles: identifiers.size
            };
        };

        return {
            current: compute(range.from, range.to),
            previous: compute(range.previousFrom, range.previousTo)
        };
    }, [normalizedHistory, range.from, range.to, range.previousFrom, range.previousTo]);

    const stayDistribution = useMemo(() => {
        const buckets = { a: 0, b: 0, c: 0, d: 0 };
        baseStats.current.stayDurations.forEach((hoursValue) => {
            if (hoursValue < 1) buckets.a += 1;
            else if (hoursValue < 3) buckets.b += 1;
            else if (hoursValue < 6) buckets.c += 1;
            else buckets.d += 1;
        });
        const total = Math.max(1, baseStats.current.stayDurations.length);
        return {
            a: Math.round((buckets.a / total) * 100),
            b: Math.round((buckets.b / total) * 100),
            c: Math.round((buckets.c / total) * 100),
            d: Math.round((buckets.d / total) * 100),
            raw: buckets,
            total
        };
    }, [baseStats.current.stayDurations]);

    const flowSeries = useMemo(() => {
        const entriesByHour = new Array(24).fill(0);
        const exitsByHour = new Array(24).fill(0);

        normalizedHistory.forEach((event) => {
            if (event.entry && event.entry >= range.from && event.entry <= range.to) {
                entriesByHour[event.entry.getHours()] += 1;
            }
            if (event.exit && event.exit >= range.from && event.exit <= range.to) {
                exitsByHour[event.exit.getHours()] += 1;
            }
        });

        const maxFlow = Math.max(1, ...entriesByHour, ...exitsByHour);

        const peakEntry = entriesByHour.reduce(
            (acc, value, hour) => (value > acc.value ? { hour, value } : acc),
            { hour: 0, value: 0 }
        );
        const peakExit = exitsByHour.reduce(
            (acc, value, hour) => (value > acc.value ? { hour, value } : acc),
            { hour: 0, value: 0 }
        );

        return {
            entriesByHour,
            exitsByHour,
            maxFlow,
            peakEntryHour: peakEntry.hour,
            peakEntryValue: peakEntry.value,
            peakExitHour: peakExit.hour,
            peakExitValue: peakExit.value
        };
    }, [normalizedHistory, range.from, range.to]);

    const occupancyBlocks = useMemo(() => {
        const msHour = 60 * 60 * 1000;
        const slotsCount = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / msHour));
        const slots: Array<{
            label: string;
            occupancy: number;
            entries: number;
            exits: number;
        }> = [];

        for (let i = 0; i < slotsCount; i++) {
            const slotStart = new Date(range.from.getTime() + i * msHour);
            const slotEnd = new Date(slotStart.getTime() + msHour);

            let occupancy = 0;
            let entries = 0;
            let exits = 0;

            normalizedHistory.forEach((event) => {
                const entryTime = event.entry ? event.entry.getTime() : Number.NEGATIVE_INFINITY;
                const exitTime = event.exit ? event.exit.getTime() : Number.POSITIVE_INFINITY;
                const slotStartTime = slotStart.getTime();
                const slotEndTime = slotEnd.getTime();

                if (entryTime < slotEndTime && exitTime > slotStartTime) {
                    occupancy += 1;
                }
                if (event.entry && event.entry >= slotStart && event.entry < slotEnd) {
                    entries += 1;
                }
                if (event.exit && event.exit >= slotStart && event.exit < slotEnd) {
                    exits += 1;
                }
            });

            slots.push({
                label: formatHourRange(slotStart),
                occupancy,
                entries,
                exits
            });
        }

        const peak = slots.reduce(
            (acc, slot) => (slot.occupancy > acc.occupancy ? { ...slot } : acc),
            slots[0] ?? { label: "00:00 - 01:00", occupancy: 0, entries: 0, exits: 0 }
        );

        const saturated = totalPlazas > 0
            ? slots.filter((slot) => slot.occupancy / totalPlazas >= 0.9).length
            : 0;

        const dead = slots.filter((slot) => slot.entries + slot.exits === 0).length;

        return {
            slots,
            peak,
            saturatedHours: saturated,
            deadHours: dead
        };
    }, [normalizedHistory, range.from, range.to, totalPlazas]);

    const rotacionPromedio = totalPlazas > 0
        ? (baseStats.current.entries / Math.max(1, totalPlazas * range.dayCount))
        : 0;

    const rotacionAnterior = totalPlazas > 0
        ? (baseStats.previous.entries / Math.max(1, totalPlazas))
        : 0;

    const promedioEstadia = baseStats.current.stayDurations.length
        ? baseStats.current.stayDurations.reduce((acc, value) => acc + value, 0) / baseStats.current.stayDurations.length
        : 0;

    const promedioEstadiaPrev = baseStats.previous.stayDurations.length
        ? baseStats.previous.stayDurations.reduce((acc, value) => acc + value, 0) / baseStats.previous.stayDurations.length
        : 0;

    const insights = useMemo(() => {
        if (loading) return [];
        const list: string[] = [];

        if (flowSeries.peakEntryValue > 0) {
            list.push(
                `El pico de ingresos se registro a las ${formatHourLabel(flowSeries.peakEntryHour)} con ${flowSeries.peakEntryValue} vehiculos.`
            );
        }
        if (flowSeries.peakExitValue > 0) {
            list.push(
                `Las salidas alcanzaron su maximo a las ${formatHourLabel(flowSeries.peakExitHour)} con ${flowSeries.peakExitValue} egresos.`
            );
        }
        if (stayDistribution.total > 0) {
            const corta = stayDistribution.a + stayDistribution.b;
            if (corta >= 60) {
                list.push(`El ${corta}% de las estadias finalizo antes de las 3 horas, lo que indica rotacion alta.`);
            } else if (stayDistribution.d >= 40) {
                list.push(`Un ${stayDistribution.d}% de los vehiculos permanecio mas de 6 horas, predominan estadias largas.`);
            }
        }
        if (occupancyBlocks.peak.occupancy > 0 && totalPlazas > 0) {
            const peakPct = Math.round((occupancyBlocks.peak.occupancy / totalPlazas) * 100);
            list.push(
                `La ocupacion llego a su maximo en el bloque ${occupancyBlocks.peak.label} con ${occupancyBlocks.peak.occupancy} plazas (${peakPct}% del total).`
            );
        }
        if (occupancyBlocks.deadHours > 0) {
            list.push(`Se detectaron ${occupancyBlocks.deadHours} horas sin movimientos, buen momento para tareas internas.`);
        }
        if (baseStats.current.reentryRate > 0) {
            list.push(`Los reingresos representaron el ${Math.round(baseStats.current.reentryRate)}% de las patentes identificadas.`);
        }

        return list;
    }, [
        loading,
        flowSeries.peakEntryValue,
        flowSeries.peakEntryHour,
        flowSeries.peakExitValue,
        flowSeries.peakExitHour,
        stayDistribution,
        occupancyBlocks,
        totalPlazas,
        baseStats.current.reentryRate
    ]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Movimientos diarios"
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
                    className="flex h-full flex-col gap-6 px-6 py-6"
                >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-24" />
                            ))
                        ) : (
                            <>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Ingresos del dia</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-semibold print:text-xl">{baseStats.current.entries}</div>
                                        <div
                                            className={`text-xs ${
                                                diffDescriptor(baseStats.current.entries, baseStats.previous.entries).tone === "positive"
                                                    ? "text-emerald-600"
                                                    : diffDescriptor(baseStats.current.entries, baseStats.previous.entries).tone === "negative"
                                                        ? "text-red-600"
                                                        : "text-slate-500"
                                            }`}
                                        >
                                            {diffDescriptor(baseStats.current.entries, baseStats.previous.entries).label}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Egresos del dia</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-semibold print:text-xl">{baseStats.current.exits}</div>
                                        <div
                                            className={`text-xs ${
                                                diffDescriptor(baseStats.current.exits, baseStats.previous.exits).tone === "positive"
                                                    ? "text-emerald-600"
                                                    : diffDescriptor(baseStats.current.exits, baseStats.previous.exits).tone === "negative"
                                                        ? "text-red-600"
                                                        : "text-slate-500"
                                            }`}
                                        >
                                            {diffDescriptor(baseStats.current.exits, baseStats.previous.exits).label}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Rotacion promedio</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-semibold print:text-xl">
                                            {totalPlazas > 0 ? (rotacionPromedio * 100).toFixed(1) : "0"}%
                                        </div>
                                        <div
                                            className={`text-xs ${
                                                diffDescriptor(rotacionPromedio, rotacionAnterior).tone === "positive"
                                                    ? "text-emerald-600"
                                                    : diffDescriptor(rotacionPromedio, rotacionAnterior).tone === "negative"
                                                        ? "text-red-600"
                                                        : "text-slate-500"
                                            }`}
                                        >
                                            {diffDescriptor(rotacionPromedio, rotacionAnterior).label}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Permanencia promedio</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-semibold print:text-xl">
                                            {formatDuration(promedioEstadia)}
                                        </div>
                                        <div
                                            className={`text-xs ${
                                                diffDescriptor(promedioEstadia, promedioEstadiaPrev).tone === "positive"
                                                    ? "text-emerald-600"
                                                    : diffDescriptor(promedioEstadia, promedioEstadiaPrev).tone === "negative"
                                                        ? "text-red-600"
                                                        : "text-slate-500"
                                            }`}
                                        >
                                            {diffDescriptor(promedioEstadia, promedioEstadiaPrev).label}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Flujo horario de movimientos</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Entradas en verde, salidas en rojo. Permite detectar picos y valles de actividad.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : (
                                <ChartContainer
                                    config={{
                                        entries: {
                                            label: "Entradas",
                                            color: "#10b981",
                                        },
                                        exits: {
                                            label: "Salidas",
                                            color: "#ef4444",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={flowSeries.entriesByHour.map((entries, hour) => ({
                                                hour: `${String(hour).padStart(2, "0")}h`,
                                                entries,
                                                exits: flowSeries.exitsByHour[hour],
                                            }))}
                                            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                            <XAxis
                                                dataKey="hour"
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
                                                            `${value} vehículos`,
                                                            name === "entries" ? "Entradas" : "Salidas",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Legend />
                                            <Bar
                                                dataKey="entries"
                                                radius={[4, 4, 0, 0]}
                                                fill="#10b981"
                                            />
                                            <Bar
                                                dataKey="exits"
                                                radius={[4, 4, 0, 0]}
                                                fill="#ef4444"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Distribucion de permanencias</CardTitle>
                            <p className="text-sm text-slate-500 print:text-xs">
                                Porcentaje de estadias segun el tiempo que cada vehiculo permanecio en el predio.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : baseStats.current.stayDurations.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No se registraron estadias completas en el periodo seleccionado.
                                </div>
                            ) : (
                                <ChartContainer
                                    config={{
                                        percentage: {
                                            label: "% de Estadías",
                                            color: "#3b82f6",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={[
                                                { label: "Menos de 1h", percentage: stayDistribution.a },
                                                { label: "1-3 horas", percentage: stayDistribution.b },
                                                { label: "3-6 horas", percentage: stayDistribution.c },
                                                { label: "Más de 6h", percentage: stayDistribution.d }
                                            ]}
                                            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11 }}
                                                className="text-slate-600"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11 }}
                                                className="text-slate-600"
                                                label={{ value: "Porcentaje (%)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                                                domain={[0, 100]}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value) => [
                                                            `${value}%`,
                                                            "Porcentaje de vehículos",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="percentage"
                                                radius={[6, 6, 0, 0]}
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
                            <CardTitle className="text-base print:text-sm">Indicadores de eficiencia</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-32" />
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
                                    <div className="rounded-md border border-slate-200 p-3 print:p-2">
                                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Pico de ocupacion</div>
                                        <div className="mt-1 text-lg font-semibold print:text-base">
                                            {occupancyBlocks.peak.occupancy} vehiculos
                                        </div>
                                        <div className="text-xs text-slate-500">{occupancyBlocks.peak.label}</div>
                                    </div>
                                    <div className="rounded-md border border-slate-200 p-3 print:p-2">
                                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Horas sobre 90%</div>
                                        <div className="mt-1 text-lg font-semibold print:text-base">
                                            {occupancyBlocks.saturatedHours}
                                        </div>
                                        <div className="text-xs text-slate-500">Congestion alta</div>
                                    </div>
                                    <div className="rounded-md border border-slate-200 p-3 print:p-2">
                                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Horas sin movimientos</div>
                                        <div className="mt-1 text-lg font-semibold print:text-base">
                                            {occupancyBlocks.deadHours}
                                        </div>
                                        <div className="text-xs text-slate-500">Ventanas operativas</div>
                                    </div>
                                    <div className="rounded-md border border-slate-200 p-3 print:p-2">
                                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Reingresos detectados</div>
                                        <div className="mt-1 text-lg font-semibold print:text-base">
                                            {Math.round(baseStats.current.reentryRate)}%
                                        </div>
                                        <div className="text-xs text-slate-500">Patentes repetidas</div>
                                    </div>
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
                                <Skeleton className="h-24" />
                            ) : insights.length ? (
                                <ul className="list-disc space-y-1 pl-5 text-sm print:space-y-1 print:text-xs">
                                    {insights.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No se generaron insights relevantes para el periodo seleccionado.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
