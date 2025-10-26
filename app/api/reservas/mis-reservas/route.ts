import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";
import { MisReservasResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();

        console.log("📋 [MIS-RESERVAS] Obteniendo reservas del conductor autenticado");

        // Verificar autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error("❌ [MIS-RESERVAS] Usuario no autenticado");
            return NextResponse.json({
                success: false,
                error: 'Usuario no autenticado'
            }, { status: 401 });
        }

        console.log(`👤 [MIS-RESERVAS] Usuario auth: ${user.id}`);

        // Obtener usu_id del usuario autenticado
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('auth_user_id', user.id)
            .single();

        if (usuarioError || !usuarioData) {
            console.error("❌ [MIS-RESERVAS] Usuario no encontrado en BD:", usuarioError?.message);
            return NextResponse.json({
                success: false,
                error: 'Usuario no encontrado'
            }, { status: 404 });
        }

        console.log(`👨 [MIS-RESERVAS] Usuario BD: ${usuarioData.usu_id}`);

        // Obtener datos del conductor (con mismo ID que usuario)
        const { data: conductor, error: conductorError } = await supabase
            .from('conductores')
            .select('con_id')
            .eq('con_id', usuarioData.usu_id)
            .single();

        if (conductorError || !conductor) {
            console.error("❌ [MIS-RESERVAS] Conductor no encontrado:", conductorError?.message);
            return NextResponse.json({
                success: false,
                error: 'Conductor no encontrado'
            }, { status: 403 });
        }

        console.log(`🚗 [MIS-RESERVAS] Conductor ID: ${conductor.con_id}`);

        // Obtener reservas con SQL raw para evitar problemas con JOINs automáticos de Supabase
        const { data: reservas, error: reservasError } = await supabase.rpc('get_conductor_reservas', {
            p_conductor_id: conductor.con_id
        });

        if (reservasError) {
            console.error('❌ [MIS-RESERVAS] Error obteniendo reservas:', reservasError);

            // Fallback: obtener solo las reservas sin JOINs
            console.log("📋 [MIS-RESERVAS] Usando fallback sin JOINs...");
            const { data: simpleReservas, error: simpleError } = await supabase
                .from('reservas')
                .select('*')
                .eq('con_id', conductor.con_id)
                .order('res_fh_ingreso', { ascending: false });

            if (simpleError) {
                console.error('❌ [MIS-RESERVAS] Error en fallback:', simpleError);
                return NextResponse.json({
                    success: false,
                    error: 'Error obteniendo reservas: ' + simpleError.message
                }, { status: 500 });
            }

            // Enriquecer con datos relacionados
            const reservasEnriquecidas = await Promise.all((simpleReservas || []).map(async (r: any) => {
                // Obtener estacionamiento
                const { data: estacionamiento } = await supabase
                    .from('estacionamientos')
                    .select('est_nombre, est_direc, est_telefono, est_email')
                    .eq('est_id', r.est_id)
                    .single();

                // Obtener plaza
                const { data: plaza } = await supabase
                    .from('plazas')
                    .select('pla_zona, catv_segmento')
                    .eq('est_id', r.est_id)
                    .eq('pla_numero', r.pla_numero)
                    .single();

                // Obtener vehículo
                const { data: vehiculo } = await supabase
                    .from('vehiculos')
                    .select('veh_marca, veh_modelo, veh_color')
                    .eq('veh_patente', r.veh_patente)
                    .single();

                // Obtener usuario del conductor
                const { data: usuarioData } = await supabase
                    .from('usuario')
                    .select('usu_nom, usu_ape, usu_tel, usu_email')
                    .eq('usu_id', r.con_id)
                    .single();

                return {
                    est_id: r.est_id,
                    pla_numero: r.pla_numero,
                    veh_patente: r.veh_patente,
                    res_fh_ingreso: r.res_fh_ingreso,
                    res_fh_fin: r.res_fh_fin,
                    con_id: r.con_id,
                    pag_nro: r.pag_nro,
                    res_estado: r.res_estado,
                    res_monto: r.res_monto,
                    res_tiempo_gracia_min: r.res_tiempo_gracia_min,
                    res_created_at: r.res_created_at,
                    res_codigo: r.res_codigo,
                    metodo_pago: r.metodo_pago || 'transferencia',
                    payment_info: r.payment_info || null,
                    estacionamiento: {
                        est_nombre: estacionamiento?.est_nombre || 'N/A',
                        est_direc: estacionamiento?.est_direc || 'N/A',
                        est_telefono: estacionamiento?.est_telefono || '',
                        est_email: estacionamiento?.est_email || ''
                    },
                    plaza: {
                        pla_zona: plaza?.pla_zona || 'N/A',
                        catv_segmento: plaza?.catv_segmento || 'N/A'
                    },
                    vehiculo: {
                        veh_marca: vehiculo?.veh_marca || 'N/A',
                        veh_modelo: vehiculo?.veh_modelo || 'N/A',
                        veh_color: vehiculo?.veh_color || 'N/A'
                    },
                    conductor: {
                        usu_nom: usuarioData?.usu_nom || 'N/A',
                        usu_ape: usuarioData?.usu_ape || 'N/A',
                        usu_tel: usuarioData?.usu_tel || '',
                        usu_email: usuarioData?.usu_email || 'N/A'
                    }
                };
            }));

            console.log(`✅ [MIS-RESERVAS] Reservas enriquecidas (fallback): ${reservasEnriquecidas.length}`);

            const response: MisReservasResponse = {
                success: true,
                data: reservasEnriquecidas
            };

            return NextResponse.json(response);
        }

        console.log(`📊 [MIS-RESERVAS] Reservas encontradas: ${reservas?.length || 0}`);

        if (!reservas || reservas.length === 0) {
            console.log("ℹ️ [MIS-RESERVAS] Sin reservas para este conductor");
            return NextResponse.json({
                success: true,
                data: []
            });
        }

        console.log(`✅ [MIS-RESERVAS] Reservas formateadas: ${reservas.length}`);

        const response: MisReservasResponse = {
            success: true,
            data: reservas
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('❌ [MIS-RESERVAS] Error en consulta de mis reservas:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor: ' + (error instanceof Error ? error.message : 'Unknown error')
        }, { status: 500 });
    }
}
