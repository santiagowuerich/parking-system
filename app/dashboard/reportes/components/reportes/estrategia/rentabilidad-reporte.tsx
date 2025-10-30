"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/utils";

type VehicleType = "ALL" | "AUT" | "MOT" | "CAM";

interface HistoryEntry {
    entry_time: string | null;
    exit_time: string | null;
    fee?: number | null;
    catv_segmento?: "AUT" | "MOT" | "CAM" | null;
    plantilla_id?: number | null;
    pla_numero?: number | null;
    plantillas?: {
        catv_segmento?: "AUT" | "MOT" | "CAM" | null;
        nombre_plantilla?: string | null;
    } | null;
}

interface TarifaData {
    plantilla_id: number;
    nombre_plantilla: string;
    catv_segmento: "AUT" | "MOT" | "CAM";
    tarifas: Record<number, {
        precio: number;
        fraccion: number;
        tipo: number;
        fecha: string;
    }>;
}

interface PlazasApi {
    plazas: Array<{
        pla_numero: number;
        pla_estado: "Libre" | "Ocupada" | "Abonado";
        plantillas?: { 
            catv_segmento?: "AUT" | "MOT" | "CAM";
            plantilla_id?: number;
        } | null;
    }>;
}

function hoursBetween(start: Date, end: Date) {
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    return diffMs / (1000 * 60 * 60);
}

