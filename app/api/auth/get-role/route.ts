import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

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
    try {
        console.log('🔍 GET /api/auth/get-role - Iniciando determinación de rol...');

        const supabase = await createAuthenticatedSupabaseClient();

        // Obtener el usuario autenticado desde la sesión del servidor
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.log('🚫 GET /api/auth/get-role - Usuario no autenticado:', authError);
            return NextResponse.json(
                { error: "Usuario no autenticado", role: "unknown" },
                { status: 401 }
            );
        }

        console.log('👤 GET /api/auth/get-role - Usuario autenticado:', user.email);

        // Verificar que supabaseAdmin esté disponible
        if (!supabaseAdmin) {
            console.error('❌ GET /api/auth/get-role - supabaseAdmin no disponible');
            return NextResponse.json(
                { error: "Configuración del servidor incompleta", role: "unknown" },
                { status: 500 }
            );
        }

        // Buscar usuario en tabla usuario usando auth_user_id
        const { data: usuarioData, error: usuarioError } = await supabaseAdmin
            .from('usuario')
            .select('usu_id, usu_nom, usu_ape, usu_email')
            .eq('auth_user_id', user.id)
            .single();

        if (usuarioError || !usuarioData) {
            console.log('⚠️ GET /api/auth/get-role - Usuario no encontrado en BD:', usuarioError);
            return NextResponse.json(
                { error: "Usuario no encontrado en la base de datos", role: "unknown" },
                { status: 404 }
            );
        }

        const usuId = usuarioData.usu_id;
        console.log('✅ GET /api/auth/get-role - Usuario encontrado en BD:', {
            usu_id: usuId,
            nombre: usuarioData.usu_nom,
            email: usuarioData.usu_email
        });

        // Determinar el rol del usuario

        // 1. Verificar si es dueño
        const { data: duenoData, error: duenoError } = await supabaseAdmin
            .from('dueno')
            .select('due_id')
            .eq('due_id', usuId)
            .single();

        if (duenoData && !duenoError) {
            console.log('👑 GET /api/auth/get-role - Usuario identificado como OWNER');
            return NextResponse.json({
                role: "owner",
                user_id: usuId,
                user_data: usuarioData
            });
        }

        // 2. Verificar si es playero (empleado)
        const { data: playeroData, error: playeroError } = await supabaseAdmin
            .from('playeros')
            .select('play_id')
            .eq('play_id', usuId)
            .single();

        if (playeroData && !playeroError) {
            console.log('👷 GET /api/auth/get-role - Usuario identificado como PLAYERO');
            return NextResponse.json({
                role: "playero",
                user_id: usuId,
                user_data: usuarioData
            });
        }

        // 3. Si no es dueño ni playero, es conductor por defecto
        console.log('🚗 GET /api/auth/get-role - Usuario identificado como CONDUCTOR (rol por defecto)');
        return NextResponse.json({
            role: "conductor",
            user_id: usuId,
            user_data: usuarioData
        });

    } catch (error: any) {
        console.error('❌ GET /api/auth/get-role - Error interno:', error);
        return NextResponse.json(
            {
                error: error?.message || 'Error interno del servidor',
                role: "unknown"
            },
            { status: 500 }
        );
    }
}
