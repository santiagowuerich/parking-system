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

// Función para validar la firma del webhook (opcional, depende de la configuración)
function validateWebhookSignature(request: NextRequest): boolean {
    // Implementar validación de firma si está configurada
    // Por ahora retornamos true, pero en producción debería validar la firma
    return true;
}

export async function POST(request: NextRequest) {
    try {
        console.log('🔔 [WEBHOOK] Recibida notificación de MercadoPago');

        // Validar firma del webhook (opcional)
        if (!validateWebhookSignature(request)) {
            console.error('❌ [WEBHOOK] Firma inválida');
            return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
        }

        // Obtener datos del webhook
        const body = await request.json();
        console.log('📥 [WEBHOOK] Datos recibidos:', body);

        // Extraer payment_id del webhook
        const paymentId = body.data?.id || body.id;
        if (!paymentId) {
            console.error('❌ [WEBHOOK] No se encontró payment_id en el webhook');
            return NextResponse.json({ error: 'Payment ID no encontrado' }, { status: 400 });
        }

        console.log(`🔍 [WEBHOOK] Procesando payment_id: ${paymentId}`);

        // Obtener información del pago desde MercadoPago
        const supabase = await createAuthenticatedSupabaseClient();

        // Buscar la reserva asociada a este pago usando external_reference
        // Primero obtenemos la información del pago de MercadoPago para acceder al external_reference
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: paymentId });

        if (!paymentInfo.external_reference) {
            console.error('❌ [WEBHOOK] No se encontró external_reference en el pago de MercadoPago');
            return NextResponse.json({ error: 'External reference no encontrado en el pago' }, { status: 400 });
        }

        console.log(`✅ [WEBHOOK] External reference encontrado: ${paymentInfo.external_reference}`);

        // Buscar la reserva usando el external_reference (que es el res_codigo)
        const { data: reservaData, error: reservaError } = await supabase
            .from('reservas')
            .select(`
        *,
        estacionamientos!inner(est_id, est_nombre, usu_id)
      `)
            .eq('res_codigo', paymentInfo.external_reference)
            .single();

        if (reservaError || !reservaData) {
            console.error('❌ [WEBHOOK] No se encontró reserva para el payment_id:', paymentId);
            return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
        }

        console.log(`✅ [WEBHOOK] Reserva encontrada: ${reservaData.res_codigo}`);

        // Ya tenemos la información del pago obtenida anteriormente
        // Obtener API key del propietario del estacionamiento
        const userId = reservaData.estacionamientos.usu_id;
        const accessToken = await getApiKey(userId);
        const client = new MercadoPagoConfig({ accessToken });

        console.log(`📊 [WEBHOOK] Estado del pago: ${paymentInfo.status}`);

        // Actualizar estado de la reserva según el resultado del pago
        let nuevoEstado: string;
        let mensaje: string;

        switch (paymentInfo.status) {
            case 'approved':
                nuevoEstado = 'confirmada';
                mensaje = 'Pago aprobado exitosamente';
                console.log(`✅ [WEBHOOK] Pago aprobado para reserva ${reservaData.res_codigo}`);

                // Actualizar plaza a Reservada
                const { error: plazaError } = await supabase
                    .from('plazas')
                    .update({ pla_estado: 'Reservada' })
                    .eq('est_id', reservaData.est_id)
                    .eq('pla_numero', reservaData.pla_numero);

                if (plazaError) {
                    console.error('❌ [WEBHOOK] Error actualizando plaza:', plazaError);
                } else {
                    console.log(`✅ [WEBHOOK] Plaza ${reservaData.pla_numero} marcada como Reservada`);
                }
                break;

            case 'rejected':
            case 'cancelled':
                nuevoEstado = 'cancelada';
                mensaje = 'Pago rechazado o cancelado';
                console.log(`❌ [WEBHOOK] Pago rechazado para reserva ${reservaData.res_codigo}`);

                // Liberar plaza
                await supabase
                    .from('plazas')
                    .update({ pla_estado: 'Libre' })
                    .eq('est_id', reservaData.est_id)
                    .eq('pla_numero', reservaData.pla_numero);

                console.log(`❌ [WEBHOOK] Pago rechazado, plaza liberada`);
                break;

            case 'pending':
                nuevoEstado = 'pendiente_pago';
                mensaje = 'Pago pendiente';
                console.log(`⏳ [WEBHOOK] Pago pendiente para reserva ${reservaData.res_codigo}`);
                break;

            default:
                console.log(`⚠️ [WEBHOOK] Estado desconocido: ${paymentInfo.status}`);
                return NextResponse.json({
                    success: true,
                    message: 'Estado de pago no reconocido, no se actualiza la reserva'
                });
        }

        // Actualizar la reserva en la base de datos
        const { error: updateError } = await supabase
            .from('reservas')
            .update({
                res_estado: nuevoEstado,
                pag_nro: paymentId // Guardar el ID del pago
            })
            .eq('res_codigo', reservaData.res_codigo);

        if (updateError) {
            console.error('❌ [WEBHOOK] Error actualizando reserva:', updateError);
            return NextResponse.json({ error: 'Error actualizando reserva' }, { status: 500 });
        }

        console.log(`✅ [WEBHOOK] Reserva ${reservaData.res_codigo} actualizada a estado: ${nuevoEstado}`);

        // Enviar notificación al conductor (opcional)
        if (nuevoEstado === 'confirmada') {
            // Aquí se podría implementar envío de email/SMS al conductor
            console.log(`📧 [WEBHOOK] Enviando notificación de confirmación al conductor`);

            // TODO: Implementar notificación al conductor
            // - Email con código QR
            // - SMS con código de reserva
            // - Push notification si tiene la app
        }

        // Retornar respuesta exitosa
        return NextResponse.json({
            success: true,
            message: mensaje,
            reserva_codigo: reservaData.res_codigo,
            nuevo_estado: nuevoEstado
        });

    } catch (error) {
        console.error('❌ [WEBHOOK] Error procesando webhook:', error);

        return NextResponse.json({
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Error desconocido'
        }, { status: 500 });
    }
}

// Endpoint GET para verificar que el webhook está funcionando
export async function GET(request: NextRequest) {
    return NextResponse.json({
        message: 'Webhook de MercadoPago para reservas está funcionando',
        timestamp: new Date().toISOString()
    });
}