export function RentabilidadReporte() {
    const { estId } = useAuth();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [vehicleType, setVehicleType] = useState<VehicleType>("ALL");
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [tarifas, setTarifas] = useState<TarifaData[]>([]);
    const [plazasData, setPlazasData] = useState<PlazasApi | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    // Ajustar el contenido para caber en A4 (vertical)
    useEffect(() => {
        const resize = () => {
            if (!printRef.current || !scaleRef.current) return;
            const A4_WIDTH_PX = 794;  // ~210mm @96dpi
            const A4_HEIGHT_PX = 1123; // ~297mm @96dpi
            const paddingPx = 32; // total padding interno
            const availW = A4_WIDTH_PX - paddingPx;
            const availH = A4_HEIGHT_PX - paddingPx;
            const inner = scaleRef.current;
            // Reset scale to measure natural size
            inner.style.transform = "scale(1)";
            const rect = inner.getBoundingClientRect();
            const nextScale = Math.min(1, Math.min(availW / Math.max(1, rect.width), availH / Math.max(1, rect.height)));
            setScale(nextScale);
            inner.style.transform = `scale(${nextScale})`;
            inner.style.transformOrigin = "top left";
        };
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, [history, tarifas, plazasData, vehicleType, dateRange]);

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
                const rows: HistoryEntry[] = Array.isArray(json.history) ? json.history : [];
                
                // Tarifas
                const tarifasRes = await fetch(`/api/tarifas?est_id=${estId}`);
                const tarifasJson = await tarifasRes.json();
                const tarifasData: TarifaData[] = Array.isArray(tarifasJson.tarifas) ? tarifasJson.tarifas : [];
                
                // Plazas actuales
                const plazasRes = await fetch(`/api/plazas?est_id=${estId}`);
                const plazasJson: PlazasApi = await plazasRes.json();
                setPlazasData(plazasJson);

                // Filtro temporal + tipo de vehículo
                const filtered = Array.isArray(rows) ? rows.filter((r) => {
                    const entry = r.entry_time ? new Date(r.entry_time) : null;
                    const exit = r.exit_time ? new Date(r.exit_time) : null;
                    const inRange = (
                        (entry && entry <= to && entry >= from) ||
                        (exit && exit <= to && exit >= from) ||
                        (entry && exit && entry < from && exit > to)
                    );
                    return inRange;
                }) : [];
                
                setHistory(filtered);
                setTarifas(tarifasData);
            } catch (e) {
                console.error("Error cargando datos de rentabilidad:", e);
                setHistory([]);
                setTarifas([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [estId, dateRange]);

    // Cálculos de rentabilidad
    const {
        rentabilidadPorTipo,
        ingresosTotales,
        ocupacionPorTipo,
        ticketPromedioPorTipo,
        insights
    } = useMemo(() => {
        const result = {
            rentabilidadPorTipo: [] as Array<{
                tipo: string;
                ingresos: number;
                ocupacion: number;
                ticketPromedio: number;
                rentabilidad: number;
                plazas: number;
            }>,
            ingresosTotales: 0,
            ocupacionPorTipo: {} as Record<string, number>,
            ticketPromedioPorTipo: {} as Record<string, number>,
            insights: [] as string[]
        };

        if (!history.length || !tarifas.length || !plazasData) {
            return result;
        }

        // Agrupar por tipo de vehículo
        const tipoMap: Record<string, string> = {
            'AUT': 'Autos',
            'MOT': 'Motos', 
            'CAM': 'Camionetas'
        };

        const ingresosPorTipo: Record<string, number> = {};
        const movimientosPorTipo: Record<string, number> = {};
        const horasPorTipo: Record<string, number> = {};

        history.forEach((entry) => {
            // Obtener segmento desde la plaza asociada
            let segmento = 'AUT'; // Default
            
            // Buscar la plaza correspondiente para obtener su tipo
            if (entry.pla_numero && plazasData?.plazas) {
                const plaza = plazasData.plazas.find(p => p.pla_numero === entry.pla_numero);
                if (plaza?.plantillas?.catv_segmento) {
                    segmento = plaza.plantillas.catv_segmento;
                }
            }
            
            const tipo = tipoMap[segmento] || 'Autos';
            
            // Si no es "ALL", filtrar por tipo específico
            if (vehicleType !== "ALL" && segmento !== vehicleType) {
                return;
            }
            
            const fee = entry.fee || 0;
            const entryTime = entry.entry_time ? new Date(entry.entry_time) : null;
            const exitTime = entry.exit_time ? new Date(entry.exit_time) : null;
            
            ingresosPorTipo[tipo] = (ingresosPorTipo[tipo] || 0) + fee;
            movimientosPorTipo[tipo] = (movimientosPorTipo[tipo] || 0) + 1;
            
            if (entryTime && exitTime) {
                const horas = hoursBetween(entryTime, exitTime);
                horasPorTipo[tipo] = (horasPorTipo[tipo] || 0) + horas;
            }
        });

        // Calcular ocupación por tipo de plaza
        const plazasPorTipo: Record<string, number> = {};
        (plazasData.plazas || []).forEach(plaza => {
            const segmento = plaza.plantillas?.catv_segmento;
            if (segmento && tipoMap[segmento]) {
                const tipo = tipoMap[segmento];
                plazasPorTipo[tipo] = (plazasPorTipo[tipo] || 0) + 1;
            }
        });

        // Calcular métricas por tipo
        Object.keys(tipoMap).forEach(codigo => {
            const tipo = tipoMap[codigo];
            const ingresos = ingresosPorTipo[tipo] || 0;
            const movimientos = movimientosPorTipo[tipo] || 0;
            const plazas = plazasPorTipo[tipo] || 0;
            const horas = horasPorTipo[tipo] || 0;
            
            const ocupacion = plazas > 0 ? (movimientos / plazas) * 100 : 0;
            const ticketPromedio = movimientos > 0 ? ingresos / movimientos : 0;
            const rentabilidad = plazas > 0 ? ingresos / plazas : 0;

            result.rentabilidadPorTipo.push({
                tipo,
                ingresos,
                ocupacion: Math.round(ocupacion),
                ticketPromedio,
                rentabilidad,
                plazas
            });

            result.ocupacionPorTipo[tipo] = ocupacion;
            result.ticketPromedioPorTipo[tipo] = ticketPromedio;
        });

        result.ingresosTotales = Object.values(ingresosPorTipo).reduce((sum, val) => sum + val, 0);

        // Ordenar por rentabilidad descendente
        result.rentabilidadPorTipo.sort((a, b) => b.rentabilidad - a.rentabilidad);

        // Insights
        if (result.rentabilidadPorTipo.length > 0) {
            const mejor = result.rentabilidadPorTipo[0];
            const peor = result.rentabilidadPorTipo[result.rentabilidadPorTipo.length - 1];
            
            result.insights.push(`El tipo ${mejor.tipo} genera la mayor rentabilidad por plaza: ${formatCurrency(mejor.rentabilidad)}.`);
            
            if (mejor.tipo !== peor.tipo) {
                result.insights.push(`El tipo ${peor.tipo} presenta menor rentabilidad: ${formatCurrency(peor.rentabilidad)}.`);
            }
            
            const tipoMayorOcupacion = Object.entries(result.ocupacionPorTipo)
                .sort(([,a], [,b]) => b - a)[0];
            if (tipoMayorOcupacion) {
                result.insights.push(`El tipo ${tipoMayorOcupacion[0]} tiene la mayor ocupación: ${Math.round(tipoMayorOcupacion[1])}%.`);
            }
        }

        return result;
    }, [history, tarifas, plazasData, vehicleType, dateRange]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title="Rentabilidad por Tipo de Plaza"
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
            />
            
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

            {/* Contenido imprimible en A4 */}
            <div
                ref={printRef}
                className="bg-white shadow-sm mx-auto print:shadow-none"
                style={{ width: "210mm", height: "297mm", padding: 16, overflow: "hidden" }}
            >
            <div ref={scaleRef} className="space-y-6 print:space-y-4">
            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
                {loading ? (
                    <>
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                    </>
                ) : (
                    <>
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">Ingresos Totales</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:py-1">
                                <div className="text-2xl font-semibold print:text-xl">{formatCurrency(ingresosTotales)}</div>
                                <div className="text-xs text-slate-500">del período</div>
                            </CardContent>
                        </Card>
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">Tipo Más Rentable</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:py-1">
                                <div className="text-2xl font-semibold print:text-xl">
                                    {rentabilidadPorTipo.length > 0 ? rentabilidadPorTipo[0].tipo : "-"}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {rentabilidadPorTipo.length > 0 ? formatCurrency(rentabilidadPorTipo[0].rentabilidad) : "0"} por plaza
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">Tipos Analizados</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 print:py-1">
                                <div className="text-2xl font-semibold print:text-xl">{rentabilidadPorTipo.length}</div>
                                <div className="text-xs text-slate-500">categorías de vehículos</div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Rentabilidad por tipo */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Rentabilidad por Tipo de Plaza</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-40 print:h-28" />
                    ) : (
                        <div className="space-y-3">
                            {rentabilidadPorTipo.length === 0 && (
                                <div className="text-sm text-slate-500">Sin datos de rentabilidad para el período.</div>
                            )}
                            {rentabilidadPorTipo.map((item, idx) => (
                                <div key={item.tipo} className="flex items-center gap-4 p-3 border rounded-lg">
                                    <div className="w-24 text-sm font-medium text-slate-700">{item.tipo}</div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span>Rentabilidad por plaza:</span>
                                            <span className="font-semibold">{formatCurrency(item.rentabilidad)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Ingresos totales:</span>
                                            <span>{formatCurrency(item.ingresos)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Ocupación:</span>
                                            <span>{item.ocupacion}%</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Ticket promedio:</span>
                                            <span>{formatCurrency(item.ticketPromedio)}</span>
                                        </div>
                                    </div>
                                    <div className="w-16 text-right">
                                        <Badge variant={idx === 0 ? "default" : "secondary"} className="text-xs">
                                            {item.plazas} plazas
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Comparativa de ocupación */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Ocupación por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-32 print:h-24" />
                    ) : (
                        <div className="space-y-2">
                            {Object.entries(ocupacionPorTipo).map(([tipo, ocupacion]) => (
                                <div key={tipo} className="flex items-center gap-3">
                                    <div className="w-28 print:w-24 text-sm text-slate-600">{tipo}</div>
                                    <div className="flex-1 h-3 print:h-2 bg-slate-200 rounded">
                                        <div className="h-3 print:h-2 bg-green-600 rounded" style={{ width: `${Math.min(100, ocupacion)}%` }} />
                                    </div>
                                    <div className="w-12 text-right text-sm">{Math.round(ocupacion)}%</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Ticket promedio por tipo */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Ticket Promedio por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-32 print:h-24" />
                    ) : (
                        <div className="space-y-2">
                            {Object.entries(ticketPromedioPorTipo).map(([tipo, ticket]) => (
                                <div key={tipo} className="flex items-center gap-3">
                                    <div className="w-28 print:w-24 text-sm text-slate-600">{tipo}</div>
                                    <div className="flex-1 h-3 print:h-2 bg-slate-200 rounded">
                                        <div className="h-3 print:h-2 bg-blue-600 rounded" style={{ width: `${Math.min(100, (ticket / Math.max(...Object.values(ticketPromedioPorTipo))) * 100)}%` }} />
                                    </div>
                                    <div className="w-20 text-right text-sm">{formatCurrency(ticket)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Insights */}
            <Card className="print:shadow-none">
                <CardHeader>
                    <CardTitle className="text-base print:text-sm">Insights de Rentabilidad</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-20 print:h-16" />
                    ) : insights.length ? (
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            {insights.map((t, i) => (<li key={i}>{t}</li>))}
                        </ul>
                    ) : (
                        <div className="text-sm text-slate-500">No se detectaron insights destacados para el período.</div>
                    )}
                </CardContent>
            </Card>
            </div>
            </div>
        <style jsx global>{`
            @media print {
                @page { size: A4 portrait; margin: 0; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        `}</style>
        </div>
    );
}