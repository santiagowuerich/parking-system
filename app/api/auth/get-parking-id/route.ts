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

        // Buscar el estacionamiento del usuario
        const { data: estacionamientoData, error: estacionamientoError } = await supabase
            .from('estacionamientos')
            .select('est_id, est_nombre, due_id')
            .eq('due_id', usuarioData.usu_id)
            .single();

        if (estacionamientoError || !estacionamientoData) {
            console.log(`🅿️ No se encontró estacionamiento para usuario ${userEmail}`);
            return NextResponse.json({
                has_parking: false,
                usuario_id: usuarioData.usu_id,
                message: "Usuario encontrado pero sin estacionamiento asignado"
            });
        }

        console.log(`✅ Usuario ${userEmail} tiene estacionamiento est_id: ${estacionamientoData.est_id}`);

        return NextResponse.json({
            has_parking: true,
            est_id: estacionamientoData.est_id,
            est_nombre: estacionamientoData.est_nombre,
            usuario_id: usuarioData.usu_id
        });

    } catch (error) {
        console.error("❌ Error obteniendo parking_id:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
