import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

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

        // CASO 1: Viene reserva_data (esto es para QR - crear reserva confirmada)
        if (reserva_data) {
            console.log('🔍 [CONFIRMAR-MANUAL] Buscando reserva existente primero...');
            console.log('📋 [CONFIRMAR-MANUAL] Datos de reserva_data recibidos:', {
                res_codigo: reserva_data.res_codigo,
                pla_numero: reserva_data.pla_numero,
                est_id: reserva_data.est_id,
                veh_patente: reserva_data.veh_patente
            });
            
            // Primero intentar buscar la reserva existente (por si acaso ya existe)
            const { data: reservaExistente, error: searchError } = await supabase
                .from('reservas')
                .select('*')
                .eq('res_codigo', reserva_data.res_codigo)
                .single();

            // Variable para verificar si los datos coinciden (usada más adelante)
            let datosCoinciden = false;

            if (reservaExistente) {
                console.log(`✅ [CONFIRMAR-MANUAL] Reserva encontrada: ${reservaExistente.res_codigo}`);
                console.log('📋 [CONFIRMAR-MANUAL] Datos de reserva existente:', {
                    pla_numero: reservaExistente.pla_numero,
                    est_id: reservaExistente.est_id,
                    veh_patente: reservaExistente.veh_patente
                });
                
                // VERIFICAR QUE LOS DATOS COINCIDAN CON LOS ENVIADOS
                // Si no coinciden, es una reserva diferente con código duplicado (no debería pasar)
                datosCoinciden = 
                    reservaExistente.pla_numero === reserva_data.pla_numero &&
                    reservaExistente.est_id === reserva_data.est_id &&
                    reservaExistente.veh_patente === reserva_data.veh_patente;
                
                if (!datosCoinciden) {
                    console.error('❌ [CONFIRMAR-MANUAL] La reserva existente NO coincide con los datos enviados');
                    console.error('📋 [CONFIRMAR-MANUAL] Comparación:', {
                        existente: {
                            pla_numero: reservaExistente.pla_numero,
                            est_id: reservaExistente.est_id,
                            veh_patente: reservaExistente.veh_patente
                        },
                        enviado: {
                            pla_numero: reserva_data.pla_numero,
                            est_id: reserva_data.est_id,
                            veh_patente: reserva_data.veh_patente
                        }
                    });
                    console.log('⚠️ [CONFIRMAR-MANUAL] Código duplicado detectado. Continuando con creación de nueva reserva con nuevos datos...');
                    // No retornar error, simplemente continuar y crear una nueva reserva
                    // Esto significa que el código fue reutilizado incorrectamente, pero queremos crear la reserva correcta
                } else {

                    // Si los datos coinciden, actualizar a confirmada
                    const { error: updateError } = await supabase
                        .from('reservas')
                        .update({
                            res_estado: 'confirmada',
                            payment_info: { ...reservaExistente.payment_info, preference_id }
                        })
                        .eq('res_codigo', reservaExistente.res_codigo);

                    if (updateError) {
                        console.error('❌ [CONFIRMAR-MANUAL] Error actualizando reserva:', updateError);
                        return NextResponse.json({
                            success: false,
                            error: 'Error confirmando la reserva: ' + updateError.message
                        }, { status: 500 });
                    }

                    reserva = { ...reservaExistente, res_estado: 'confirmada' };
                    console.log(`✅ [CONFIRMAR-MANUAL] Reserva ${reserva.res_codigo} actualizada a confirmada`);

                    // Registrar pago en tabla pagos (si no existe)
                    if (!reservaExistente.pag_nro) {
                        try {
                            console.log(`💰 [CONFIRMAR-MANUAL] Registrando pago para reserva ${reserva.res_codigo}`);

                            const { data: pagoInsertado, error: pagoError } = await supabase
                                .from('pagos')
                                .insert({
                                    pag_monto: reserva.res_monto,
                                    pag_h_fh: new Date().toISOString(),
                                    est_id: reserva.est_id,
                                    mepa_metodo: 'MercadoPago',
                                    veh_patente: reserva.veh_patente,
                                    pag_tipo: 'reserva',
                                    pag_descripcion: `Pago de reserva ${reserva.res_codigo}`,
                                    pag_estado: 'completado',
                                    pag_datos_tarjeta: {
                                        preference_id: preference_id || null,
                                        reserva_codigo: reserva.res_codigo,
                                        tipo_pago: 'reserva'
                                    }
                                })
                                .select('pag_nro')
                                .single();

                            if (pagoError) {
                                console.error('❌ [CONFIRMAR-MANUAL] Error registrando pago:', pagoError);
                            } else if (pagoInsertado) {
                                console.log(`✅ [CONFIRMAR-MANUAL] Pago registrado: pag_nro=${pagoInsertado.pag_nro}`);

                                // Actualizar reserva con pag_nro
                                const { error: updatePagNroError } = await supabase
                                    .from('reservas')
                                    .update({ pag_nro: pagoInsertado.pag_nro })
                                    .eq('res_codigo', reserva.res_codigo);

                                if (updatePagNroError) {
                                    console.error('⚠️ [CONFIRMAR-MANUAL] Error actualizando pag_nro:', updatePagNroError);
                                } else {
                                    console.log(`✅ [CONFIRMAR-MANUAL] Reserva vinculada con pago: pag_nro=${pagoInsertado.pag_nro}`);
                                }
                            }
                        } catch (error) {
                            console.error('❌ [CONFIRMAR-MANUAL] Error en registro de pago:', error);
                        }
                    }

                    // Salir aquí si se actualizó correctamente
                    // Marcar plaza como reservada usando los datos de la reserva actualizada
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
                }
            }
            
            // Si llegamos aquí, significa que no se encontró reserva existente
            // O se encontró pero con datos diferentes (lo cual significa error de datos, no debería pasar con códigos determinísticos)
            // Continuar con la creación de nueva reserva
            // Para QR, crear la reserva con estado confirmada (el usuario ya confirmó el pago)
            console.log('📦 [CONFIRMAR-MANUAL] Creando reserva confirmada desde datos temporales...');

            // Reutilizar el código de reserva enviado (es determinístico para QR)
            let codigoReservaFinal = reserva_data.res_codigo;

            if (reservaExistente && !datosCoinciden) {
                console.error('❌ [CONFIRMAR-MANUAL] ERROR: Código de reserva duplicado detectado pero con datos diferentes');
                console.error('📋 [CONFIRMAR-MANUAL] Esto indica que el código no fue generado correctamente o hay un error');
                console.error('   Código:', codigoReservaFinal);
                console.error('   Datos esperados:', { pla: reserva_data.pla_numero, est: reserva_data.est_id, patente: reserva_data.veh_patente });
                console.error('   Datos en DB:', { pla: reservaExistente.pla_numero, est: reservaExistente.est_id, patente: reservaExistente.veh_patente });

                // Retornar error en lugar de crear una nueva reserva con código diferente
                return NextResponse.json({
                    success: false,
                    error: 'Código de reserva duplicado detectado con datos diferentes. Por favor, intenta de nuevo.'
                }, { status: 409 });
            }
            
            console.log('📋 [CONFIRMAR-MANUAL] Datos que se insertarán:', {
                est_id: reserva_data.est_id,
                pla_numero: reserva_data.pla_numero,
                veh_patente: reserva_data.veh_patente,
                res_codigo: codigoReservaFinal,
                res_monto: reserva_data.res_monto
            });
            
            // Extraer payment_info si viene en reserva_data, sino usar preference_id
            const paymentInfoFinal = reserva_data.payment_info
                ? { ...reserva_data.payment_info, preference_id: preference_id || reserva_data.payment_info.preference_id }
                : (preference_id ? { preference_id } : null);

            // Remover payment_info de reserva_data antes de insertar (ya que va como campo separado)
            const { payment_info, ...reservaDataSinPaymentInfo } = reserva_data;

            // FIX: Establecer res_created_at explícitamente en Argentina timezone
            const fechaCreacionArgentina = dayjs.utc().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss');

            const { data: nuevaReserva, error: insertError } = await supabase
                .from('reservas')
                .insert({
                    ...reservaDataSinPaymentInfo,
                    res_codigo: codigoReservaFinal, // Usar código final (puede ser nuevo si hubo conflicto)
                    res_estado: 'confirmada', // Crear directamente como confirmada
                    res_created_at: fechaCreacionArgentina,
                    payment_info: paymentInfoFinal
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
            console.log('📋 [CONFIRMAR-MANUAL] Datos de reserva creada:', {
                pla_numero: reserva.pla_numero,
                est_id: reserva.est_id,
                veh_patente: reserva.veh_patente
            });

            // Registrar pago en tabla pagos (si no existe)
            if (!reserva.pag_nro) {
                try {
                    console.log(`💰 [CONFIRMAR-MANUAL] Registrando pago para reserva ${reserva.res_codigo}`);

                    const { data: pagoInsertado, error: pagoError } = await supabase
                        .from('pagos')
                        .insert({
                            pag_monto: reserva.res_monto,
                            pag_h_fh: new Date().toISOString(),
                            est_id: reserva.est_id,
                            mepa_metodo: 'MercadoPago',
                            veh_patente: reserva.veh_patente,
                            pag_tipo: 'reserva',
                            pag_descripcion: `Pago de reserva ${reserva.res_codigo}`,
                            pag_estado: 'completado',
                            pag_datos_tarjeta: {
                                preference_id: preference_id || null,
                                reserva_codigo: reserva.res_codigo,
                                tipo_pago: 'reserva'
                            }
                        })
                        .select('pag_nro')
                        .single();

                    if (pagoError) {
                        console.error('❌ [CONFIRMAR-MANUAL] Error registrando pago:', pagoError);
                    } else if (pagoInsertado) {
                        console.log(`✅ [CONFIRMAR-MANUAL] Pago registrado: pag_nro=${pagoInsertado.pag_nro}`);

                        // Actualizar reserva con pag_nro
                        const { error: updatePagNroError } = await supabase
                            .from('reservas')
                            .update({ pag_nro: pagoInsertado.pag_nro })
                            .eq('res_codigo', reserva.res_codigo);

                        if (updatePagNroError) {
                            console.error('⚠️ [CONFIRMAR-MANUAL] Error actualizando pag_nro:', updatePagNroError);
                        } else {
                            console.log(`✅ [CONFIRMAR-MANUAL] Reserva vinculada con pago: pag_nro=${pagoInsertado.pag_nro}`);
                            reserva.pag_nro = pagoInsertado.pag_nro;
                        }
                    }
                } catch (error) {
                    console.error('❌ [CONFIRMAR-MANUAL] Error en registro de pago:', error);
                }
            }

            // Marcar plaza como reservada usando los datos de la reserva creada
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

            // Registrar pago en tabla pagos (si no existe)
            if (!reserva.pag_nro) {
                try {
                    console.log(`💰 [CONFIRMAR-MANUAL] Registrando pago para reserva ${reserva.res_codigo}`);

                    const { data: pagoInsertado, error: pagoError } = await supabase
                        .from('pagos')
                        .insert({
                            pag_monto: reserva.res_monto,
                            pag_h_fh: new Date().toISOString(),
                            est_id: reserva.est_id,
                            mepa_metodo: 'MercadoPago',
                            veh_patente: reserva.veh_patente,
                            pag_tipo: 'reserva',
                            pag_descripcion: `Pago de reserva ${reserva.res_codigo}`,
                            pag_estado: 'completado',
                            pag_datos_tarjeta: {
                                preference_id: preference_id || null,
                                reserva_codigo: reserva.res_codigo,
                                tipo_pago: 'reserva'
                            }
                        })
                        .select('pag_nro')
                        .single();

                    if (pagoError) {
                        console.error('❌ [CONFIRMAR-MANUAL] Error registrando pago:', pagoError);
                    } else if (pagoInsertado) {
                        console.log(`✅ [CONFIRMAR-MANUAL] Pago registrado: pag_nro=${pagoInsertado.pag_nro}`);

                        // Actualizar reserva con pag_nro
                        const { error: updatePagNroError } = await supabase
                            .from('reservas')
                            .update({ pag_nro: pagoInsertado.pag_nro })
                            .eq('res_codigo', reserva.res_codigo);

                        if (updatePagNroError) {
                            console.error('⚠️ [CONFIRMAR-MANUAL] Error actualizando pag_nro:', updatePagNroError);
                        } else {
                            console.log(`✅ [CONFIRMAR-MANUAL] Reserva vinculada con pago: pag_nro=${pagoInsertado.pag_nro}`);
                        }
                    }
                } catch (error) {
                    console.error('❌ [CONFIRMAR-MANUAL] Error en registro de pago:', error);
                }
            }
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


