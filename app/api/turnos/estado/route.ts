import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const url = new URL(request.url);
        const playId = url.searchParams.get('play_id');
        const estId = url.searchParams.get('est_id');

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

        // Obtener turno activo
        const { data: turnoActivo, error: turnoError } = await supabase
            .from('turnos_empleados')
            .select('*')
            .eq('play_id', playId)
            .eq('est_id', estId)
            .eq('tur_estado', 'activo')
            .single();

        // Obtener historial de hoy
        const { data: historialHoy, error: historialError } = await supabase
            .from('turnos_empleados')
            .select('*')
            .eq('play_id', playId)
            .eq('est_id', estId)
            .eq('tur_fecha', new Date().toISOString().split('T')[0])
            .order('tur_hora_entrada', { ascending: false });

        const jsonResponse = NextResponse.json({
            turno_activo: turnoActivo,
            historial_hoy: historialHoy || []
        });
        return copyResponseCookies(response, jsonResponse);
    } catch (err) {
        logger.error("Error fetching turno estado:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
