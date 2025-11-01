import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";
import { ConfirmarLlegadaRequest, ConfirmarLlegadaResponse } from "@/lib/types";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function POST(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();
        const body: ConfirmarLlegadaRequest = await request.json();

        const { res_codigo, est_id } = body;

        // Validar parámetros requeridos
        if (!res_codigo || !est_id) {
            return NextResponse.json({
                success: false,
                error: 'Código de reserva y estacionamiento son requeridos'
            }, { status: 400 });
        }

        console.log(`🔄 Confirmando llegada para reserva: ${res_codigo} en est_id: ${est_id}`);

        // 1. Buscar la reserva
        const { data: reserva, error: reservaError } = await supabase
            .from('vw_reservas_detalles')
            .select('*')
            .eq('res_codigo', res_codigo)
            .eq('est_id', est_id)
            .eq('res_estado', 'confirmada')
            .single();

        if (reservaError || !reserva) {
            return NextResponse.json({
                success: false,
                error: 'Reserva no encontrada o no está confirmada'
            }, { status: 404 });
        }

        // 2. Verificar que no haya expirado el tiempo pagado
        const ahora = dayjs().tz('America/Argentina/Buenos_Aires');
        const finReserva = dayjs(reserva.res_fh_fin).tz('America/Argentina/Buenos_Aires');

        if (ahora.isAfter(finReserva)) {
            // Marcar como expirada
            await supabase
                .from('reservas')
                .update({ res_estado: 'expirada' })
                .eq('res_codigo', res_codigo)
                .eq('est_id', est_id);

            return NextResponse.json({
                success: false,
                error: 'La reserva ha expirado. El tiempo pagado ya finalizó.'
            }, { status: 410 });
        }

        // 3. Verificar que la plaza esté libre
        const { data: plaza, error: plazaError } = await supabase
            .from('plazas')
            .select('pla_estado')
            .eq('est_id', est_id)
            .eq('pla_numero', reserva.pla_numero)
            .single();

        if (plazaError || !plaza) {
            return NextResponse.json({
                success: false,
                error: 'Plaza no encontrada'
            }, { status: 404 });
        }

        if (plaza.pla_estado !== 'Libre' && plaza.pla_estado !== 'Reservada') {
            return NextResponse.json({
                success: false,
                error: 'La plaza no está disponible'
            }, { status: 409 });
        }

        // 4. Crear registro de ocupación
        const { data: ocupacion, error: ocupacionError } = await supabase
            .from('ocupacion')
            .insert({
                est_id: reserva.est_id,
                veh_patente: reserva.veh_patente,
                ocu_fh_entrada: reserva.res_fh_ingreso,
                pla_numero: reserva.pla_numero,
                ocu_duracion_tipo: 'reserva',
                ocu_precio_acordado: reserva.res_monto,
                pag_nro: reserva.pag_nro,
                res_codigo: reserva.res_codigo,
                ocu_fecha_limite: reserva.res_fh_fin
            })
            .select('ocu_id')
            .single();

        if (ocupacionError) {
            console.error('Error creando ocupación:', ocupacionError);
            return NextResponse.json({
                success: false,
                error: 'Error registrando la ocupación'
            }, { status: 500 });
        }

        // 5. Actualizar estado de la reserva a 'completada' ya que el vehículo ya ingresó
        // La reserva cumplió su propósito (garantizar el lugar) y ya no debe seguir existiendo como activa
        const { error: updateReservaError } = await supabase
            .from('reservas')
            .update({ res_estado: 'completada' })
            .eq('res_codigo', res_codigo)
            .eq('est_id', est_id);

        if (updateReservaError) {
            console.error('Error actualizando reserva:', updateReservaError);
            // Intentar revertir la ocupación creada
            await supabase
                .from('ocupacion')
                .delete()
                .eq('ocu_id', ocupacion.ocu_id);

            return NextResponse.json({
                success: false,
                error: 'Error actualizando el estado de la reserva'
            }, { status: 500 });
        }

        // 6. Actualizar estado de la plaza
        const { error: updatePlazaError } = await supabase
            .from('plazas')
            .update({ pla_estado: 'Ocupada' })
            .eq('est_id', est_id)
            .eq('pla_numero', reserva.pla_numero);

        if (updatePlazaError) {
            console.error('Error actualizando plaza:', updatePlazaError);
            // No revertir todo por este error, solo loggear
        }

        console.log(`✅ Llegada confirmada: reserva ${res_codigo} -> ocupación ${ocupacion.ocu_id}`);

        const response: ConfirmarLlegadaResponse = {
            success: true,
            data: {
                reserva: {
                    est_id: reserva.est_id,
                    pla_numero: reserva.pla_numero,
                    veh_patente: reserva.veh_patente,
                    res_fh_ingreso: reserva.res_fh_ingreso,
                    res_fh_fin: reserva.res_fh_fin,
                    con_id: reserva.con_id,
                    pag_nro: reserva.pag_nro,
                    res_estado: 'completada',
                    res_monto: reserva.res_monto,
                    res_tiempo_gracia_min: reserva.res_tiempo_gracia_min,
                    res_created_at: reserva.res_created_at,
                    res_codigo: reserva.res_codigo
                },
                ocupacion_id: ocupacion.ocu_id,
                mensaje: `Llegada confirmada exitosamente. Vehículo ${reserva.veh_patente} ingresó a la plaza ${reserva.pla_numero}.`
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error confirmando llegada:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}
