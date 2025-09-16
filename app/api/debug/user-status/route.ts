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
            .select('usu_id, usu_nom, usu_ape, usu_email, usu_estado, auth_user_id')
            .eq('usu_email', userEmail)
            .single();

        console.log('Debug user-status - Buscando usuario:', userEmail);
        console.log('Debug user-status - Usuario encontrado:', usuarioData);
        console.log('Debug user-status - Error:', usuarioError);

        if (usuarioError || !usuarioData) {
            console.log('Debug user-status - Usuario no encontrado, devolviendo respuesta por defecto');
            return NextResponse.json({
                authenticated: true,
                user_id: null,
                email: userEmail,
                message: "Usuario no encontrado en tabla usuario",
                has_profile: false,
                role: "unknown"
            });
        }

        // Verificar si es dueño de estacionamiento
        const { data: parkingData } = await supabase
            .from('estacionamientos')
            .select('est_id, est_nombre')
            .eq('due_id', usuarioData.usu_id)
            .single();

        // Verificar si es empleado
        const { data: employeeData } = await supabase
            .from('empleados_estacionamiento')
            .select('est_id, fecha_asignacion, activo')
            .eq('play_id', usuarioData.usu_id)
            .eq('activo', true)
            .single();

        // Determinar rol basado en las relaciones
        let role = 'unknown';
        if (parkingData) {
            role = 'owner';
        } else if (employeeData) {
            role = 'playero';
        }

        const responseData = {
            authenticated: true,
            user_id: usuarioData.usu_id,
            email: userEmail,
            name: `${usuarioData.usu_nom} ${usuarioData.usu_ape}`,
            role: role,
            has_parking: !!parkingData,
            parking_id: parkingData?.est_id || null,
            parking_name: parkingData?.est_nombre || null,
            is_employee: !!employeeData,
            employee_est_id: employeeData?.est_id || null,
            has_profile: true,
            status: usuarioData.usu_estado
        };

        console.log('Debug user-status - Respuesta final:', responseData);
        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Error obteniendo estado del usuario:', error);
        return NextResponse.json(
            {
                error: 'Error interno del servidor',
                authenticated: false,
                role: "unknown"
            },
            { status: 500 }
        );
    }
}
