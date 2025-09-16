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
        console.log('Check-user-db - Usuario autenticado:', userEmail);

        // 1. Buscar usuario por email
        const { data: usuarioPorEmail, error: emailError } = await supabase
            .from('usuario')
            .select('*')
            .eq('usu_email', userEmail)
            .single();

        console.log('Check-user-db - Usuario por email:', usuarioPorEmail);
        console.log('Check-user-db - Error por email:', emailError);

        // 2. Buscar usuario por auth_user_id
        const { data: usuarioPorAuth, error: authError } = await supabase
            .from('usuario')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        console.log('Check-user-db - Usuario por auth_user_id:', usuarioPorAuth);
        console.log('Check-user-db - Error por auth_user_id:', authError);

        if (usuarioPorEmail) {
            const usuId = usuarioPorEmail.usu_id;

            // 3. Verificar si es dueño
            const { data: duenoData, error: duenoError } = await supabase
                .from('dueno')
                .select('*')
                .eq('due_id', usuId)
                .single();

            console.log('Check-user-db - Dueño data:', duenoData);
            console.log('Check-user-db - Dueño error:', duenoError);

            // 4. Verificar si es empleado
            const { data: empleadoData, error: empleadoError } = await supabase
                .from('empleados_estacionamiento')
                .select('*')
                .eq('play_id', usuId)
                .single();

            console.log('Check-user-db - Empleado data:', empleadoData);
            console.log('Check-user-db - Empleado error:', empleadoError);

            // 5. Verificar estacionamientos
            const { data: estacionamientos, error: estError } = await supabase
                .from('estacionamientos')
                .select('*')
                .eq('due_id', usuId);

            console.log('Check-user-db - Estacionamientos:', estacionamientos);
            console.log('Check-user-db - Estacionamientos error:', estError);

            return NextResponse.json({
                success: true,
                user_id: usuId,
                email: userEmail,
                usuario_por_email: usuarioPorEmail,
                usuario_por_auth: usuarioPorAuth,
                es_dueno: !!duenoData,
                dueno_data: duenoData,
                es_empleado: !!empleadoData,
                empleado_data: empleadoData,
                estacionamientos: estacionamientos,
                auth_user_id: user.id
            });
        }

        return NextResponse.json({
            success: false,
            message: "Usuario no encontrado",
            email: userEmail,
            auth_user_id: user.id
        });

    } catch (error) {
        console.error('Error en check-user-db:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
            { status: 500 }
        );
    }
}
