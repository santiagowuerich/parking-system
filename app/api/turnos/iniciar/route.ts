import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';
import { nowInArgentina } from "@/lib/utils/date-time";

export async function POST(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const {
            play_id,
            est_id,
            caja_inicio,
            observaciones
        } = await request.json();

        if (!play_id || !est_id || caja_inicio === undefined) {
            return NextResponse.json({ error: "Datos requeridos faltantes" }, { status: 400 });
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
            .eq('play_id', play_id)
            .eq('est_id', est_id)
            .eq('activo', true)
            .single();

        if (empleadoError || !empleado) {
            return NextResponse.json({ error: "Empleado no encontrado o inactivo" }, { status: 404 });
        }

        // Verificar que no haya turno activo
        const { data: turnoActivo, error: turnoActivoError } = await supabase
            .from('turnos_empleados')
            .select('tur_id')
            .eq('play_id', play_id)
            .eq('est_id', est_id)
            .eq('tur_estado', 'activo')
            .single();

        if (turnoActivo) {
            return NextResponse.json({ error: "Ya tienes un turno activo" }, { status: 400 });
        }

        // Obtener fecha y hora actual en zona horaria de Argentina
        const ahoraArgentina = nowInArgentina();
        const fechaActual = ahoraArgentina.format('YYYY-MM-DD');
        const horaActual = ahoraArgentina.format('HH:mm');

        // Crear turno con caja
        const { data: nuevoTurno, error: turnoError } = await supabase
            .from('turnos_empleados')
            .insert({
                play_id: play_id,
                est_id: est_id,
                tur_fecha: fechaActual,
                tur_hora_entrada: horaActual,
                tur_estado: 'activo',
                tur_observaciones_entrada: observaciones || null,
                caja_inicio: parseFloat(caja_inicio)
            })
            .select()
            .single();

        if (turnoError) {
            logger.error("Error creating turno:", turnoError);
            return NextResponse.json({ error: "Error al crear turno" }, { status: 500 });
        }


        const jsonResponse = NextResponse.json({
            success: true,
            turno: nuevoTurno,
            message: "Turno iniciado correctamente"
        });
        return copyResponseCookies(response, jsonResponse);
    } catch (err) {
        logger.error("Error iniciando turno:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
