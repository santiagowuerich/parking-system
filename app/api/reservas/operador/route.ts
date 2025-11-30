import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";
import { ReservasOperadorResponse, ReservaConDetalles, EstadoReserva } from "@/lib/types";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();
        const url = new URL(request.url);

        const estId = Number(url.searchParams.get('est_id'));
        const fecha = url.searchParams.get('fecha');
        const estado = url.searchParams.get('estado') as EstadoReserva;

        // Validar parámetros requeridos
        if (!estId) {
            return NextResponse.json({
                success: false,
                error: 'est_id es requerido'
            }, { status: 400 });
        }

        // Si se proporciona fecha, filtrar por ese día. Si no, mostrar todas las reservas
        let query = supabase
            .from('vw_reservas_detalles')
            .select('*')
            .eq('est_id', estId);

        if (fecha) {
            const fechaConsulta = new Date(fecha);
            const fechaInicio = new Date(fechaConsulta.getFullYear(), fechaConsulta.getMonth(), fechaConsulta.getDate());
            const fechaFin = new Date(fechaInicio.getTime() + (24 * 60 * 60 * 1000));

            console.log(`🔍 Obteniendo reservas del operador: est_id=${estId}, fecha=${fechaInicio.toISOString()}`);

            query = query
                .gte('res_fh_ingreso', fechaInicio.toISOString())
                .lt('res_fh_ingreso', fechaFin.toISOString());
        } else {
            console.log(`🔍 Obteniendo TODAS las reservas del operador: est_id=${estId}`);
        }

        // Aplicar filtro de estado si se proporciona
        if (estado) {
            query = query.eq('res_estado', estado);
        }
        // Si no se proporciona estado, retornar TODAS las reservas sin filtro

        // Ordenar por hora de inicio
        query = query.order('res_fh_ingreso', { ascending: true });

        const { data: reservas, error: reservasError } = await query;

        if (reservasError) {
            console.error('Error obteniendo reservas del operador:', reservasError);
            return NextResponse.json({
                success: false,
                error: 'Error obteniendo reservas'
            }, { status: 500 });
        }

        if (!reservas || reservas.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    reservas: [],
                    total: 0,
                    filtros: {
                        fecha: fecha || undefined,
                        estado: estado || undefined
                    }
                }
            });
        }

        // Formatear reservas para la respuesta y obtener vehículos
        const reservasFormateadas: ReservaConDetalles[] = await Promise.all(
            reservas.map(async (reserva: any) => {
                // Obtener todos los vehículos del conductor para esta reserva
                const { data: vehiculosConductor, error: vehiculosError } = await supabase
                    .from('vehiculos')
                    .select('veh_patente, con_id, catv_segmento, veh_marca, veh_modelo, veh_color')
                    .eq('con_id', reserva.con_id);

                if (vehiculosError) {
                    console.error(`Error obteniendo vehículos para conductor ${reserva.con_id}:`, vehiculosError);
                }

                return {
                    est_id: reserva.est_id,
                    pla_numero: reserva.pla_numero,
                    veh_patente: reserva.veh_patente,
                    res_fh_ingreso: reserva.res_fh_ingreso,
                    res_fh_fin: reserva.res_fh_fin,
                    con_id: reserva.con_id,
                    pag_nro: reserva.pag_nro,
                    res_estado: reserva.res_estado,
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
            })
        );

        console.log(`✅ Encontradas ${reservasFormateadas.length} reservas para el operador`);

        const response: ReservasOperadorResponse = {
            success: true,
            data: {
                reservas: reservasFormateadas,
                total: reservasFormateadas.length,
                filtros: {
                    fecha: fecha || undefined,
                    estado: estado || undefined
                }
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error en consulta de reservas del operador:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}
