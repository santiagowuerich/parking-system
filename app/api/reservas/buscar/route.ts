import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";
import { BuscarReservaResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();
        const url = new URL(request.url);

        const codigo = url.searchParams.get('codigo');
        const patente = url.searchParams.get('patente');
        const estId = Number(url.searchParams.get('est_id'));

        // Validar que se proporcione al menos un criterio de búsqueda
        if (!codigo && !patente) {
            return NextResponse.json({
                success: false,
                error: 'Debe proporcionar código de reserva o patente del vehículo'
            }, { status: 400 });
        }

        console.log(`🔍 Buscando reserva: código=${codigo}, patente=${patente}, est_id=${estId}`);

        // Construir query base
        let query = supabase
            .from('vw_reservas_detalles')
            .select('*');

        // Aplicar filtros según los parámetros proporcionados
        if (codigo) {
            query = query.eq('res_codigo', codigo);
        }

        if (patente) {
            query = query.eq('veh_patente', patente);
        }

        if (estId) {
            query = query.eq('est_id', estId);
        }

        // Buscar reservas confirmadas, activas, pendiente_pago o pendiente_confirmacion_operador (transferencias pendientes de confirmación del operador)
        query = query.in('res_estado', ['confirmada', 'activa', 'pendiente_pago', 'pendiente_confirmacion_operador']);

        // Ordenar por fecha de inicio descendente
        query = query.order('res_fh_ingreso', { ascending: false });

        const { data: reservas, error: reservasError } = await query;

        if (reservasError) {
            console.error('Error buscando reservas:', reservasError);
            return NextResponse.json({
                success: false,
                error: 'Error buscando reservas'
            }, { status: 500 });
        }

        if (!reservas || reservas.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No se encontró ninguna reserva con los criterios especificados'
            }, { status: 404 });
        }

        // Tomar la primera reserva encontrada (la más reciente)
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

        console.log(`✅ Reserva encontrada: ${reserva.res_codigo} para vehículo ${reserva.veh_patente}`);

        const response: BuscarReservaResponse = {
            success: true,
            data: reservaFormateada
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error en búsqueda de reserva:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}
