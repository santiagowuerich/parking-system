import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar que el usuario esté autenticado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        const userEmail = user.email;

        // Buscar el usuario en la tabla tradicional por email
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', userEmail)
            .single();

        if (usuarioError || !usuarioData) {
            console.log(`📍 Usuario ${userEmail} no encontrado en tabla usuario`);
            return NextResponse.json({
                has_assignment: false,
                message: "Usuario no encontrado"
            });
        }

        // Buscar si el usuario es un empleado asignado a algún estacionamiento
        const { data: asignacionData, error: asignacionError } = await supabase
            .from('empleados_estacionamiento')
            .select(`
                est_id,
                fecha_asignacion,
                activo,
                estacionamientos (
                    est_nombre,
                    est_locali
                )
            `)
            .eq('play_id', usuarioData.usu_id)
            .eq('activo', true)
            .single();

        if (asignacionError || !asignacionData) {
            console.log(`👷 Usuario ${userEmail} no tiene asignaciones activas`);
            return NextResponse.json({
                has_assignment: false,
                message: "Usuario no tiene asignaciones activas"
            });
        }

        console.log(`✅ Usuario ${userEmail} tiene asignación activa al estacionamiento: ${asignacionData.est_id}`);

        return NextResponse.json({
            has_assignment: true,
            est_id: asignacionData.est_id,
            est_nombre: asignacionData.estacionamientos?.[0]?.est_nombre || 'Sin nombre',
            est_locali: asignacionData.estacionamientos?.[0]?.est_locali || 'Sin localidad',
            fecha_asignacion: asignacionData.fecha_asignacion,
            usuario_id: usuarioData.usu_id
        });

    } catch (error) {
        console.error("❌ Error obteniendo asignación de empleado:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
