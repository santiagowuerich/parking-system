import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    try {
        console.log('🔄 [EXPIRACION] Iniciando proceso de expiración automática de reservas');

        // Verificar API key para seguridad (opcional)
        const apiKey = request.headers.get('x-api-key');
        const expectedApiKey = process.env.CRON_API_KEY;

        if (expectedApiKey && apiKey !== expectedApiKey) {
            console.error('❌ [EXPIRACION] API key inválida');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createAuthenticatedSupabaseClient();

        // Buscar reservas que expiraron (res_fh_fin ya pasó)
        const { data: reservasExpiradas, error: errorExpirar } = await supabase
            .from('reservas')
            .select('res_codigo, res_fh_fin, est_id, pla_numero')
            .eq('res_estado', 'confirmada')
            .lt('res_fh_fin', new Date().toISOString());

        if (errorExpirar) {
            console.error('❌ [EXPIRACION] Error buscando reservas expiradas:', errorExpirar);
            return NextResponse.json({
                error: 'Error buscando reservas expiradas',
                details: errorExpirar.message
            }, { status: 500 });
        }

        let reservasActualizadas = 0;

        if (reservasExpiradas && reservasExpiradas.length > 0) {
            // Actualizar estado a expirada
            const { error: updateError } = await supabase
                .from('reservas')
                .update({ res_estado: 'expirada' })
                .in('res_codigo', reservasExpiradas.map(r => r.res_codigo));

            if (updateError) {
                console.error('❌ [EXPIRACION] Error actualizando reservas:', updateError);
                return NextResponse.json({
                    error: 'Error actualizando reservas',
                    details: updateError.message
                }, { status: 500 });
            }

            // Liberar plazas que estaban reservadas
            for (const reserva of reservasExpiradas) {
                const { error: plazaError } = await supabase
                    .from('plazas')
                    .update({ pla_estado: 'Libre' })
                    .eq('est_id', reserva.est_id)
                    .eq('pla_numero', reserva.pla_numero)
                    .eq('pla_estado', 'Reservada'); // Solo si está Reservada

                if (plazaError) {
                    console.error(`❌ Error liberando plaza ${reserva.pla_numero}:`, plazaError);
                }
            }
            console.log(`✅ [EXPIRACION] ${reservasExpiradas.length} plazas revisadas para liberación`);

            reservasActualizadas = reservasExpiradas.length;
        }

        console.log(`✅ [EXPIRACION] Proceso completado. Reservas expiradas: ${reservasActualizadas}`);

        // Obtener estadísticas adicionales
        const { data: estadisticas, error: statsError } = await supabase
            .from('reservas')
            .select('res_estado')
            .eq('res_estado', 'expirada');

        const totalExpiradas = estadisticas?.length || 0;

        return NextResponse.json({
            success: true,
            message: 'Proceso de expiración completado',
            reservas_expiradas: reservasActualizadas,
            total_expiradas: totalExpiradas,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [EXPIRACION] Error en proceso de expiración:', error);

        return NextResponse.json({
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Error desconocido'
        }, { status: 500 });
    }
}

// Endpoint POST para ejecutar manualmente (opcional)
export async function POST(request: NextRequest) {
    return GET(request);
}
