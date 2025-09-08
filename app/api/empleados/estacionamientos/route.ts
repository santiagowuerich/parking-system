import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// GET - Obtener estacionamientos del usuario actual
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();

        // Crear cliente de Supabase para el servidor
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        const cookie = cookieStore.get(name);
                        return cookie?.value;
                    },
                    set(name: string, value: string, options: any) {
                        cookieStore.set(name, value, options);
                    },
                    remove(name: string, options: any) {
                        cookieStore.set(name, '', { ...options, maxAge: 0 });
                    },
                },
            }
        );

        // Obtener la sesión del usuario
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        // Obtener el usuario desde la tabla usuario usando el email
        const { data: usuario, error: userError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', session.user.email)
            .single();

        if (userError || !usuario) {
            console.error('Error obteniendo usuario:', userError);
            return NextResponse.json(
                { error: "Usuario no encontrado en la base de datos" },
                { status: 404 }
            );
        }

        // Obtener estacionamientos del usuario
        const { data: estacionamientos, error } = await supabase
            .from('estacionamientos')
            .select('est_id, est_nombre, est_direc, est_locali')
            .eq('due_id', usuario.usu_id)
            .order('est_nombre');

        if (error) {
            console.error('Error obteniendo estacionamientos:', error);
            return NextResponse.json(
                { error: "Error al obtener estacionamientos" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            estacionamientos: estacionamientos || []
        });

    } catch (error) {
        console.error('Error en GET /api/empleados/estacionamientos:', error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
