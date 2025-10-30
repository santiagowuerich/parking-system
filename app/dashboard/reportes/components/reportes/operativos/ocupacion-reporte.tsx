"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";

type VehicleType = "ALL" | "AUT" | "MOT" | "CAM";

interface HistoryEntry {
    entry_time: string | null;
    exit_time: string | null;
    fee?: number | null;
    catv_segmento?: "AUT" | "MOT" | "CAM" | null;
    pla_zona?: string | null;
}

interface PlazasApi {
    plazas: Array<{
        pla_estado: "Libre" | "Ocupada" | "Abonado";
        plantillas?: { catv_segmento?: "AUT" | "MOT" | "CAM" } | null;
        pla_zona?: string | null;
    }>;
}

function hoursBetween(start: date, end: date) {
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    return diffMs / (1000 * 60 * 60);
}

function clamp01(n: number) {
    if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
}

export function OcupacionReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [vehicleType, setVehicleType] = useState<VehicleType>("ALL");
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [totalPlazas, setTotalPlazas] = useState<number>(0);
    const [zonas, setZonas] = useState<Record<string, { total: number }>>({});
    const printRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef<HTMLDivElement>(null);
    const [contentScale, setContentScale] = useState(1);
    const lastScaleRef = useRef(1);

    // Ajustar el contenido para caber en A4 (vertical)
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
    }, [history, totalPlazas, zonas, vehicleType, dateRange, loading]);

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
                // Historial
                const res = await fetch(`/api/parking/history?est_id=${estId}`);
                const json = await res.json();
                const rows: HistoryEntry[] = Array.isArray(json.history) ? json.history : (json || []);
                // Plazas actuales
                const plazasRes = await fetch(`/api/plazas?est_id=${estId}`);
                const plazasJson: PlazasApi = await plazasRes.json();
                const total = Array.isArray(plazasJson?.plazas) ? plazasJson.plazas.length : 0;
                setTotalPlazas(total);
                const z: Record<string, { total: number }> = {};
                (plazasJson?.plazas || []).forEach(p => {
                    const key = p.pla_zona || "General";
                    z[key] = z[key] || { total: 0 };
                    z[key].total += 1;
                });
                setZonas(z);

                // Filtro temporal + tipo de vehculo (se aplicar luego en clculos)
                const filtered = rows.filter((r) => {
                    const entry = r.entry_time ? new Date(r.entry_time) : null;
                    const exit = r.exit_time ? new Date(r.exit_time) : null;
                    const inRange = (
                        (entry && entry <= to && entry >= from) ||
                        (exit && exit <= to && exit >= from) ||
                        (entry && exit && entry < from && exit > to)
                    );
                    return inRange;
                });
                setHistory(filtered);
            } catch (e) {
                console.error("Error cargando datos de Ocupacion:", e);
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [estId, dateRange]);

    // Clculos
    const {
        avgOccupancy,
        peak,
        avgAvailability,
        heatmap,
        zonaOcupacion,
        dailySeries,
        stayDistribution,
        insights
    } = useMemo(() => {
        const result = {
            avgOccupancy: 0,
            peak: { value: 0, label: "-" },
            avgAvailability: 0,
            heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)),
            zonaOcupacion: [] as Array<{ zona: string; ocupacion: number; delta?: number }>,
            dailySeries: [] as Array<{ day: string; value: number }>,
            stayDistribution: { a: 0, b: 0, c: 0, d: 0 },
            insights: [] as string[]
        };

        if (!history.length || totalPlazas === 0) {
            // Sin datos suficientes
            result.avgAvailability = 0;
            return result;
        }

        const filteredByType = history.filter(h => {
            if (vehicleType === "ALL") return true;
            return (h.catv_segmento || undefined) === vehicleType;
        });

        const from = dateRange?.from ? new Date(dateRange.from) : new Date(new Date().setDate(new Date().getDate() - 30));
        const to = dateRange?.to ? new Date(dateRange.to) : new Date();
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);

        // Construir buckets por hora para heatmap y para series diarias
        const dayCount = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
        const hoursBuckets: Record<string, number> = {};
        const dayBuckets: Record<string, { occHours: number; hours: number }> = {};

        // Recorrer cada registro y sumar Ocupacion por hora en el intervalo
        filteredByType.forEach((r) => {
            const start = r.entry_time ? new Date(r.entry_time) : from;
            const end = r.exit_time ? new Date(r.exit_time) : to;
            const s = new Date(Math.max(start.getTime(), from.getTime()));
            const e = new Date(Math.min(end.getTime(), to.getTime()));
            if (e <= s) return;

            // Iterar hora por hora
            const cursor = new Date(s);
            cursor.setMinutes(0, 0, 0);
            while (cursor < e) {
                const hourKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}-${cursor.getHours()}`;
                hoursBuckets[hourKey] = (hoursBuckets[hourKey] || 0) + 1;
                const nextHour = new Date(cursor);
                nextHour.setHours(cursor.getHours() + 1);
                cursor.setHours(cursor.getHours() + 1);
            }

            // Distribucin de estadias
            const durHrs = hoursBetween(start, end);
            if (durHrs <= 1) result.stayDistribution.a += 1; else if (durHrs <= 3) result.stayDistribution.b += 1; else if (durHrs <= 6) result.stayDistribution.c += 1; else result.stayDistribution.d += 1;
        });

        // Calcular heatmap y mtricas globales
        let totalHourPoints = 0;
        let sumPercent = 0;
        Object.entries(hoursBuckets).forEach(([key, count]) => {
            const [y, m, d, h] = key.split("-").map(Number);
            const date = new Date(y, m, d, h);
            const weekday = (date.getDay() + 6) % 7; // 0=Lunes, 6=Domingo
            const percent = clamp01(count / totalPlazas);
            result.heatmap[weekday][h] = Math.round(percent * 100);
            sumPercent += percent;
            totalHourPoints += 1;

            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const entry = (dayBuckets[dateKey] = dayBuckets[dateKey] || { occHours: 0, hours: 0 });
            entry.occHours += percent;
            entry.hours += 1;

            if (!result.peak || percent * 100 > result.peak.value) {
                result.peak = { value: Math.round(percent * 100), label: `${String(h).padStart(2, "0")}:00` };
            }
        });

        result.avgOccupancy = totalHourPoints > 0 ? Math.round((sumPercent / totalHourPoints) * 100) : 0;
        result.avgAvailability = Math.max(0, Math.round((1 - (result.avgOccupancy / 100)) * totalPlazas));

        // Serie diaria
        result.dailySeries = Object.entries(dayBuckets)
            .sort((a, b) => (a[0] > b[0] ? 1 : -1))
            .map(([k, v]) => ({ day: k, value: Math.round((v.occHours / Math.max(1, v.hours)) * 100) }));

        // Ocupacion por zona (promedio simple usando conteo de registros por zona)
        const zonaBuckets: Record<string, number> = {};
        const zonaHours: Record<string, number> = {};
        filteredByType.forEach((r) => {
            const z = r.pla_zona || "General";
            zonaBuckets[z] = (zonaBuckets[z] || 0) + 1;
            zonaHours[z] = (zonaHours[z] || 0) + 1;
        });
        result.zonaOcupacion = Object.entries(zonas).map(([z, meta]) => {
            const used = zonaBuckets[z] || 0;
            const perc = meta.total > 0 ? Math.round(clamp01(used / (dayCount * meta.total)) * 100) : 0;
            return { zona: z, ocupacion: perc };
        }).sort((a, b) => b.ocupacion - a.ocupacion);

        // Insights simples
        const hottestRow = result.heatmap.map((row, i) => ({ i, max: Math.max(...row) }))
            .sort((a, b) => b.max - a.max)[0];
        const dayNames = ["Lun", "Mar", "Mi", "Jue", "Vie", "Sb", "Dom"];
        if (hottestRow && hottestRow.max > 0) {
            const hour = result.heatmap[hottestRow.i].indexOf(hottestRow.max);
            result.insights.push(`El mayor pico se registr los ${dayNames[hottestRow.i]} a las ${String(hour).padStart(2, "0")}:00.`);
        }
        const lowZones = result.zonaOcupacion.filter(z => z.ocupacion < Math.max(0, result.avgOccupancy - 20)).slice(0, 1);
        if (lowZones.length) result.insights.push(`La zona ${lowZones[0].zona} presenta una Ocupacion menor al promedio.`);

        return result;
    }, [history, totalPlazas, zonas, vehicleType, dateRange]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Ocupacion y Disponibilidad"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
            >
                <div className="flex items-center gap-2 print:hidden">
                    <span className="text-sm text-slate-600">Tipo:</span>
                    <Select value={vehicleType} onValueChange={(v: VehicleType) => setVehicleType(v)}>
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            <SelectItem value="AUT">Autos</SelectItem>
                            <SelectItem value="MOT">Motos</SelectItem>
                            <SelectItem value="CAM">Camionetas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </ReporteHeader>

            {/* Contenido imprimible en A4 */}
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
                    {/* KPIs */}
                    <div className="grid gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
                        {loading ? (
                            <>
                                <Skeleton className="h-24 print:h-20" />
                                <Skeleton className="h-24 print:h-20" />
                                <Skeleton className="h-24 print:h-20" />
                            </>
                        ) : (
                            <>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Ocupacion promedio</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-2xl font-semibold print:text-xl">{avgOccupancy}%</div>
                                        <div className="text-xs text-slate-500 print:text-[11px]">del periodo</div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Pico maximo de ocupacion</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="flex items-center gap-2">
                                            <div className="text-2xl font-semibold print:text-xl">{peak.value}%</div>
                                            <Badge variant="outline" className="text-xs print:text-[10px]">{peak.label}</Badge>
                                        </div>
                                        <div className="text-xs text-slate-500 print:text-[11px]">hora de mayor demanda</div>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">Disponibilidad promedio</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-2xl font-semibold print:text-xl">{avgAvailability} espacios</div>
                                        <div className="text-xs text-slate-500 print:text-[11px]">promedio de libres</div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    {/* Heatmap Ocupacion */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Ocupacion por hora y dia</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-64 print:h-40" />
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="min-w-[760px] print:min-w-[640px]">
                                        <div className="grid grid-cols-[80px_repeat(24,minmax(20px,1fr))] gap-[3px] print:gap-[2px]">
                                            <div className="text-xs text-right pr-2 text-slate-500">&nbsp;</div>
                                            {Array.from({ length: 24 }, (_, h) => (
                                                <div key={h} className="text-[10px] text-center text-slate-500 print:text-[9px]">{h}</div>
                                            ))}
                                            {heatmap.map((row, i) => (
                                                <Fragment key={`row-${i}`}>
                                                    <div className="text-xs text-right pr-2 py-1 text-slate-600 print:text-[11px]">
                                                        {["Lun", "Mar", "Mi", "Jue", "Vie", "Sb", "Dom"][i]}
                                                    </div>
                                                    {row.map((v, h) => (
                                                        <div
                                                            key={`${i}-${h}`}
                                                            className="h-5 rounded print:h-3"
                                                            style={{ backgroundColor: `hsl(${120 - v * 1.2}, 70%, ${90 - v * 0.3}%)` }}
                                                            title={`${v}%`}
                                                        />
                                                    ))}
                                                </Fragment>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Ocupacion por zona */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Ocupacion por zona / sector</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-40 print:h-24" />
                            ) : (
                                <div className="space-y-2 print:space-y-1.5">
                                    {zonaOcupacion.length === 0 && (
                                        <div className="text-sm text-slate-500 print:text-xs">Sin datos de zonas para el periodo.</div>
                                    )}
                                    {zonaOcupacion.map((z) => (
                                        <div key={z.zona} className="flex items-center gap-3 print:gap-2">
                                            <div className="w-28 text-sm text-slate-600 print:w-24 print:text-xs">{z.zona}</div>
                                            <div className="flex-1 h-3 rounded bg-slate-200 print:h-2">
                                                <div className="h-3 rounded bg-blue-600 print:h-2" style={{ width: `${z.ocupacion}%` }} />
                                            </div>
                                            <div className="w-12 text-right text-sm print:text-xs">{z.ocupacion}%</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Tendencia histrica */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Tendencia histrica (diaria)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-40 print:h-24" />
                            ) : (
                                <div className="flex h-40 items-end gap-1 print:h-24 print:gap-[3px]">
                                    {dailySeries.map((d, idx) => (
                                        <div
                                            key={idx}
                                            className="w-2 bg-indigo-500 print:w-1.5"
                                            style={{ height: `${d.value}%` }}
                                            title={`${d.day}: ${d.value}%`}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Distribucin de estadias */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Distribucin de estadias</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-32 print:h-20" />
                            ) : (
                                <div className="grid grid-cols-4 gap-4 print:gap-2">
                                    {[
                                        { label: "0-1 h", value: stayDistribution.a },
                                        { label: "1-3 h", value: stayDistribution.b },
                                        { label: "3-6 h", value: stayDistribution.c },
                                        { label: "> 6 h", value: stayDistribution.d },
                                    ].map((b) => (
                                        <div key={b.label} className="text-center">
                                            <div className="flex h-24 items-end justify-center rounded bg-slate-200 print:h-20">
                                                <div
                                                    className="w-8 rounded bg-emerald-500 print:w-6"
                                                    style={{ height: `${Math.min(100, (b.value / Math.max(1, history.length)) * 100)}%` }}
                                                />
                                            </div>
                                            <div className="mt-1 text-xs text-slate-600 print:text-[11px]">{b.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Insights */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">Insights automticos</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-20 print:h-14" />
                            ) : insights.length ? (
                                <ul className="list-disc space-y-1 pl-5 text-sm print:space-y-[6px] print:text-xs">
                                    {insights.map((t, i) => (
                                        <li key={i}>{t}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-sm text-slate-500 print:text-xs">No se detectaron insights destacados para el periodo.</div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}



