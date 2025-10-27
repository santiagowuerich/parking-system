"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/lib/auth-context";

export interface PlazasData {
    plazas_por_plantilla: {
        Auto: { total: number; ocupadas: number; disponibles: number };
        Moto: { total: number; ocupadas: number; disponibles: number };
        Camioneta: { total: number; ocupadas: number; disponibles: number };
    };
    total_general: {
        total: number;
        ocupadas: number;
        disponibles: number;
    };
}

export interface MovimientosData {
    ingresos_hoy: number;
    egresos_hoy: number;
}

export interface IngresosData {
    hoy: number;
    semana: number;
    mes: number;
}

export interface EstrategicMetrics {
    ticketPromedio: number;
    flujoVehiculos: number;
    ocupacionPromedio: number;
}

export function useReportesMetrics() {
    const { estId } = useAuth();
    const [plazasData, setPlazasData] = useState<PlazasData | null>(null);
    const [movimientosData, setMovimientosData] = useState<MovimientosData | null>(null);
    const [ingresosData, setIngresosData] = useState<IngresosData | null>(null);
    const [strategicMetrics, setStrategicMetrics] = useState<EstrategicMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadMetrics = async () => {
            if (!estId) {
                setLoading(false);
                return;
            }

            try {
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                // 1. Cargar plazas
                const plazasResponse = await fetch(`/api/plazas?est_id=${estId}`);
                const plazasResult = await plazasResponse.json();

                if (plazasResult.plazas && Array.isArray(plazasResult.plazas)) {
                    const plazasPorPlantilla = {
                        Auto: { total: 0, ocupadas: 0, disponibles: 0 },
                        Moto: { total: 0, ocupadas: 0, disponibles: 0 },
                        Camioneta: { total: 0, ocupadas: 0, disponibles: 0 }
                    };

                    const tipoMap: { [key: string]: 'Auto' | 'Moto' | 'Camioneta' } = {
                        'AUT': 'Auto',
                        'MOT': 'Moto',
                        'CAM': 'Camioneta'
                    };

                    plazasResult.plazas.forEach((plaza: any) => {
                        const codigoTipo = plaza.plantillas?.catv_segmento;
                        const tipoVehiculo = codigoTipo ? tipoMap[codigoTipo] : null;

                        if (tipoVehiculo && plazasPorPlantilla[tipoVehiculo]) {
                            plazasPorPlantilla[tipoVehiculo].total++;

                            if (plaza.pla_estado === 'Ocupada') {
                                plazasPorPlantilla[tipoVehiculo].ocupadas++;
                            } else if (plaza.pla_estado === 'Libre') {
                                plazasPorPlantilla[tipoVehiculo].disponibles++;
                            }
                        }
                    });

                    const total_general = {
                        total: plazasResult.plazas.length,
                        ocupadas: plazasResult.plazas.filter((p: any) =>
                            p.pla_estado === 'Ocupada' || p.pla_estado === 'Abonado'
                        ).length,
                        disponibles: plazasResult.plazas.filter((p: any) =>
                            p.pla_estado === 'Libre'
                        ).length
                    };

                    setPlazasData({
                        plazas_por_plantilla: plazasPorPlantilla,
                        total_general
                    });
                }

                // 2. Cargar historial para ingresos
                const { data: historial, error: historialError } = await supabase
                    .from('vw_historial_estacionamiento')
                    .select('*')
                    .eq('est_id', estId)
                    .order('exit_time', { ascending: false });

                if (historialError) throw historialError;

                // Calcular ingresos
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const todayIncome = (historial || [])
                    .filter((entry: any) => new Date(entry.exit_time) >= today)
                    .reduce((sum: number, entry: any) => sum + (entry.fee || 0), 0);

                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                weekAgo.setHours(0, 0, 0, 0);

                const weekIncome = (historial || [])
                    .filter((entry: any) => new Date(entry.exit_time) >= weekAgo)
                    .reduce((sum: number, entry: any) => sum + (entry.fee || 0), 0);

                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                monthAgo.setHours(0, 0, 0, 0);

                const monthIncome = (historial || [])
                    .filter((entry: any) => new Date(entry.exit_time) >= monthAgo)
                    .reduce((sum: number, entry: any) => sum + (entry.fee || 0), 0);

                setIngresosData({
                    hoy: todayIncome,
                    semana: weekIncome,
                    mes: monthIncome
                });

                // 3. Cargar movimientos del día
                // Obtener todos los vehículos actualmente estacionados usando la API
                const parkedResponse = await fetch(`/api/parking/parked?est_id=${estId}`);
                const parkedData = await parkedResponse.json();
                const vehiculosActuales = parkedData.parkedVehicles || [];

                // Contar ingresos de hoy: del historial + actuales que entraron hoy
                const ingresosHistorial = (historial || []).filter((entry: any) => {
                    if (!entry.entry_time) return false;
                    const entryDate = new Date(entry.entry_time);
                    return entryDate >= today;
                }).length;

                const ingresosActuales = vehiculosActuales.filter((veh: any) => {
                    if (!veh.entry_time) return false;
                    const entryDate = new Date(veh.entry_time);
                    return entryDate >= today;
                }).length;

                const totalIngresos = ingresosHistorial + ingresosActuales;

                // Egresos: vehículos que salieron hoy
                const todayExits = (historial || []).filter((entry: any) => {
                    if (!entry.exit_time) return false;
                    const exitDate = new Date(entry.exit_time);
                    return exitDate >= today;
                }).length;

                console.log('Métricas de hoy:', {
                    ingresosHistorial,
                    ingresosActuales,
                    totalIngresos,
                    todayExits,
                    today: today.toISOString(),
                    vehiculosActualesCount: vehiculosActuales.length
                });

                setMovimientosData({
                    ingresos_hoy: totalIngresos,
                    egresos_hoy: todayExits
                });

                // 4. Calcular métricas estratégicas (últimos 30 días)
                const last30Days = (historial || []).filter((entry: any) => {
                    if (!entry.exit_time) return false;
                    const exitDate = new Date(entry.exit_time);
                    return exitDate >= monthAgo;
                });

                // Ticket promedio: promedio de cobros en últimos 30 días
                const totalFees = last30Days.reduce((sum: number, entry: any) => sum + (entry.fee || 0), 0);
                const ticketPromedio = last30Days.length > 0 ? totalFees / last30Days.length : 0;

                // Flujo de vehículos: promedio de ingresos por día en últimos 30 días
                const diasTranscurridos = Math.max(1, Math.ceil((new Date().getTime() - monthAgo.getTime()) / (1000 * 60 * 60 * 24)));

                // Contar todos los vehículos que entraron en los últimos 30 días (historial + actuales)
                const ingresosLast30 = (historial || []).filter((entry: any) => {
                    if (!entry.entry_time) return false;
                    const entryDate = new Date(entry.entry_time);
                    return entryDate >= monthAgo;
                }).length;

                const ingresosActualesLast30 = vehiculosActuales.filter((veh: any) => {
                    if (!veh.entry_time) return false;
                    const entryDate = new Date(veh.entry_time);
                    return entryDate >= monthAgo;
                }).length;

                const totalIngresosLast30 = ingresosLast30 + ingresosActualesLast30;
                const flujoVehiculos = totalIngresosLast30 / diasTranscurridos;

                // Ocupación promedio últimos 30 días
                // Calcular la ocupación actual y asumir que es representativa del promedio
                // (idealmente deberíamos tener datos históricos de ocupación diaria)
                const ocupacionPromedio = plazasData ?
                    Math.round((plazasData.total_general.ocupadas / plazasData.total_general.total) * 100) :
                    0;

                setStrategicMetrics({
                    ticketPromedio,
                    flujoVehiculos: Math.round(flujoVehiculos * 10) / 10, // Redondear a 1 decimal
                    ocupacionPromedio
                });

                console.log('Métricas estratégicas:', {
                    ticketPromedio,
                    flujoVehiculos: Math.round(flujoVehiculos * 10) / 10,
                    ocupacionPromedio,
                    last30DaysCount: last30Days.length,
                    diasTranscurridos,
                    totalIngresosLast30
                });

            } catch (error) {
                console.error("Error al cargar métricas:", error);
            } finally {
                setLoading(false);
            }
        };

        loadMetrics();
    }, [estId]);

    return {
        plazasData,
        movimientosData,
        ingresosData,
        strategicMetrics,
        loading
    };
}
