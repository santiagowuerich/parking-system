import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { logger, createTimer } from "@/lib/logger";

// Función helper para crear cliente de Supabase con autenticación
async function createAuthenticatedSupabaseClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options });
                    } catch (error) {
                        // The `set` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: "", ...options });
                    } catch (error) {
                        // The `remove` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}

export async function GET(request: NextRequest) {
    const timer = createTimer('GET /api/auth/get-role');
    try {
        logger.debug('Iniciando determinación de rol');

        const supabase = await createAuthenticatedSupabaseClient();

        // Obtener el usuario autenticado desde la sesión del servidor
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            logger.warn('Usuario no autenticado:', authError?.message);
            timer.end();
            return NextResponse.json(
                { error: "Usuario no autenticado", role: "unknown" },
                { status: 401 }
            );
        }

        logger.debug('Usuario autenticado:', user.email);

        // Verificar que supabaseAdmin esté disponible
        if (!supabaseAdmin) {
            logger.error('supabaseAdmin no disponible');
            timer.end();
            return NextResponse.json(
                { error: "Configuración del servidor incompleta", role: "unknown" },
                { status: 500 }
            );
        }

        // Consulta unificada para obtener usuario y determinar rol en una sola operación
        const { data: userWithRole, error: queryError } = await supabaseAdmin
            .from('usuario')
            .select(`
                usu_id,
                usu_nom,
                usu_ape,
                usu_email,
                dueno!left(due_id),
                playeros!left(play_id)
            `)
            .eq('auth_user_id', user.id)
            .single();

        if (queryError || !userWithRole) {
            logger.warn('Usuario no encontrado en BD:', queryError?.message);
            timer.end();
            return NextResponse.json(
                { error: "Usuario no encontrado en la base de datos", role: "unknown" },
                { status: 404 }
            );
        }

        const usuId = userWithRole.usu_id;
        logger.debug('Usuario encontrado en BD:', { usu_id: usuId, nombre: userWithRole.usu_nom });

        // Determinar rol basado en las relaciones
        let role = "conductor"; // rol por defecto

        if (userWithRole.dueno && userWithRole.dueno.length > 0) {
            role = "owner";
            logger.debug('Usuario identificado como OWNER');
        } else if (userWithRole.playeros && userWithRole.playeros.length > 0) {
            role = "playero";
            logger.debug('Usuario identificado como PLAYERO');
        } else {
            logger.debug('Usuario identificado como CONDUCTOR (rol por defecto)');
        }

        timer.end();
        return NextResponse.json({
            role,
            user_id: usuId,
            user_data: {
                usu_id: userWithRole.usu_id,
                usu_nom: userWithRole.usu_nom,
                usu_ape: userWithRole.usu_ape,
                usu_email: userWithRole.usu_email
            }
        });

    } catch (error: any) {
        logger.error('Error interno:', error?.message);
        timer.end();
        return NextResponse.json(
            {
                error: error?.message || 'Error interno del servidor',
                role: "unknown"
            },
            { status: 500 }
        );
    }
}
