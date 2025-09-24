import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const url = new URL(request.url);
        const playId = url.searchParams.get('play_id');
        const estId = url.searchParams.get('est_id');
        const fechaDesde = url.searchParams.get('fecha_desde');
        const fechaHasta = url.searchParams.get('fecha_hasta');

        if (!playId || !estId) {
            return NextResponse.json({ error: "play_id y est_id son requeridos" }, { status: 400 });
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
            .eq('play_id', playId)
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
            .eq('play_id', playId)
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

        const jsonResponse = NextResponse.json({
            historial: historial || []
        });
        return copyResponseCookies(response, jsonResponse);
    } catch (err) {
        logger.error("Error fetching historial turnos:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
