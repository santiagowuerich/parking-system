"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

function hoursBetween(start: Date, end: Date) {
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    return diffMs / (1000 * 60 * 60);
}

function clamp01(n: number) {
    if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
}

function getColorForOccupancy(percent: number): string {
    if (percent >= 80) return "#ef4444"; // Rojo
    if (percent >= 60) return "#f59e0b"; // Amarillo
    return "#10b981"; // Verde
}

function getRiskLevel(percent: number): { level: string; color: string } {
    if (percent >= 80) return { level: "Alto", color: "text-red-600" };
    if (percent >= 60) return { level: "Medio", color: "text-yellow-600" };
    return { level: "Bajo", color: "text-green-600" };
}

export function OcupacionReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [previousHistory, setPreviousHistory] = useState<HistoryEntry[]>([]);
    const [totalPlazas, setTotalPlazas] = useState<number>(0);
    const [zonas, setZonas] = useState<Record<string, { total: number }>>({});
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
            const fileName = `ocupacion-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('Error al generar PDF:', error);
            alert('Error al generar el PDF. Por favor intenta nuevamente.');
        }
    };

    // Carga inicial y al cambiar filtros base
    useEffect(() => {
        const from = dateRange?.from ? new Date(dateRange.from) : new Date(new Date().setDate(new Date().getDate() - 30));
        const to = dateRange?.to ? new Date(dateRange.to) : new Date();
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);

        // Calcular período anterior para comparación
        const periodDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
        const prevTo = new Date(from.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - periodDays * 24 * 60 * 60 * 1000);
        prevFrom.setHours(0, 0, 0, 0);
        prevTo.setHours(23, 59, 59, 999);

        const load = async () => {
            if (!estId) return;
            setLoading(true);
            try {
                // Historial completo
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

                // Filtrar período actual
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

                // Filtrar período anterior
                const prevFiltered = rows.filter((r) => {
                    const entry = r.entry_time ? new Date(r.entry_time) : null;
                    const exit = r.exit_time ? new Date(r.exit_time) : null;
                    const inRange = (
                        (entry && entry <= prevTo && entry >= prevFrom) ||
                        (exit && exit <= prevTo && exit >= prevFrom) ||
                        (entry && exit && entry < prevFrom && exit > prevTo)
                    );
                    return inRange;
                });

                setHistory(filtered);
                setPreviousHistory(prevFiltered);
            } catch (e) {
                console.error("Error cargando datos de Ocupacion:", e);
                setHistory([]);
                setPreviousHistory([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [estId, dateRange]);

    // Cálculos mejorados
    const calculations = useMemo(() => {
        const result = {
            // KPIs principales
            avgOccupancy: 0,
            prevAvgOccupancy: 0,
            occupancyChange: 0,
            peak: { value: 0, label: "-", day: "-" },
            riskZone: { name: "-", percent: 0, level: "Bajo", color: "text-green-600" },
            trend: { direction: "stable" as "up" | "down" | "stable", percent: 0 },

            // Visualizaciones
            hourlyPattern: Array(24).fill(0).map((_, i) => ({ hour: i, occupancy: 0, isPeak: false })),
            weeklyPattern: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day, i) => ({
                day,
                occupancy: 0,
                isCritical: false
            })),
            zonaOcupacion: [] as Array<{
                zona: string;
                ocupacion: number;
                plazas: number;
                color: string;
                risk: string;
            }>,
            stayDistribution: {
                a: { count: 0, percent: 0 },
                b: { count: 0, percent: 0 },
                c: { count: 0, percent: 0 },
                d: { count: 0, percent: 0 }
            },

            // Insights
            insights: [] as string[]
        };

        if (!history.length || totalPlazas === 0) {
            return result;
        }

        const filteredByType = history;
        const prevFilteredByType = previousHistory;

        const from = dateRange?.from ? new Date(dateRange.from) : new Date(new Date().setDate(new Date().getDate() - 30));
        const to = dateRange?.to ? new Date(dateRange.to) : new Date();
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);

        // ===== ACTIVIDAD POR HORA DEL DÍA (Simple conteo de entradas) =====
        const hourlyEntries: Record<number, number> = {};

        filteredByType.forEach((r) => {
            const entry = r.entry_time ? new Date(r.entry_time) : null;
            if (!entry) return;
            const h = entry.getHours();
            hourlyEntries[h] = (hourlyEntries[h] || 0) + 1;
        });

        // Encontrar máximo para normalizar
        const maxEntries = Math.max(...Object.values(hourlyEntries), 1);
        let maxHourIdx = 0;
        let maxHourCount = 0;

        result.hourlyPattern = Array(24).fill(0).map((_, h) => {
            const entries = hourlyEntries[h] || 0;
            const occupancy = Math.round((entries / maxEntries) * 100);

            if (entries > maxHourCount) {
                maxHourCount = entries;
                maxHourIdx = h;
            }

            return {
                hour: h,
                occupancy,
                isPeak: false
            };
        });

        // Marcar las 3 horas con mayor actividad
        const sortedHours = [...result.hourlyPattern]
            .sort((a, b) => b.occupancy - a.occupancy)
            .slice(0, 3);
        sortedHours.forEach(sh => {
            const idx = result.hourlyPattern.findIndex(h => h.hour === sh.hour);
            if (idx >= 0) result.hourlyPattern[idx].isPeak = true;
        });

        // ===== DISTRIBUCIÓN SEMANAL (Porcentaje de actividad por día) =====
        const weeklyEntries: Record<number, number> = {};

        filteredByType.forEach((r) => {
            const entry = r.entry_time ? new Date(r.entry_time) : null;
            if (!entry) return;
            const weekday = (entry.getDay() + 6) % 7; // 0=Lun, 6=Dom
            weeklyEntries[weekday] = (weeklyEntries[weekday] || 0) + 1;
        });

        // Calcular porcentaje del total
        const totalWeeklyEntries = Object.values(weeklyEntries).reduce((sum, count) => sum + count, 0);
        const avgDailyEntries = totalWeeklyEntries / 7;

        result.weeklyPattern = result.weeklyPattern.map((item, i) => {
            const count = weeklyEntries[i] || 0;
            const percent = totalWeeklyEntries > 0 ? Math.round((count / totalWeeklyEntries) * 100) : 0;
            return {
                ...item,
                occupancy: percent,
                isCritical: count > avgDailyEntries * 1.3 // 30% más que el promedio
            };
        });

        // Ocupación promedio actual y anterior
        let totalOccHours = 0;
        let totalHours = 0;

        filteredByType.forEach((r) => {
            const start = r.entry_time ? new Date(r.entry_time) : from;
            const end = r.exit_time ? new Date(r.exit_time) : to;
            const hours = hoursBetween(start, end);
            totalOccHours += hours;
        });

        const periodHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
        result.avgOccupancy = Math.round((totalOccHours / (periodHours * totalPlazas)) * 100);

        // Ocupación período anterior
        let prevTotalOccHours = 0;
        prevFilteredByType.forEach((r) => {
            const start = r.entry_time ? new Date(r.entry_time) : null;
            const end = r.exit_time ? new Date(r.exit_time) : null;
            if (!start || !end) return;
            const hours = hoursBetween(start, end);
            prevTotalOccHours += hours;
        });
        result.prevAvgOccupancy = Math.round((prevTotalOccHours / (periodHours * totalPlazas)) * 100);
        result.occupancyChange = result.avgOccupancy - result.prevAvgOccupancy;

        // Tendencia
        if (Math.abs(result.occupancyChange) < 3) {
            result.trend = { direction: "stable", percent: 0 };
        } else if (result.occupancyChange > 0) {
            result.trend = { direction: "up", percent: Math.abs(result.occupancyChange) };
        } else {
            result.trend = { direction: "down", percent: Math.abs(result.occupancyChange) };
        }

        // Pico máximo (ahora basado en entradas reales)
        result.peak = {
            value: maxHourCount,
            label: `${String(maxHourIdx).padStart(2, "0")}:00`,
            day: result.weeklyPattern.reduce((max, curr) =>
                curr.occupancy > max.occupancy ? curr : max
            ).day
        };

        // ===== ACTIVIDAD POR ZONA (Verificar datos y calcular) =====
        const zoneEntries: Record<string, number> = {};
        let hasZoneData = false;

        filteredByType.forEach((r) => {
            if (r.pla_zona && r.pla_zona !== null && r.pla_zona.trim() !== "") {
                hasZoneData = true;
                zoneEntries[r.pla_zona] = (zoneEntries[r.pla_zona] || 0) + 1;
            }
        });

        // Solo calcular si hay datos de zona
        if (hasZoneData && Object.keys(zonas).length > 0) {
            const totalZoneEntries = Object.values(zoneEntries).reduce((sum, count) => sum + count, 0);

            result.zonaOcupacion = Object.entries(zonas).map(([z, meta]) => {
                const count = zoneEntries[z] || 0;
                const percent = totalZoneEntries > 0
                    ? Math.round((count / totalZoneEntries) * 100)
                    : 0;
                const risk = getRiskLevel(percent);

                return {
                    zona: z,
                    ocupacion: percent,
                    plazas: meta.total,
                    color: getColorForOccupancy(percent),
                    risk: risk.level
                };
            }).sort((a, b) => b.ocupacion - a.ocupacion);
        } else {
            // Sin datos de zona
            result.zonaOcupacion = [];
        }

        // Zona en riesgo (mayor ocupación)
        if (result.zonaOcupacion.length > 0) {
            const topZone = result.zonaOcupacion[0];
            const riskInfo = getRiskLevel(topZone.ocupacion);
            result.riskZone = {
                name: topZone.zona,
                percent: topZone.ocupacion,
                level: riskInfo.level,
                color: riskInfo.color
            };
        }

        // Distribución de estadías con porcentajes
        filteredByType.forEach((r) => {
            const start = r.entry_time ? new Date(r.entry_time) : null;
            const end = r.exit_time ? new Date(r.exit_time) : null;
            if (!start || !end) return;

            const durHrs = hoursBetween(start, end);
            if (durHrs <= 1) result.stayDistribution.a.count += 1;
            else if (durHrs <= 3) result.stayDistribution.b.count += 1;
            else if (durHrs <= 6) result.stayDistribution.c.count += 1;
            else result.stayDistribution.d.count += 1;
        });

        const totalStays = filteredByType.length;
        if (totalStays > 0) {
            result.stayDistribution.a.percent = Math.round((result.stayDistribution.a.count / totalStays) * 100);
            result.stayDistribution.b.percent = Math.round((result.stayDistribution.b.count / totalStays) * 100);
            result.stayDistribution.c.percent = Math.round((result.stayDistribution.c.count / totalStays) * 100);
            result.stayDistribution.d.percent = Math.round((result.stayDistribution.d.count / totalStays) * 100);
        }

        // ===== GENERAR INSIGHTS EJECUTIVOS =====
        const insightsGenerated: string[] = [];

        // 1. Zona más/menos utilizada
        if (result.zonaOcupacion.length > 0) {
            const topZone = result.zonaOcupacion[0];
            const lowZone = result.zonaOcupacion[result.zonaOcupacion.length - 1];

            if (topZone.ocupacion >= 40) {
                insightsGenerated.push(`La zona "${topZone.zona}" concentra ${topZone.ocupacion}% de la actividad total.`);
            }

            if (lowZone.ocupacion < 10 && result.zonaOcupacion.length > 1) {
                insightsGenerated.push(`Oportunidad: Zona "${lowZone.zona}" solo representa ${lowZone.ocupacion}% de la actividad - evaluar estrategias de promoción.`);
            }
        }

        // 2. Días críticos
        const criticalDays = result.weeklyPattern.filter(d => d.isCritical);
        if (criticalDays.length > 0) {
            const dayNames = criticalDays.map(d => d.day).join(", ");
            const maxDay = result.weeklyPattern.reduce((max, curr) =>
                curr.occupancy > max.occupancy ? curr : max
            );
            insightsGenerated.push(`Mayor actividad: ${maxDay.day} con ${maxDay.occupancy}% del flujo semanal - planificar staffing adicional.`);
        }

        // 3. Horas pico
        const peakHours = result.hourlyPattern.filter(h => h.isPeak).sort((a, b) => b.occupancy - a.occupancy);
        if (peakHours.length > 0) {
            const hourRanges = peakHours.map(h => `${String(h.hour).padStart(2, "0")}:00`).join(", ");
            insightsGenerated.push(`Horas de mayor flujo: ${hourRanges}.`);
        }

        // 4. Tendencia del período
        if (result.trend.direction === "up") {
            insightsGenerated.push(`📈 Tendencia positiva: La ocupación aumentó ${result.trend.percent}% respecto al período anterior.`);
        } else if (result.trend.direction === "down") {
            insightsGenerated.push(`📉 Tendencia a la baja: La ocupación disminuyó ${result.trend.percent}% respecto al período anterior.`);
        } else {
            insightsGenerated.push(`Ocupación estable respecto al período anterior (variación < 3%).`);
        }

        // 5. Patrón de estadías
        const dominantStay = Object.entries({
            "0-1h": result.stayDistribution.a.percent,
            "1-3h": result.stayDistribution.b.percent,
            "3-6h": result.stayDistribution.c.percent,
            ">6h": result.stayDistribution.d.percent
        }).sort(([,a], [,b]) => b - a)[0];

        if (dominantStay[1] > 40) {
            insightsGenerated.push(`Patrón dominante: ${dominantStay[1]}% de vehículos permanecen ${dominantStay[0]}.`);
        }

        // 6. Distribución equilibrada o desbalanceada
        const dayPercentages = result.weeklyPattern.map(d => d.occupancy);
        const maxDayPercent = Math.max(...dayPercentages);
        const minDayPercent = Math.min(...dayPercentages);
        if (maxDayPercent - minDayPercent > 20) {
            insightsGenerated.push(`Distribución semanal desbalanceada: diferencia de ${maxDayPercent - minDayPercent}% entre días de mayor y menor actividad.`);
        }

        result.insights = insightsGenerated.slice(0, 6);

        return result;
    }, [history, previousHistory, totalPlazas, zonas, dateRange]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Ocupación y Disponibilidad"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onPrint={handlePrint}
            />

            {/* Contenido imprimible en A4 */}
            <div
                ref={printRef}
                data-print-root
                className="print-a4 mx-auto bg-white shadow-sm print:shadow-none"
            >
                <div
                    className="flex h-full flex-col gap-6 px-6 py-6"
                >
                    {/* KPIs Mejorados - 4 tarjetas */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-0.5">
                        {loading ? (
                            <>
                                <Skeleton className="h-24 print:h-20" />
                                <Skeleton className="h-24 print:h-20" />
                                <Skeleton className="h-24 print:h-20" />
                                <Skeleton className="h-24 print:h-20" />
                            </>
                        ) : (
                            <>
                                {/* Ocupación Promedio */}
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Ocupación Promedio
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-bold print:text-2xl">
                                            {calculations.avgOccupancy}%
                                        </div>
                                        <div className="text-xs text-slate-500 print:text-[10px] mt-1">
                                            {calculations.occupancyChange !== 0 && (
                                                <span className={calculations.occupancyChange > 0 ? "text-green-600" : "text-red-600"}>
                                                    {calculations.occupancyChange > 0 ? "+" : ""}{calculations.occupancyChange}% vs anterior
                                                </span>
                                            )}
                                            {calculations.occupancyChange === 0 && "Sin cambios vs anterior"}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Pico de Actividad */}
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Hora Pico
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="flex items-baseline gap-2">
                                            <div className="text-3xl font-bold print:text-2xl">
                                                {calculations.peak.value}
                                            </div>
                                            <Badge variant="outline" className="text-xs print:text-[10px]">
                                                {calculations.peak.label}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-slate-500 print:text-[10px] mt-1">
                                            entradas - {calculations.peak.day}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Zona en Riesgo */}
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Zona en Riesgo
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-lg font-bold print:text-base truncate">
                                            {calculations.riskZone.name}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-sm font-semibold ${calculations.riskZone.color} print:text-xs`}>
                                                {calculations.riskZone.percent}%
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className={`text-xs print:text-[10px] ${calculations.riskZone.color} border-current`}
                                            >
                                                {calculations.riskZone.level}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Tendencia */}
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Tendencia
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="flex items-center gap-2">
                                            {calculations.trend.direction === "up" && (
                                                <>
                                                    <TrendingUp className="h-8 w-8 text-green-600 print:h-6 print:w-6" />
                                                    <div>
                                                        <div className="text-2xl font-bold text-green-600 print:text-xl">
                                                            +{calculations.trend.percent}%
                                                        </div>
                                                        <div className="text-xs text-slate-500 print:text-[10px]">
                                                            Creciendo
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            {calculations.trend.direction === "down" && (
                                                <>
                                                    <TrendingDown className="h-8 w-8 text-red-600 print:h-6 print:w-6" />
                                                    <div>
                                                        <div className="text-2xl font-bold text-red-600 print:text-xl">
                                                            -{calculations.trend.percent}%
                                                        </div>
                                                        <div className="text-xs text-slate-500 print:text-[10px]">
                                                            Bajando
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            {calculations.trend.direction === "stable" && (
                                                <>
                                                    <Minus className="h-8 w-8 text-slate-600 print:h-6 print:w-6" />
                                                    <div>
                                                        <div className="text-2xl font-bold text-slate-600 print:text-xl">
                                                            Estable
                                                        </div>
                                                        <div className="text-xs text-slate-500 print:text-[10px]">
                                                            Sin cambios
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    {/* Actividad por Hora del Día - Recharts */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">
                                Actividad por Hora del Día
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : (
                                <ChartContainer
                                    config={{
                                        entries: {
                                            label: "Entradas",
                                            color: "#3b82f6",
                                        },
                                        peak: {
                                            label: "Hora Pico",
                                            color: "#ef4444",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={calculations.hourlyPattern.map((item) => ({
                                                hour: `${String(item.hour).padStart(2, "0")}h`,
                                                entries: item.occupancy,
                                                fill: item.isPeak ? "#ef4444" : "#3b82f6",
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
                                                label={{ value: "Actividad (%)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value, name, props) => [
                                                            `${value}%`,
                                                            props.payload.fill === "#ef4444" ? "Hora Pico" : "Actividad",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="entries"
                                                radius={[4, 4, 0, 0]}
                                                fill="#3b82f6"
                                            >
                                                {calculations.hourlyPattern.map((entry, index) => (
                                                    <Fragment key={`cell-${index}`}>
                                                        <rect
                                                            fill={entry.isPeak ? "#ef4444" : "#3b82f6"}
                                                        />
                                                    </Fragment>
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    {/* Distribución Semanal - Recharts */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">
                                Distribución Semanal de Actividad
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-32 print:h-24" />
                            ) : (
                                <ChartContainer
                                    config={{
                                        percentage: {
                                            label: "% del Total",
                                            color: "#10b981",
                                        },
                                        critical: {
                                            label: "Día Crítico",
                                            color: "#ef4444",
                                        },
                                    }}
                                    className="h-[280px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={calculations.weeklyPattern.map((item) => {
                                                const maxOccupancy = Math.max(...calculations.weeklyPattern.map(d => d.occupancy));
                                                return {
                                                    day: item.day,
                                                    percentage: item.occupancy,
                                                    fill: item.occupancy === maxOccupancy ? "#ef4444" : "#10b981",
                                                };
                                            })}
                                            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                            <XAxis
                                                dataKey="day"
                                                tick={{ fontSize: 12 }}
                                                className="text-slate-600"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11 }}
                                                className="text-slate-600"
                                                label={{ value: "% del Total", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                                                domain={[0, 100]}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value, name, props) => [
                                                            `${value}%`,
                                                            props.payload.fill === "#ef4444" ? "Día de Mayor Actividad" : "% del Total Semanal",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="percentage"
                                                radius={[6, 6, 0, 0]}
                                                fill="#10b981"
                                            >
                                                {calculations.weeklyPattern.map((entry, index) => {
                                                    const maxOccupancy = Math.max(...calculations.weeklyPattern.map(d => d.occupancy));
                                                    return (
                                                        <Fragment key={`cell-${index}`}>
                                                            <rect
                                                                fill={entry.occupancy === maxOccupancy ? "#ef4444" : "#10b981"}
                                                            />
                                                        </Fragment>
                                                    );
                                                })}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    {/* Actividad por Zona - Recharts Horizontal Bar (Solo si hay datos) */}
                    {!loading && calculations.zonaOcupacion.length > 0 && (
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-3 print:py-2 print:pb-1">
                                <CardTitle className="text-base print:text-sm">
                                    Distribución por Zona
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:pt-1 print:pb-2">
                                <ChartContainer
                                    config={{
                                        high: {
                                            label: "Alto Riesgo",
                                            color: "#ef4444",
                                        },
                                        medium: {
                                            label: "Riesgo Medio",
                                            color: "#f59e0b",
                                        },
                                        low: {
                                            label: "Bajo Riesgo",
                                            color: "#10b981",
                                        },
                                    }}
                                    className="h-auto w-full"
                                    style={{ height: `${Math.max(200, calculations.zonaOcupacion.length * 55)}px` }}
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={calculations.zonaOcupacion.map((z) => ({
                                                zona: z.zona,
                                                percentage: z.ocupacion,
                                                plazas: z.plazas,
                                                fill: z.color,
                                                risk: z.risk,
                                            }))}
                                            layout="vertical"
                                            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                                            <XAxis
                                                type="number"
                                                domain={[0, 100]}
                                                tick={{ fontSize: 11 }}
                                                className="text-slate-600"
                                                label={{ value: "% de Actividad", position: "insideBottom", style: { fontSize: 12 } }}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="zona"
                                                tick={{ fontSize: 11 }}
                                                className="text-slate-600"
                                                width={80}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value, name, props) => [
                                                            <>
                                                                <div className="text-sm font-semibold">{value}% de actividad</div>
                                                                <div className="text-xs text-slate-500">{props.payload.plazas} plazas totales</div>
                                                                <div className="text-xs">
                                                                    <span className={`font-semibold ${
                                                                        props.payload.risk === "Alto" ? "text-red-600" :
                                                                        props.payload.risk === "Medio" ? "text-yellow-600" :
                                                                        "text-green-600"
                                                                    }`}>
                                                                        Riesgo: {props.payload.risk}
                                                                    </span>
                                                                </div>
                                                            </>,
                                                            "",
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="percentage"
                                                radius={[0, 4, 4, 0]}
                                                fill="#10b981"
                                            >
                                                {calculations.zonaOcupacion.map((entry, index) => (
                                                    <Fragment key={`cell-${index}`}>
                                                        <rect fill={entry.color} />
                                                    </Fragment>
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Distribución de Estadías - Mejorado */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">
                                Distribución de Estadías
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-40 print:h-28" />
                            ) : (
                                <div className="grid grid-cols-4 gap-4 print:gap-2">
                                    {[
                                        { label: "0-1h", data: calculations.stayDistribution.a },
                                        { label: "1-3h", data: calculations.stayDistribution.b },
                                        { label: "3-6h", data: calculations.stayDistribution.c },
                                        { label: ">6h", data: calculations.stayDistribution.d },
                                    ].map((bucket, idx) => (
                                        <div key={idx} className="text-center">
                                            <div className="flex h-32 items-end justify-center rounded-lg bg-slate-100 print:h-20 relative">
                                                <div
                                                    className="w-full rounded-lg bg-emerald-500 flex items-center justify-center"
                                                    style={{ height: `${Math.max(bucket.data.percent, 5)}%` }}
                                                >
                                                    {bucket.data.percent > 10 && (
                                                        <span className="text-white font-bold text-sm print:text-xs">
                                                            {bucket.data.percent}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-2 space-y-0.5 print:mt-1 print:space-y-0">
                                                <div className="text-sm font-medium text-slate-700 print:text-xs">
                                                    {bucket.label}
                                                </div>
                                                {bucket.data.percent <= 10 && (
                                                    <div className="text-xs text-emerald-600 font-semibold print:text-[10px]">
                                                        {bucket.data.percent}%
                                                    </div>
                                                )}
                                                <div className="text-xs text-slate-500 print:text-[10px]">
                                                    {bucket.data.count} vehículos
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Insights Ejecutivos - Mejorado */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">
                                Análisis Ejecutivo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-0">
                            {loading ? (
                                <Skeleton className="h-32 print:h-24" />
                            ) : calculations.insights.length ? (
                                <ul className="space-y-2 print:space-y-1">
                                    {calculations.insights.map((insight, i) => (
                                        <li key={i} className="flex gap-2 text-sm print:text-xs">
                                            <span className="text-blue-600 font-bold">•</span>
                                            <span className="text-slate-700">{insight}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-sm text-slate-500 print:text-xs">
                                    No se generaron insights para el período seleccionado.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
