import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const url = new URL(request.url);
        const usuId = url.searchParams.get('usu_id'); // Cambiado de play_id a usu_id
        const estId = url.searchParams.get('est_id');
        const fechaDesde = url.searchParams.get('fecha_desde');
        const fechaHasta = url.searchParams.get('fecha_hasta');

        if (!usuId || !estId) {
            return NextResponse.json({ error: "usu_id y est_id son requeridos" }, { status: 400 });
        }

        // Verificar que el usuario tenga acceso
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Verificar que el empleado esté asignado al estacionamiento
        const { data: empleado, error: empleadoError } = await supabase
            .from('empleados_estacionamiento')
            .select('play_id, est_id')
            .eq('play_id', usuId) // Cambiado de playId a usuId
            .eq('est_id', estId)
            .eq('activo', true)
            .single();

        if (empleadoError || !empleado) {
            return NextResponse.json({ error: "Empleado no encontrado o inactivo" }, { status: 404 });
        }

        // Construir query con filtros de fecha
        let query = supabase
            .from('turnos_empleados')
            .select(`
        *,
        cajas_empleados(*)
      `)
            .eq('play_id', usuId) // Cambiado de playId a usuId
            .eq('est_id', estId)
            .order('tur_fecha', { ascending: false })
            .order('tur_hora_entrada', { ascending: false });

        if (fechaDesde) {
            query = query.gte('tur_fecha', fechaDesde);
        }

        if (fechaHasta) {
            query = query.lte('tur_fecha', fechaHasta);
        }

        const { data: historial, error: historialError } = await query;

        if (historialError) {
            logger.error("Error fetching historial:", historialError);
            return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 });
        }

        // Calcular efectivo cobrado para cada turno
        const historialConEfectivo = await Promise.all(
            (historial || []).map(async (turno: any) => {
                const fechaTurno = turno.tur_fecha;
                const horaInicio = turno.tur_hora_entrada;
                const horaFin = turno.tur_hora_salida;
                const fechaSalida = turno.tur_fecha_salida || turno.tur_fecha;

                if (!horaFin) {
                    return { ...turno, efectivo_cobrado: 0 };
                }

                const timestampInicio = dayjs.tz(`${fechaTurno} ${horaInicio}`, 'America/Argentina/Buenos_Aires').toISOString();
                const timestampFin = dayjs.tz(`${fechaSalida} ${horaFin}`, 'America/Argentina/Buenos_Aires').toISOString();

                // Obtener pagos en efectivo del turno
                const { data: pagosEfectivo } = await supabase
                    .from('pagos')
                    .select('pag_monto')
                    .eq('est_id', estId)
                    .gte('pag_h_fh', timestampInicio)
                    .lte('pag_h_fh', timestampFin)
                    .eq('pag_estado', 'completado')
                    .ilike('mepa_metodo', 'efectivo');

                const efectivoCobrado = pagosEfectivo?.reduce((sum: number, p: any) => sum + (p.pag_monto || 0), 0) || 0;

                return { ...turno, efectivo_cobrado: efectivoCobrado };
            })
        );

        const jsonResponse = NextResponse.json({
            historial: historialConEfectivo || []
        });
        return copyResponseCookies(response, jsonResponse);
    } catch (err) {
        logger.error("Error fetching historial turnos:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
