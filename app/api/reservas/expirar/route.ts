import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function GET(request: NextRequest) {
    try {
        console.log('🔄 [EXPIRACION] Iniciando proceso de expiración automática de reservas');

        // Usar cliente anónimo para este endpoint ya que no requiere autenticación de usuario
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Buscar reservas que expiraron (res_fh_fin ya pasó)
        // NOTA: res_fh_fin es "timestamp without time zone" en Argentina timezone
        const ahoraArgentina = dayjs.utc().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss');
        console.log(`⏰ [EXPIRACION] Hora actual Argentina: ${ahoraArgentina}`);

        const { data: reservasExpiradas, error: errorExpirar } = await supabase
            .from('reservas')
            .select('res_codigo, res_fh_fin, est_id, pla_numero, res_estado')
            .eq('res_estado', 'confirmada')
            .lt('res_fh_fin', ahoraArgentina);

        console.log(`📋 [EXPIRACION] Buscando confirmadas con res_fh_fin < ${ahoraArgentina}`);
        console.log(`📊 [EXPIRACION] Encontradas ${reservasExpiradas?.length || 0} reservas:`);
        if (reservasExpiradas) {
            reservasExpiradas.forEach(r => {
                console.log(`   - ${r.res_codigo}: fin=${r.res_fh_fin}, estado=${r.res_estado}, plaza ${r.pla_numero}`);
            });
        }

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
