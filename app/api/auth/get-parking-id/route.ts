import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar que el usuario esté autenticado (usando getUser para mayor seguridad)
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
            .select('usu_id, usu_email')
            .eq('usu_email', userEmail)
            .single();

        if (usuarioError || !usuarioData) {
            console.log(`📍 Usuario ${userEmail} no encontrado en tabla usuario`);
            return NextResponse.json({
                has_parking: false,
                message: "Usuario necesita configuración inicial"
            });
        }

        // Buscar TODOS los estacionamientos del usuario (ahora permite múltiples)
        const { data: estacionamientosData, error: estacionamientosError } = await supabase
            .from('estacionamientos')
            .select('est_id, est_nombre, due_id')
            .eq('due_id', usuarioData.usu_id)
            .order('est_id');

        if (estacionamientosError) {
            console.error("❌ Error obteniendo estacionamientos:", estacionamientosError);
            return NextResponse.json({
                has_parking: false,
                usuario_id: usuarioData.usu_id,
                message: "Error consultando estacionamientos"
            });
        }

        // Si no hay estacionamientos, devolver false
        if (!estacionamientosData || estacionamientosData.length === 0) {
            console.log(`🅿️ No se encontraron estacionamientos para usuario ${userEmail}`);
            return NextResponse.json({
                has_parking: false,
                usuario_id: usuarioData.usu_id,
                message: "Usuario encontrado pero sin estacionamientos asignados"
            });
        }

        console.log(`✅ Usuario ${userEmail} tiene ${estacionamientosData.length} estacionamiento(s)`);

        // Si hay múltiples estacionamientos, devolver el primero (el más antiguo)
        // En el futuro se podría implementar selección de estacionamiento
        const primerEstacionamiento = estacionamientosData[0];

        return NextResponse.json({
            has_parking: true,
            est_id: primerEstacionamiento.est_id,
            est_nombre: primerEstacionamiento.est_nombre,
            usuario_id: usuarioData.usu_id,
            total_estacionamientos: estacionamientosData.length,
            estacionamientos: estacionamientosData.map(e => ({
                est_id: e.est_id,
                est_nombre: e.est_nombre
            }))
        });

    } catch (error) {
        console.error("❌ Error obteniendo parking_id:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
