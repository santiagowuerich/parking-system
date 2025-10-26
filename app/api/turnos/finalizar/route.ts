import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';

export async function PUT(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const {
            tur_id,
            caja_final,
            observaciones
        } = await request.json();

        if (!tur_id || caja_final === undefined) {
            return NextResponse.json({ error: "tur_id y caja_final son requeridos" }, { status: 400 });
        }

        // Verificar que el usuario tenga acceso
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Verificar que el turno existe y está activo
        const { data: turno, error: turnoError } = await supabase
            .from('turnos_empleados')
            .select('*')
            .eq('tur_id', tur_id)
            .eq('tur_estado', 'activo')
            .single();

        if (turnoError || !turno) {
            return NextResponse.json({ error: "Turno no encontrado o ya finalizado" }, { status: 404 });
        }

        // Obtener hora y fecha actual
        const horaActual = new Date().toTimeString().split(' ')[0];
        const fechaActual = new Date().toISOString().split('T')[0];

        // Actualizar turno con caja final y fecha de salida
        const { error: updateTurnoError } = await supabase
            .from('turnos_empleados')
            .update({
                tur_hora_salida: horaActual,
                tur_fecha_salida: fechaActual,
                tur_estado: 'finalizado',
                tur_observaciones_salida: observaciones || null,
                caja_final: parseFloat(caja_final)
            })
            .eq('tur_id', tur_id);

        if (updateTurnoError) {
            logger.error("Error updating turno:", updateTurnoError);
            return NextResponse.json({ error: "Error al actualizar turno" }, { status: 500 });
        }


        const jsonResponse = NextResponse.json({
            success: true,
            message: "Turno finalizado correctamente"
        });
        return copyResponseCookies(response, jsonResponse);
    } catch (err) {
        logger.error("Error finalizando turno:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
