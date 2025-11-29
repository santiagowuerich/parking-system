"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Pie, PieChart, Cell } from "recharts";
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

function getOperatingDays(horarios: HorarioFranja[]): number[] {
    const days = new Set<number>();
    horarios.forEach(h => days.add(h.dia_semana));
    return Array.from(days).sort((a, b) => a - b);
}

function formatHour12(hour24: number): string {
    const hour12 = hour24 === 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12} ${period}`;
}

export function OcupacionReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [previousHistory, setPreviousHistory] = useState<HistoryEntry[]>([]);
    const [totalPlazas, setTotalPlazas] = useState<number>(0);
    const [plazasAbonadas, setPlazasAbonadas] = useState<number>(0);
    const [zonas, setZonas] = useState<Record<string, { total: number }>>({});
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
                // Cargar horarios del estacionamiento
                const horariosRes = await fetch(`/api/estacionamiento/horarios?est_id=${estId}`);
                if (horariosRes.ok) {
                    const horariosJson = await horariosRes.json();
                    setHorarios(horariosJson.horarios || []);
                } else {
                    setHorarios([]);
                }

                // Historial completo
                const res = await fetch(`/api/parking/history?est_id=${estId}`);
                let rows: HistoryEntry[] = [];
                if (res.ok) {
                    const json = await res.json();
                    rows = Array.isArray(json.history) ? json.history : (json || []);
                }

                // Plazas actuales
                const plazasRes = await fetch(`/api/plazas?est_id=${estId}`);
                let plazasJson: PlazasApi = { plazas: [] };
                if (plazasRes.ok) {
                    plazasJson = await plazasRes.json();
                    const total = Array.isArray(plazasJson?.plazas) ? plazasJson.plazas.length : 0;
                    setTotalPlazas(total);

                    // Contar plazas abonadas
                    const plazasAbonadasCount = (plazasJson?.plazas || []).filter(p => p.pla_estado === "Abonado").length;
                    setPlazasAbonadas(plazasAbonadasCount);
                } else {
                    setTotalPlazas(0);
                    setPlazasAbonadas(0);
                }

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
            lowPeak: { value: 0, label: "-" },
            peakDay: { name: "-", percent: 0 },
            riskZone: { name: "-", percent: 0, level: "Bajo", color: "text-green-600" },
            trend: { direction: "stable" as "up" | "down" | "stable", percent: 0 },

            // Visualizaciones
            hourlyPattern: Array(24).fill(0).map((_, i) => ({ hour: i, occupancy: 0, isPeak: false })),
            weeklyPattern: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day, i) => ({
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

        // ===== OCUPACIÓN REAL POR HORA (% promedio de plazas ocupadas por hora) =====
        const hourlyOccupancy: Record<number, { totalPercent: number; dayCount: number }> = {};

        // Inicializar para cada hora
        for (let h = 0; h < 24; h++) {
            hourlyOccupancy[h] = { totalPercent: 0, dayCount: 0 };
        }

        // Iterar por cada día del período
        let currentDateHourly = new Date(from);
        while (currentDateHourly <= to) {
            // Para cada hora del día
            for (let h = 0; h < 24; h++) {
                let vehiculosEnHora = plazasAbonadas; // Empezar con plazas abonadas siempre ocupadas

                // Crear fecha/hora exacta para esta hora de este día
                const checkDateTime = new Date(currentDateHourly);
                checkDateTime.setHours(h, 0, 0, 0);

                // Contar vehículos presentes en esta hora específica
                filteredByType.forEach((r) => {
                    const entry = r.entry_time ? new Date(r.entry_time) : null;
                    const exit = r.exit_time ? new Date(r.exit_time) : null;

                    if (!entry || !exit) return;

                    // Vehículo está presente si: entry <= checkDateTime < exit
                    if (entry <= checkDateTime && exit > checkDateTime) {
                        vehiculosEnHora++;
                    }
                });

                // Calcular % de ocupación para esta hora de este día
                const percentOcupacion = totalPlazas > 0
                    ? (vehiculosEnHora / totalPlazas) * 100
                    : 0;

                hourlyOccupancy[h].totalPercent += percentOcupacion;
                hourlyOccupancy[h].dayCount += 1;
            }

            currentDateHourly.setDate(currentDateHourly.getDate() + 1);
        }

        // Calcular promedio por hora
        const hourlyOccupancyPercent: Record<number, number> = {};
        for (let h = 0; h < 24; h++) {
            const data = hourlyOccupancy[h];
            const avgOccupancy = data.dayCount > 0
                ? Math.round(data.totalPercent / data.dayCount)
                : 0;
            hourlyOccupancyPercent[h] = avgOccupancy;
        }

        // Encontrar máximo y mínimo solo entre horas operativas
        const occupancyValues = Object.values(hourlyOccupancyPercent);
        const operatingHours = getOperatingHours(horarios);
        let maxHourIdx = 0;
        let maxHourOccupancy = 0;
        let minHourIdx = 0;
        let minHourOccupancy = Infinity;

        result.hourlyPattern = Array(24).fill(0).map((_, h) => {
            const occupancy = hourlyOccupancyPercent[h] || 0;

            if (occupancy > maxHourOccupancy) {
                maxHourOccupancy = occupancy;
                maxHourIdx = h;
            }

            // Hora muerta: menor ocupación entre horas operativas
            if (operatingHours.includes(h) && occupancy < minHourOccupancy) {
                minHourOccupancy = occupancy;
                minHourIdx = h;
            }

            return {
                hour: h,
                occupancy,
                isPeak: false
            };
        });

        // Marcar las 3 horas con mayor ocupación
        const sortedHours = [...result.hourlyPattern]
            .sort((a, b) => b.occupancy - a.occupancy)
            .slice(0, 3);
        sortedHours.forEach(sh => {
            const idx = result.hourlyPattern.findIndex(h => h.hour === sh.hour);
            if (idx >= 0) result.hourlyPattern[idx].isPeak = true;
        });

        // Calcular peak (hora con mayor ocupación)
        result.peak = {
            value: maxHourOccupancy,
            label: formatHour12(maxHourIdx),
            day: result.weeklyPattern.reduce((max, curr) =>
                curr.occupancy > max.occupancy ? curr : max
            ).day
        };

        // Calcular lowPeak (hora con menor ocupación)
        result.lowPeak = {
            value: minHourOccupancy,
            label: minHourOccupancy === Infinity ? "-" : formatHour12(minHourIdx)
        };

        // ===== DISTRIBUCIÓN SEMANAL (% promedio de plazas ocupadas por día de semana) =====
        const dailyOccupancy: Record<number, { totalPercent: number; dayCount: number }> = {};

        // Inicializar para cada día de la semana (0=Lun, 6=Dom)
        for (let i = 0; i < 7; i++) {
            dailyOccupancy[i] = { totalPercent: 0, dayCount: 0 };
        }

        // Iterar por cada día del período
        let currentDate = new Date(from);
        while (currentDate <= to) {
            const weekday = (currentDate.getDay() + 6) % 7; // 0=Lun, 6=Dom

            // Contar vehículos presentes en este día (contar una vez por día, no por hora)
            let vehiculosEnDia = plazasAbonadas; // Empezar con plazas abonadas

            // Crear timestamp para medianoche de este día y siguiente
            const dayStart = new Date(currentDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(currentDate);
            dayEnd.setHours(23, 59, 59, 999);

            filteredByType.forEach((r) => {
                const entry = r.entry_time ? new Date(r.entry_time) : null;
                const exit = r.exit_time ? new Date(r.exit_time) : null;

                if (!entry || !exit) return;

                // Vehículo está presente si: entry <= dayEnd AND exit >= dayStart
                if (entry <= dayEnd && exit >= dayStart) {
                    vehiculosEnDia++;
                }
            });

            // Calcular % de ocupación promedio del día
            const percentOcupacion = totalPlazas > 0
                ? (vehiculosEnDia / totalPlazas) * 100
                : 0;

            dailyOccupancy[weekday].totalPercent += percentOcupacion;
            dailyOccupancy[weekday].dayCount += 1;

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Calcular promedio por día de la semana
        result.weeklyPattern = result.weeklyPattern.map((item, i) => {
            const dayData = dailyOccupancy[i];
            const avgOccupancy = dayData.dayCount > 0
                ? Math.round(dayData.totalPercent / dayData.dayCount)
                : 0;

            return {
                ...item,
                occupancy: avgOccupancy,
                isCritical: avgOccupancy > 70 // Mayor a 70% es crítico
            };
        });

        // Calcular peakDay (día con mayor ocupación promedio)
        const maxDay = result.weeklyPattern.reduce((max, curr) =>
            curr.occupancy > max.occupancy ? curr : max
        );
        result.peakDay = {
            name: maxDay.day,
            percent: maxDay.occupancy
        };

        // Ocupación promedio: promedio solo de horas operativas
        const operatingOccupancies = operatingHours.length > 0
            ? operatingHours.map(h => hourlyOccupancyPercent[h] || 0)
            : occupancyValues;
        result.avgOccupancy = operatingOccupancies.length > 0
            ? Math.round(operatingOccupancies.reduce((sum, v) => sum + v, 0) / operatingOccupancies.length)
            : 0;

        // No se usa comparación con período anterior en tarjetas
        result.prevAvgOccupancy = result.avgOccupancy;
        result.occupancyChange = 0;

        // Tendencia
        if (Math.abs(result.occupancyChange) < 3) {
            result.trend = { direction: "stable", percent: 0 };
        } else if (result.occupancyChange > 0) {
            result.trend = { direction: "up", percent: Math.abs(result.occupancyChange) };
        } else {
            result.trend = { direction: "down", percent: Math.abs(result.occupancyChange) };
        }

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
            // Calcular porcentajes exactos
            const exactPercents = [
                (result.stayDistribution.a.count / totalStays) * 100,
                (result.stayDistribution.b.count / totalStays) * 100,
                (result.stayDistribution.c.count / totalStays) * 100,
                (result.stayDistribution.d.count / totalStays) * 100,
            ];

            // Redondear y ajustar para que sumen 100
            let rounded = exactPercents.map(p => Math.floor(p));
            let remaining = 100 - rounded.reduce((sum, p) => sum + p, 0);

            // Distribuir el resto a los valores con mayor residuo
            const residuals = exactPercents.map((p, i) => ({ index: i, residual: p - rounded[i] }))
                .sort((a, b) => b.residual - a.residual);

            // Asegurar que remaining no exceda la longitud de residuals
            remaining = Math.min(remaining, residuals.length);

            for (let i = 0; i < remaining; i++) {
                rounded[residuals[i].index]++;
            }

            result.stayDistribution.a.percent = rounded[0];
            result.stayDistribution.b.percent = rounded[1];
            result.stayDistribution.c.percent = rounded[2];
            result.stayDistribution.d.percent = rounded[3];
        }

        // ===== GENERAR RESUMEN DESCRIPTIVO =====
        const insightsGenerated: string[] = [];

        // 1. Ocupación general
        insightsGenerated.push(
            `El porcentaje promedio de ocupación del período es ${result.avgOccupancy}%.`
        );

        // 2. Distribución semanal
        insightsGenerated.push(
            `${result.peakDay.name} es el día con mayor actividad, representando ${result.peakDay.percent}% del flujo semanal.`
        );

        // 3. Horas de mayor flujo
        const peakHours = result.hourlyPattern.filter(h => h.isPeak).sort((a, b) => b.occupancy - a.occupancy);
        if (peakHours.length > 0) {
            const hourRanges = peakHours.map(h => `${String(h.hour).padStart(2, "0")}:00`).join(", ");
            insightsGenerated.push(
                `Las horas de mayor flujo son: ${hourRanges}.`
            );
        }

        // 4. Patrón de estadías predominante
        const dominantStay = Object.entries({
            "0-1h": result.stayDistribution.a.percent,
            "1-3h": result.stayDistribution.b.percent,
            "3-6h": result.stayDistribution.c.percent,
            ">6h": result.stayDistribution.d.percent,
        }).sort(([, a], [, b]) => b - a)[0];

        insightsGenerated.push(
            `La mayoría de los vehículos (${dominantStay[1]}%) permanecen ${dominantStay[0]}.`
        );

        // 5. Distribución por zona (si hay datos)
        if (result.zonaOcupacion.length > 0) {
            const topZone = result.zonaOcupacion[0];
            insightsGenerated.push(
                `La zona "${topZone.zona}" concentra ${topZone.ocupacion}% de la actividad total.`
            );
        }

        result.insights = insightsGenerated.slice(0, 5);

        return result;
    }, [history, previousHistory, totalPlazas, plazasAbonadas, zonas, dateRange, horarios]);

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
                                {/* Porcentaje Promedio de Ocupación */}
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Porcentaje promedio de ocupación
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-bold print:text-2xl">
                                            {calculations.avgOccupancy}%
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Hora Pico */}
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Hora Pico
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-bold print:text-2xl">
                                            {calculations.peak.label}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Hora Muerta */}
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Hora Muerta
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-bold print:text-2xl">
                                            {calculations.lowPeak.label}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Día Pico */}
                                <Card className="print:shadow-none">
                                    <CardHeader className="pb-2 print:py-2 print:pb-1">
                                        <CardTitle className="text-sm font-medium text-slate-600 print:text-xs">
                                            Día Pico
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 print:pt-1 print:pb-0">
                                        <div className="text-3xl font-bold print:text-2xl">
                                            {calculations.peakDay.name}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    {/* Porcentaje de Ocupación por Hora Operativa - Recharts */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">
                                Porcentaje de Ocupación por hora Operativa
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
                            ) : (
                                <ChartContainer
                                    config={{
                                        occupancy: {
                                            label: "Ocupación",
                                            color: "#3b82f6",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={(() => {
                                                const operatingHours = getOperatingHours(horarios);
                                                return calculations.hourlyPattern
                                                    .filter(h => operatingHours.includes(h.hour))
                                                    .map((item) => ({
                                                        hour: `${String(item.hour).padStart(2, "0")}h`,
                                                        occupancy: item.occupancy,
                                                    }));
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
                                                label={{ value: "Ocupación (%)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value) => [`${value}%`, "Ocupación"]}
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="occupancy"
                                                fill="#3b82f6"
                                                radius={[4, 4, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    {/* Porcentaje de Ocupación por Día Operativo - Recharts */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">
                                Porcentaje de ocupación por día operativo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-32 print:h-24" />
                            ) : (
                                <ChartContainer
                                    config={{
                                        percentage: {
                                            label: "Ocupación",
                                            color: "#3b82f6",
                                        },
                                    }}
                                    className="h-[280px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={(() => {
                                                const operatingDays = getOperatingDays(horarios);
                                                return calculations.weeklyPattern
                                                    .filter((item, index) => {
                                                        const diaSemana = (index + 1) % 7;
                                                        return operatingDays.includes(diaSemana);
                                                    })
                                                    .map((item) => ({
                                                        day: item.day,
                                                        percentage: item.occupancy,
                                                    }));
                                            })()}
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
                                                label={{ value: "Ocupación (%)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                                                domain={[0, 100]}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value) => [`${value}%`, "Ocupación"]}
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="percentage"
                                                fill="#3b82f6"
                                                radius={[6, 6, 0, 0]}
                                            />
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

                    {/* Porcentaje por Tiempo de Estadia */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">
                                Porcentaje por Tiempo de estadia
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 print:pt-1 print:pb-2">
                            {loading ? (
                                <Skeleton className="h-64 print:h-48" />
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
                                                data={[
                                                    { name: "0-1h", value: calculations.stayDistribution.a.percent, count: calculations.stayDistribution.a.count },
                                                    { name: "1-3h", value: calculations.stayDistribution.b.percent, count: calculations.stayDistribution.b.count },
                                                    { name: "3-6h", value: calculations.stayDistribution.c.percent, count: calculations.stayDistribution.c.count },
                                                    { name: ">6h", value: calculations.stayDistribution.d.percent, count: calculations.stayDistribution.d.count },
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={true}
                                                label={({ name, value }) => `${name}: ${value}%`}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                <Cell fill="#10b981" />
                                                <Cell fill="#3b82f6" />
                                                <Cell fill="#f59e0b" />
                                                <Cell fill="#ef4444" />
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

                    {/* Resumen del Reporte */}
                    <Card className="print:shadow-none">
                        <CardHeader className="pb-3 print:py-2 print:pb-1">
                            <CardTitle className="text-base print:text-sm">
                                Resumen del reporte
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
