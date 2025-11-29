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
import { HorarioFranja } from "@/lib/types/horarios";

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

function getOperatingHours(horarios: HorarioFranja[]): number[] {
    const hours = new Set<number>();
    horarios.forEach(h => {
        const [startH] = h.hora_apertura.split(':').map(Number);
        const [endH] = h.hora_cierre.split(':').map(Number);
        for (let hour = startH; hour <= endH; hour++) {
            hours.add(hour);
        }
    });
    return Array.from(hours).sort((a, b) => a - b);
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
    const [horarios, setHorarios] = useState<HorarioFranja[]>([]);

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
                const [historyRes, plazasRes, horariosRes] = await Promise.all([
                    fetch(`/api/parking/history?est_id=${estId}`),
                    fetch(`/api/plazas?est_id=${estId}`),
                    fetch(`/api/estacionamiento/horarios?est_id=${estId}`)
                ]);

                const historyJson = await historyRes.json();
                const plazasJson: PlazasApi = await plazasRes.json();

                const rows: HistoryEntry[] = Array.isArray(historyJson.history)
                    ? historyJson.history
                    : (historyJson || []);

                setHistory(rows);

                const total = Array.isArray(plazasJson?.plazas) ? plazasJson.plazas.length : 0;
                setTotalPlazas(total);

                if (horariosRes.ok) {
                    const horariosJson = await horariosRes.json();
                    setHorarios(horariosJson.horarios || []);
                } else {
                    setHorarios([]);
                }
            } catch (error) {
                console.error("Error al cargar movimientos diarios:", error);
                setHistory([]);
                setTotalPlazas(0);
                setHorarios([]);
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

    const vehicleTypeDistribution = useMemo(() => {
        const types: Record<string, number> = { AUT: 0, MOT: 0, CAM: 0, Desconocido: 0 };

        normalizedHistory.forEach((event) => {
            const type = event.raw.catv_segmento || "Desconocido";
            types[type] = (types[type] || 0) + 1;
        });

        const total = Object.values(types).reduce((sum, count) => sum + count, 0);

        return Object.entries(types)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => ({
                name: type === "AUT" ? "Autos" : type === "MOT" ? "Motos" : type === "CAM" ? "Camionetas" : "Desconocido",
                value: Math.round((count / Math.max(1, total)) * 100),
                count: count
            }))
            .sort((a, b) => b.value - a.value);
    }, [normalizedHistory]);

    const insights = useMemo(() => {
        if (loading) return [];
        const list: string[] = [];

        if (flowSeries.peakEntryValue > 0) {
            list.push(
                `La hora de mayor ingreso fue a las ${formatHourLabel(flowSeries.peakEntryHour)} con ${flowSeries.peakEntryValue} vehículos.`
            );
        }
        if (flowSeries.peakExitValue > 0) {
            list.push(
                `La hora de mayor salida fue a las ${formatHourLabel(flowSeries.peakExitHour)} con ${flowSeries.peakExitValue} vehículos.`
            );
        }
        if (stayDistribution.total > 0) {
            const corta = stayDistribution.a + stayDistribution.b;
            if (corta >= 60) {
                list.push(`El ${corta}% de los vehículos permanecieron menos de 3 horas.`);
            } else if (stayDistribution.d >= 40) {
                list.push(`Un ${stayDistribution.d}% de los vehículos permanecieron más de 6 horas.`);
            }
        }
        if (occupancyBlocks.peak.occupancy > 0 && totalPlazas > 0) {
            const peakPct = Math.round((occupancyBlocks.peak.occupancy / totalPlazas) * 100);
            list.push(
                `El pico de ocupación fue ${occupancyBlocks.peak.label} con ${occupancyBlocks.peak.occupancy} vehículos (${peakPct}%).`
            );
        }
        if (baseStats.current.reentryRate > 0) {
            list.push(`El ${Math.round(baseStats.current.reentryRate)}% de los vehículos ingresaron más de una vez.`);
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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 print:grid-cols-2 print:gap-2">
                        {loading ? (
                            Array.from({ length: 2 }).map((_, index) => (
                                <Skeleton key={index} className="h-24 print:h-20" />
                            ))
                        ) : (
                            <>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Ingresos del día</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-bold print:text-2xl">{baseStats.current.entries}</div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Egresos del día</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-bold print:text-2xl">{baseStats.current.exits}</div>
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
                                        ingresos: {
                                            label: "Entradas",
                                            color: "#10b981",
                                        },
                                        egresos: {
                                            label: "Salidas",
                                            color: "#ef4444",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={(() => {
                                                const operatingHours = getOperatingHours(horarios);
                                                return flowSeries.entriesByHour
                                                    .map((entries, hour) => ({
                                                        hour: `${String(hour).padStart(2, "0")}h`,
                                                        ingresos: entries,
                                                        egresos: flowSeries.exitsByHour[hour],
                                                    }))
                                                    .filter((item) => {
                                                        const hour = parseInt(item.hour);
                                                        return operatingHours.length === 0 || operatingHours.includes(hour);
                                                    });
                                            })()}
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
                                                            name === "ingresos" ? "Entradas" : "Salidas",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Legend />
                                            <Bar
                                                dataKey="ingresos"
                                                radius={[4, 4, 0, 0]}
                                                fill="#10b981"
                                            />
                                            <Bar
                                                dataKey="egresos"
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
                            <CardTitle className="text-base print:text-sm">Tipos de vehículos</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : vehicleTypeDistribution.length === 0 ? (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No se registraron vehículos en el período seleccionado.
                                </div>
                            ) : (
                                <ChartContainer
                                    config={{
                                        percentage: {
                                            label: "Porcentaje",
                                            color: "#3b82f6",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={vehicleTypeDistribution}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={true}
                                                label={({ name, value }) => `${name}: ${value}%`}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                <Cell fill="#3b82f6" />
                                                <Cell fill="#10b981" />
                                                <Cell fill="#f59e0b" />
                                                <Cell fill="#8b5cf6" />
                                            </Pie>
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value, name, props) => [
                                                            `${value}% (${props.payload.count} vehículos)`,
                                                            props.payload.name,
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
                                <Skeleton className="h-32 print:h-24" />
                            ) : insights.length ? (
                                <ul className="space-y-2 print:space-y-1">
                                    {insights.map((insight, i) => (
                                        <li key={i} className="flex gap-2 text-sm print:text-xs">
                                            <span className="text-blue-600 font-bold">•</span>
                                            <span className="text-slate-700">{insight}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No se generó información relevante para el período seleccionado.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
