import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - Obtener turnos disponibles
export async function GET(request: NextRequest) {
    try {
        const { data: turnos, error } = await supabase
            .from('turnos_catalogo')
            .select('*')
            .order('turno_id');

        if (error) {
            console.error('Error obteniendo turnos:', error);
            return NextResponse.json(
                { error: "Error al obtener turnos" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            turnos: turnos || []
        });

    } catch (error) {
        console.error('Error en GET /api/empleados/turnos:', error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
