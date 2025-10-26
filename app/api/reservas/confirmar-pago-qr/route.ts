import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function POST(request: NextRequest) {
    try {
        console.log('🔍 [CONFIRMAR-QR] Iniciando confirmación de pago QR');

        const supabase = await createAuthenticatedSupabaseClient();
        const { preference_id, res_codigo } = await request.json();

        if (!preference_id && !res_codigo) {
            return NextResponse.json({
                success: false,
                error: 'preference_id o res_codigo es requerido'
            }, { status: 400 });
        }

        console.log(`🔍 [CONFIRMAR-QR] Buscando reserva pendiente para preference_id: ${preference_id} o res_codigo: ${res_codigo}`);

        let reserva: any = null;

        if (res_codigo) {
            // Búsqueda por código directo
            const { data, error } = await supabase
                .from('reservas')
                .select('*')
                .eq('res_codigo', res_codigo)
                .eq('res_estado', 'pendiente_pago')
                .eq('metodo_pago', 'qr')
                .single();

            if (error) {
                console.error('❌ [CONFIRMAR-QR] Error buscando por res_codigo:', error);
            }
            reserva = data;
        } else if (preference_id) {
            // Búsqueda por preference_id - obtener todas las pendientes y filtrar en memoria
            const { data: allReservas, error } = await supabase
                .from('reservas')
                .select('*')
                .eq('res_estado', 'pendiente_pago')
                .eq('metodo_pago', 'qr');

            if (error) {
                console.error('❌ [CONFIRMAR-QR] Error buscando reservas:', error);
            }

            console.log(`🔍 [CONFIRMAR-QR] Encontradas ${allReservas?.length || 0} reservas pendientes`);

            // Filtrar por preference_id en payment_info
            if (allReservas && allReservas.length > 0) {
                reserva = allReservas.find((r: any) => {
                    const prefId = r.payment_info?.preference_id;
                    console.log(`   Comparando preference_id: ${prefId} === ${preference_id}`);
                    return prefId === preference_id;
                });
            }
        }

        if (!reserva) {
            console.error('❌ [CONFIRMAR-QR] Reserva no encontrada');
            return NextResponse.json({
                success: false,
                error: 'Reserva pendiente no encontrada o ya fue procesada'
            }, { status: 404 });
        }

        console.log(`✅ [CONFIRMAR-QR] Reserva encontrada: ${reserva.res_codigo}`);

        // Actualizar estado de la reserva a confirmada
        console.log('💰 [CONFIRMAR-QR] Actualizando estado de reserva a confirmada...');

        const { data: reservaActualizada, error: updateError } = await supabase
            .from('reservas')
            .update({ res_estado: 'confirmada' })
            .eq('res_codigo', reserva.res_codigo)
            .select()
            .single();

        if (updateError) {
            console.error('❌ [CONFIRMAR-QR] Error actualizando reserva:', updateError);
            return NextResponse.json({
                success: false,
                error: 'Error confirmando la reserva: ' + updateError.message
            }, { status: 500 });
        }

        console.log(`✅ [CONFIRMAR-QR] Reserva confirmada exitosamente: ${reservaActualizada.res_codigo}`);

        return NextResponse.json({
            success: true,
            message: 'Pago confirmado exitosamente',
            data: {
                reserva: reservaActualizada
            }
        });

    } catch (error) {
        console.error('❌ [CONFIRMAR-QR] Error en confirmación de pago QR:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}

// Endpoint GET para verificar estado de pago QR (útil para polling desde el frontend)
export async function GET(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();
        const url = new URL(request.url);
        const preference_id = url.searchParams.get('preference_id');
        const res_codigo = url.searchParams.get('res_codigo');

        if (!preference_id && !res_codigo) {
            return NextResponse.json({
                success: false,
                error: 'preference_id o res_codigo es requerido'
            }, { status: 400 });
        }

        console.log(`🔍 [VERIFICAR-QR] Verificando estado para preference_id: ${preference_id} o res_codigo: ${res_codigo}`);

        let reserva: any = null;

        if (res_codigo) {
            // Búsqueda por código directo
            const { data, error } = await supabase
                .from('reservas')
                .select('*')
                .eq('res_codigo', res_codigo)
                .eq('metodo_pago', 'qr')
                .single();

            if (error) {
                console.error('❌ [VERIFICAR-QR] Error buscando por res_codigo:', error);
            }
            reserva = data;
        } else if (preference_id) {
            // Búsqueda por preference_id - obtener todas las QR y filtrar en memoria
            const { data: allReservas, error } = await supabase
                .from('reservas')
                .select('*')
                .eq('metodo_pago', 'qr');

            if (error) {
                console.error('❌ [VERIFICAR-QR] Error buscando reservas:', error);
            }

            // Filtrar por preference_id en payment_info
            if (allReservas && allReservas.length > 0) {
                reserva = allReservas.find((r: any) => r.payment_info?.preference_id === preference_id);
            }
        }

        if (!reserva) {
            return NextResponse.json({
                success: false,
                error: 'Reserva QR no encontrada'
            }, { status: 404 });
        }

        // Verificar el estado de la reserva
        if (reserva.res_estado === 'confirmada') {
            return NextResponse.json({
                success: true,
                estado: 'confirmado',
                reserva: reserva
            });
        } else if (reserva.res_estado === 'pendiente_pago') {
            return NextResponse.json({
                success: true,
                estado: 'pendiente',
                reserva: reserva
            });
        } else {
            // Otros estados
            return NextResponse.json({
                success: true,
                estado: reserva.res_estado,
                reserva: reserva
            });
        }

    } catch (error) {
        console.error('❌ [VERIFICAR-QR] Error verificando estado:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}

// Endpoint PUT para confirmar manualmente un pago QR (SOLO PARA DESARROLLO)
export async function PUT(request: NextRequest) {
    try {
        console.log('🔧 [CONFIRMAR-QR-MANUAL] Confirmación manual de pago QR (DESARROLLO)');

        // Verificar que estemos en desarrollo
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({
                success: false,
                error: 'Este endpoint solo está disponible en desarrollo'
            }, { status: 403 });
        }

        const supabase = await createAuthenticatedSupabaseClient();
        const { preference_id, res_codigo } = await request.json();

        if (!preference_id && !res_codigo) {
            return NextResponse.json({
                success: false,
                error: 'preference_id o res_codigo es requerido'
            }, { status: 400 });
        }

        console.log(`🔧 [CONFIRMAR-QR-MANUAL] Confirmando manualmente pago para preference_id: ${preference_id} o res_codigo: ${res_codigo}`);

        let reserva: any = null;

        if (res_codigo) {
            // Búsqueda por código directo
            const { data, error } = await supabase
                .from('reservas')
                .select('*')
                .eq('res_codigo', res_codigo)
                .eq('res_estado', 'pendiente_pago')
                .eq('metodo_pago', 'qr')
                .single();

            if (error) {
                console.error('❌ [CONFIRMAR-QR-MANUAL] Error buscando por res_codigo:', error);
            }
            reserva = data;
        } else if (preference_id) {
            // Búsqueda por preference_id - obtener todas las pendientes y filtrar en memoria
            const { data: allReservas, error } = await supabase
                .from('reservas')
                .select('*')
                .eq('res_estado', 'pendiente_pago')
                .eq('metodo_pago', 'qr');

            if (error) {
                console.error('❌ [CONFIRMAR-QR-MANUAL] Error buscando reservas:', error);
            }

            // Filtrar por preference_id en payment_info
            if (allReservas && allReservas.length > 0) {
                reserva = allReservas.find((r: any) => r.payment_info?.preference_id === preference_id);
            }
        }

        if (!reserva) {
            return NextResponse.json({
                success: false,
                error: 'Reserva pendiente no encontrada'
            }, { status: 404 });
        }

        console.log(`✅ [CONFIRMAR-QR-MANUAL] Reserva encontrada: ${reserva.res_codigo}`);

        // Actualizar estado a confirmada
        const { data: reservaActualizada, error: updateError } = await supabase
            .from('reservas')
            .update({ res_estado: 'confirmada' })
            .eq('res_codigo', reserva.res_codigo)
            .select()
            .single();

        if (updateError) {
            console.error('❌ [CONFIRMAR-QR-MANUAL] Error actualizando reserva:', updateError);
            return NextResponse.json({
                success: false,
                error: 'Error confirmando la reserva: ' + updateError.message
            }, { status: 500 });
        }

        console.log(`✅ [CONFIRMAR-QR-MANUAL] Reserva confirmada exitosamente: ${reservaActualizada.res_codigo}`);

        return NextResponse.json({
            success: true,
            message: 'Pago confirmado manualmente (DESARROLLO)',
            data: {
                reserva: reservaActualizada
            }
        });

    } catch (error) {
        console.error('❌ [CONFIRMAR-QR-MANUAL] Error en confirmación manual:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}
