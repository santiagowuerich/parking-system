import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logger, createTimer } from "@/lib/logger";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

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

        // Consulta optimizada: buscar por auth_user_id o email en una sola operación
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
            .or(`auth_user_id.eq.${user.id},usu_email.eq.${user.email}`)
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
        let role = "unknown"; // rol por defecto

        const hasOwnerRel = Array.isArray(userWithRole.dueno)
            ? userWithRole.dueno.length > 0
            : Boolean(userWithRole.dueno);
        const hasPlayeroRel = Array.isArray(userWithRole.playeros)
            ? userWithRole.playeros.length > 0
            : Boolean(userWithRole.playeros);

        if (hasOwnerRel) {
            role = "owner";
            logger.debug('Usuario identificado como OWNER');
        } else if (hasPlayeroRel) {
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
