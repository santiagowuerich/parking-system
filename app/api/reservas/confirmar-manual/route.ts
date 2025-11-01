import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

// Función auxiliar para obtener la API Key del usuario
async function getApiKey(userId: string | null): Promise<string> {
    if (!userId) {
        throw new Error('Se requiere un ID de usuario para obtener la API Key');
    }

    const supabase = await createAuthenticatedSupabaseClient();
    const { data, error } = await supabase
        .from("user_settings")
        .select("mercadopago_api_key")
        .eq("user_id", userId)
        .single();

    if (error) {
        console.error(`Error fetching API key for user ${userId}:`, error.message);
        throw new Error('Error al obtener la API Key del usuario');
    }

    if (!data?.mercadopago_api_key) {
        throw new Error('No se encontró una API Key configurada. Por favor, configura tu API Key de MercadoPago en el panel de tarifas.');
    }

    const key = data.mercadopago_api_key.trim();
    if (!key.startsWith('TEST-') && !key.startsWith('APP_USR-')) {
        throw new Error('El formato de la API Key no es válido. Debe comenzar con TEST- o APP_USR-');
    }

    return key;
}

export async function POST(request: NextRequest) {
    try {
        const { res_codigo, preference_id, reserva_data } = await request.json();
        const supabase = await createAuthenticatedSupabaseClient();

        console.log(`🔍 [CONFIRMAR-MANUAL] Confirmando reserva manualmente - res_codigo: ${res_codigo}, preference_id: ${preference_id}, reserva_data:`, reserva_data ? 'presente' : 'no presente');

        let reserva: any = null;

        // CASO 1: Viene reserva_data (backup - reserva debería existir pero por si acaso)
        if (reserva_data) {
            console.log('🔍 [CONFIRMAR-MANUAL] Buscando reserva existente primero...');
            
            // Primero intentar buscar la reserva existente
            const { data: reservaExistente, error: searchError } = await supabase
                .from('reservas')
                .select('*')
                .eq('res_codigo', reserva_data.res_codigo)
                .single();

            if (reservaExistente) {
                console.log(`✅ [CONFIRMAR-MANUAL] Reserva encontrada: ${reservaExistente.res_codigo}`);
                reserva = reservaExistente;
            } else {
                // Si no existe, crear (fallback - no debería pasar)
                console.log('⚠️ [CONFIRMAR-MANUAL] Reserva no encontrada, creando como fallback...');
                const { data: nuevaReserva, error: insertError } = await supabase
                    .from('reservas')
                    .insert({
                        ...reserva_data,
                        res_estado: 'confirmada',
                        payment_info: { preference_id }
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('❌ [CONFIRMAR-MANUAL] Error creando la reserva:', insertError);
                    return NextResponse.json({
                        success: false,
                        error: 'Error creando la reserva: ' + insertError.message
                    }, { status: 500 });
                }

                reserva = nuevaReserva;
                console.log(`✅ [CONFIRMAR-MANUAL] Reserva creada con código: ${reserva.res_codigo}`);
            }
        } else {
            // CASO 2: Reserva ya existe (re-confirmación o webhook falló)
            console.log('🔍 [CONFIRMAR-MANUAL] Buscando reserva existente...');

            if (res_codigo) {
                const { data, error } = await supabase
                    .from('reservas')
                    .select('*')
                    .eq('res_codigo', res_codigo)
                    .eq('res_estado', 'pendiente_pago')
                    .single();

                if (error) {
                    console.error('❌ [CONFIRMAR-MANUAL] Error buscando reserva:', error);
                }
                reserva = data;
            } else if (preference_id) {
                // Buscar por preference_id en payment_info
                const { data: allReservas, error } = await supabase
                    .from('reservas')
                    .select('*')
                    .eq('res_estado', 'pendiente_pago');

                if (error) {
                    console.error('❌ [CONFIRMAR-MANUAL] Error buscando reservas:', error);
                }

                reserva = allReservas?.find((r: any) =>
                    r.payment_info?.preference_id === preference_id
                );
            }

            if (!reserva) {
                console.error('❌ [CONFIRMAR-MANUAL] Reserva no encontrada o ya procesada');
                return NextResponse.json({
                    success: false,
                    error: 'Reserva no encontrada o ya fue confirmada'
                }, { status: 404 });
            }

            console.log(`✅ [CONFIRMAR-MANUAL] Reserva encontrada: ${reserva.res_codigo}`);

            // Confirmar reserva existente
            const { error: updateError } = await supabase
                .from('reservas')
                .update({
                    res_estado: 'confirmada'
                })
                .eq('res_codigo', reserva.res_codigo);

            if (updateError) {
                console.error('❌ [CONFIRMAR-MANUAL] Error actualizando reserva:', updateError);
                return NextResponse.json({
                    success: false,
                    error: 'Error confirmando la reserva'
                }, { status: 500 });
            }

            console.log(`✅ [CONFIRMAR-MANUAL] Reserva ${reserva.res_codigo} actualizada a confirmada`);
        }


        // Marcar plaza como reservada
        const { error: plazaError } = await supabase
            .from('plazas')
            .update({ pla_estado: 'Reservada' })
            .eq('est_id', reserva.est_id)
            .eq('pla_numero', reserva.pla_numero);

        if (plazaError) {
            console.error('❌ [CONFIRMAR-MANUAL] Error actualizando plaza:', plazaError);
        } else {
            console.log(`✅ [CONFIRMAR-MANUAL] Plaza ${reserva.pla_numero} marcada como Reservada`);
        }

        console.log(`✅ [CONFIRMAR-MANUAL] Reserva ${reserva.res_codigo} confirmada exitosamente`);

        return NextResponse.json({
            success: true,
            message: 'Reserva confirmada exitosamente',
            reserva: {
                res_codigo: reserva.res_codigo,
                res_estado: 'confirmada'
            }
        });

    } catch (error) {
        console.error('❌ [CONFIRMAR-MANUAL] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Error interno del servidor'
        }, { status: 500 });
    }
}


