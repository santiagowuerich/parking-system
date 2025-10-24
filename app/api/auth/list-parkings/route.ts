import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar que el usuario esté autenticado (usando getUser para mayor seguridad)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        const userEmail = user.email;

        // Buscar el usuario en la tabla tradicional por email
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id, usu_nom, usu_ape, usu_email')
            .eq('usu_email', userEmail)
            .single();

        if (usuarioError || !usuarioData) {
            return NextResponse.json({
                estacionamientos: [],
                message: "Usuario no encontrado en sistema tradicional"
            });
        }

        // Verificar si el usuario es dueño o empleado
        const { data: duenoCheck, error: duenoError } = await supabase
            .from('dueno')
            .select('due_id')
            .eq('due_id', usuarioData.usu_id)
            .single();

        const isDueno = !duenoError && duenoCheck !== null;
        logger.debug(`Usuario ${userEmail} es ${isDueno ? 'DUEÑO' : 'EMPLEADO'}`);

        let estacionamientosBasicos: any[];
        let estacionamientosError: any;

        if (isDueno) {
            // DUEÑO: obtener todos sus estacionamientos
            const result = await supabase
                .from('estacionamientos')
                .select(`
                    est_id,
                    est_nombre,
                    est_prov,
                    est_locali,
                    est_direc,
                    est_capacidad,
                    est_cantidad_espacios_disponibles,
                    est_tolerancia_min,
                    est_publicado,
                    est_requiere_llave
                `)
                .eq('due_id', usuarioData.usu_id)
                .order('est_id');

            estacionamientosBasicos = result.data || [];
            estacionamientosError = result.error;
        } else {
            // EMPLEADO: obtener solo el estacionamiento asignado
            const { data: asignacionData, error: asignacionError } = await supabase
                .from('empleados_estacionamiento')
                .select(`
                    est_id,
                    fecha_asignacion,
                    activo,
                    estacionamientos (
                        est_id,
                        est_nombre,
                        est_prov,
                        est_locali,
                        est_direc,
                        est_capacidad,
                        est_cantidad_espacios_disponibles,
                        est_tolerancia_min,
                        est_publicado,
                        est_requiere_llave
                    )
                `)
                .eq('play_id', usuarioData.usu_id)
                .eq('activo', true)
                .single();

            if (asignacionError || !asignacionData) {
                logger.debug(`Empleado ${usuarioData.usu_id} no tiene asignación activa`);
                estacionamientosBasicos = [];
                estacionamientosError = asignacionError;
            } else {
                const estacionamientoAsignado = asignacionData.estacionamientos as any;
                logger.debug(`Empleado asignado al estacionamiento: ${estacionamientoAsignado?.est_id || 'desconocido'}`);
                estacionamientosBasicos = estacionamientoAsignado ? [estacionamientoAsignado] : [];
                estacionamientosError = null;
            }
        }

        if (estacionamientosError) {
            logger.error("Error obteniendo estacionamientos:", estacionamientosError);
            return NextResponse.json({ error: "Error consultando estacionamientos" }, { status: 500 });
        }

        // Calcular métricas directamente desde la tabla plazas (mismo método que /api/plazas)
        let estacionamientosData = [];
        if (estacionamientosBasicos && estacionamientosBasicos.length > 0) {
            // Usar consulta directa para todos los casos (dueños y empleados)
            estacionamientosData = await Promise.all(
                estacionamientosBasicos.map(async (est) => {
                    try {
                        const { data: plazasData, error: plazasError } = await supabase
                            .from('plazas')
                            .select('pla_estado')
                            .eq('est_id', est.est_id);

                        if (plazasError) {
                            logger.error(`Error obteniendo plazas para ${est.est_id}:`, plazasError);
                            return {
                                ...est,
                                plazas_total: 0,
                                plazas_ocupadas: 0,
                                plazas_libres: 0,
                                ingreso_hoy: 0,
                                vehiculos_activos: 0
                            };
                        }

                        const total = plazasData?.length || 0;
                        const ocupadas = plazasData?.filter(p => p.pla_estado === 'Ocupada').length || 0;
                        const libres = total - ocupadas;

                        logger.debug(`Estacionamiento ${est.est_id}: ${total} total, ${ocupadas} ocupadas, ${libres} libres`);

                        return {
                            ...est,
                            plazas_total: total,
                            plazas_ocupadas: ocupadas,
                            plazas_libres: libres,
                            ingreso_hoy: 0,
                            vehiculos_activos: ocupadas
                        };
                    } catch (error) {
                        logger.error(`Error procesando estacionamiento ${est.est_id}:`, error);
                        return {
                            ...est,
                            plazas_total: 0,
                            plazas_ocupadas: 0,
                            plazas_libres: 0,
                            ingreso_hoy: 0,
                            vehiculos_activos: 0
                        };
                    }
                })
            );
        }

        logger.debug(`Usuario ${userEmail} tiene ${estacionamientosData?.length || 0} estacionamiento(s)`);

        return NextResponse.json({
            estacionamientos: estacionamientosData || [],
            usuario: {
                usu_id: usuarioData.usu_id,
                nombre_completo: `${usuarioData.usu_nom} ${usuarioData.usu_ape}`,
                email: usuarioData.usu_email
            }
        });

    } catch (error) {
        console.error("❌ Error listando estacionamientos:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
