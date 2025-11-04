import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();
        const url = new URL(request.url);

        const estId = Number(url.searchParams.get('est_id'));
        const plaNumero = Number(url.searchParams.get('pla_numero'));

        // Validar parámetros requeridos
        if (!estId || !plaNumero) {
            return NextResponse.json({
                success: false,
                error: 'est_id y pla_numero son requeridos'
            }, { status: 400 });
        }

        console.log(`🔍 Obteniendo reserva para plaza ${plaNumero} del estacionamiento ${estId}`);

        // Buscar reserva para esta plaza (incluyendo pendiente_pago, confirmada, activa)
        // También buscamos pendiente_confirmacion_operador ya que la plaza puede estar reservada
        const { data: reservas, error: reservasError } = await supabase
            .from('vw_reservas_detalles')
            .select('*')
            .eq('est_id', estId)
            .eq('pla_numero', plaNumero)
            .in('res_estado', ['pendiente_pago', 'pendiente_confirmacion_operador', 'confirmada', 'activa'])
            .order('res_fh_ingreso', { ascending: false })
            .limit(1);

        if (reservasError) {
            console.error('❌ Error obteniendo reserva:', reservasError);
            return NextResponse.json({
                success: false,
                error: 'Error obteniendo reserva'
            }, { status: 500 });
        }

        console.log(`📊 Resultado de la consulta: ${reservas?.length || 0} reservas encontradas`);
        if (reservas && reservas.length > 0) {
            console.log(`✅ Reserva encontrada: ${reservas[0].res_codigo} - Estado: ${reservas[0].res_estado}`);
        } else {
            console.log(`⚠️ No se encontraron reservas para plaza ${plaNumero} del estacionamiento ${estId}`);
        }

        if (!reservas || reservas.length === 0) {
            return NextResponse.json({
                success: true,
                data: null
            });
        }

        const reserva = reservas[0];

        // Obtener todos los vehículos del conductor
        console.log(`🔍 Obteniendo vehículos del conductor ${reserva.con_id}...`);
        const { data: vehiculosConductor, error: vehiculosError } = await supabase
            .from('vehiculos')
            .select('veh_patente, con_id, catv_segmento, veh_marca, veh_modelo, veh_color')
            .eq('con_id', reserva.con_id);

        if (vehiculosError) {
            console.error('❌ Error obteniendo vehículos del conductor:', vehiculosError);
        }

        console.log(`✅ Encontrados ${vehiculosConductor?.length || 0} vehículos del conductor`);

        // Formatear datos para la respuesta
        const reservaFormateada = {
            est_id: reserva.est_id,
            pla_numero: reserva.pla_numero,
            veh_patente: reserva.veh_patente,
            res_fh_ingreso: reserva.res_fh_ingreso,
            res_fh_fin: reserva.res_fh_fin,
            con_id: reserva.con_id,
            pag_nro: reserva.pag_nro,
            res_estado: reserva.estado_calculado || reserva.res_estado,
            res_monto: reserva.res_monto,
            res_tiempo_gracia_min: reserva.res_tiempo_gracia_min,
            res_created_at: reserva.res_created_at,
            res_codigo: reserva.res_codigo,
            metodo_pago: reserva.metodo_pago || 'transferencia',
            payment_info: reserva.payment_info || null,
            estacionamiento: {
                est_nombre: reserva.est_nombre,
                est_direc: reserva.est_direc,
                est_telefono: reserva.est_telefono,
                est_email: reserva.est_email
            },
            plaza: {
                pla_zona: reserva.pla_zona,
                catv_segmento: reserva.catv_segmento
            },
            vehiculo: {
                veh_marca: reserva.veh_marca || '',
                veh_modelo: reserva.veh_modelo || '',
                veh_color: reserva.veh_color || ''
            },
            conductor: {
                usu_nom: reserva.usu_nom,
                usu_ape: reserva.usu_ape,
                usu_tel: reserva.usu_tel || '',
                usu_email: reserva.usu_email
            },
            vehiculos: vehiculosConductor || [] // ← NUEVO: todos los vehículos del conductor
        };

        console.log(`✅ Reserva encontrada para plaza ${plaNumero}`);

        return NextResponse.json({
            success: true,
            data: reservaFormateada
        });

    } catch (error: any) {
        console.error('❌ Error en API de reservas por plaza:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error interno del servidor'
        }, { status: 500 });
    }
}
