import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";
import { DisponibilidadResponse, PlazaDisponible } from "@/lib/types";
import { validarTiempoReserva } from "@/lib/utils/reservas-utils";

// Tarifa por defecto si no está configurada
const TARIFA_DEFECTO = 1000;

export async function GET(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();
        const url = new URL(request.url);

        const estId = Number(url.searchParams.get('est_id'));
        const fechaInicio = url.searchParams.get('fecha_inicio');
        const duracionHoras = Number(url.searchParams.get('duracion_horas'));

        console.log(`📍 [DISPONIBILIDAD] Solicitando plazas para est_id=${estId}, fecha_inicio=${fechaInicio}, duracion=${duracionHoras}h`);

        // Validar parámetros requeridos
        if (!estId || !fechaInicio || !duracionHoras) {
            return NextResponse.json({
                success: false,
                error: 'Parámetros requeridos: est_id, fecha_inicio, duracion_horas'
            }, { status: 400 });
        }

        // Validar tiempo de reserva
        const validacionTiempo = validarTiempoReserva(fechaInicio);
        if (!validacionTiempo.valido) {
            console.warn(`⚠️ [DISPONIBILIDAD] Validación de tiempo falló: ${validacionTiempo.error}`);
            return NextResponse.json({
                success: false,
                error: validacionTiempo.error
            }, { status: 400 });
        }

        // Validar duración
        if (duracionHoras < 1 || duracionHoras > 24) {
            return NextResponse.json({
                success: false,
                error: 'La duración debe estar entre 1 y 24 horas'
            }, { status: 400 });
        }

        const fechaInicioDate = new Date(fechaInicio);
        const fechaFinDate = new Date(fechaInicioDate.getTime() + (duracionHoras * 60 * 60 * 1000));

        console.log(`🔍 [DISPONIBILIDAD] Consultando disponibilidad desde ${fechaInicioDate.toISOString()} hasta ${fechaFinDate.toISOString()}`);

        // 1. Obtener todas las plazas del estacionamiento
        const { data: plazas, error: plazasError } = await supabase
            .from('plazas')
            .select(`
        pla_numero,
        pla_zona,
        catv_segmento,
        plantilla_id,
        pla_estado
      `)
            .eq('est_id', estId);

        if (plazasError) {
            console.error('Error obteniendo plazas:', plazasError);
            return NextResponse.json({
                success: false,
                error: 'Error consultando plazas del estacionamiento'
            }, { status: 500 });
        }

        if (!plazas || plazas.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    plazas: [],
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFinDate.toISOString(),
                    duracion_horas: duracionHoras
                }
            });
        }

        // 2. Obtener tarifas actuales para cada plantilla
        const plantillaIds = [...new Set(plazas.map(p => p.plantilla_id).filter(Boolean))];

        let tarifasPorPlantilla: Record<number, number> = {};

        if (plantillaIds.length > 0) {
            const { data: tarifas, error: tarifasError } = await supabase
                .from('tarifas')
                .select('plantilla_id, tar_precio')
                .in('plantilla_id', plantillaIds)
                .lte('tar_f_desde', fechaInicioDate.toISOString())
                .order('tar_f_desde', { ascending: false });

            if (tarifasError) {
                console.error('Error obteniendo tarifas:', tarifasError);
            } else if (tarifas) {
                // Tomar la tarifa más reciente para cada plantilla
                tarifas.forEach(tarifa => {
                    if (!tarifasPorPlantilla[tarifa.plantilla_id]) {
                        tarifasPorPlantilla[tarifa.plantilla_id] = tarifa.tar_precio;
                    }
                });
            }
        }

        // 3. Obtener reservas que se superponen con el rango horario
        const { data: reservasConflictivas, error: reservasError } = await supabase
            .from('reservas')
            .select('pla_numero')
            .eq('est_id', estId)
            .in('res_estado', ['confirmada', 'activa'])
            .or(`and(res_fh_ingreso.lt.${fechaFinDate.toISOString()},res_fh_fin.gt.${fechaInicioDate.toISOString()})`);

        if (reservasError) {
            console.error('Error obteniendo reservas conflictivas:', reservasError);
        }

        const plazasReservadas = new Set((reservasConflictivas || []).map(r => r.pla_numero));

        // 4. Obtener ocupaciones activas que se superponen
        const { data: ocupacionesConflictivas, error: ocupacionesError } = await supabase
            .from('ocupacion')
            .select('pla_numero')
            .eq('est_id', estId)
            .is('ocu_fh_salida', null)
            .not('pla_numero', 'is', null)
            .lt('ocu_fh_entrada', fechaFinDate.toISOString());

        if (ocupacionesError) {
            console.error('Error obteniendo ocupaciones conflictivas:', ocupacionesError);
        }

        const plazasOcupadas = new Set((ocupacionesConflictivas || []).map(o => o.pla_numero));

        // 5. Filtrar plazas disponibles
        const plazasDisponibles: PlazaDisponible[] = plazas
            .filter(plaza => {
                // Excluir plazas en mantenimiento, abonadas o reservadas
                if (plaza.pla_estado === 'Mantenimiento' || plaza.pla_estado === 'Abonado' || plaza.pla_estado === 'Reservada') {
                    return false;
                }

                // Excluir plazas con reservas conflictivas
                if (plazasReservadas.has(plaza.pla_numero)) {
                    return false;
                }

                // Excluir plazas ocupadas
                if (plazasOcupadas.has(plaza.pla_numero)) {
                    return false;
                }

                // Solo incluir si tiene tarifa definida
                if (!plaza.plantilla_id || !tarifasPorPlantilla[plaza.plantilla_id]) {
                    return false;
                }

                return true;
            })
            .map(plaza => ({
                pla_numero: plaza.pla_numero,
                pla_zona: plaza.pla_zona,
                catv_segmento: plaza.catv_segmento,
                // Usar tarifa de la plantilla o tarifa por defecto
                precio_por_hora: plaza.plantilla_id && tarifasPorPlantilla[plaza.plantilla_id]
                    ? tarifasPorPlantilla[plaza.plantilla_id]
                    : TARIFA_DEFECTO,
                plantilla_id: plaza.plantilla_id || 0
            }))
            .sort((a, b) => {
                // Ordenar por zona y luego por número de plaza
                if (a.pla_zona !== b.pla_zona) {
                    return a.pla_zona.localeCompare(b.pla_zona);
                }
                return a.pla_numero - b.pla_numero;
            });

        console.log(`✅ [DISPONIBILIDAD] Plazas disponibles: ${plazasDisponibles.length} de ${plazas.length} totales`);

        if (plazasDisponibles.length === 0) {
            console.warn(`⚠️ [DISPONIBILIDAD] No hay plazas disponibles para el estacionamiento ${estId}`);
        }

        const response: DisponibilidadResponse = {
            success: true,
            data: {
                plazas: plazasDisponibles,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFinDate.toISOString(),
                duracion_horas: duracionHoras
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('❌ [DISPONIBILIDAD] Error en consulta de disponibilidad:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}
