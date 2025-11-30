import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const url = new URL(request.url);
        const turId = url.searchParams.get('tur_id');

        if (!turId) {
            return NextResponse.json({ error: "tur_id es requerido" }, { status: 400 });
        }

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // 1. Obtener información del turno
        const { data: turno, error: turnoError } = await supabase
            .from('turnos_empleados')
            .select(`
                tur_id,
                tur_fecha,
                tur_fecha_salida,
                tur_hora_entrada,
                tur_hora_salida,
                tur_estado,
                caja_inicio,
                caja_final,
                play_id,
                est_id
            `)
            .eq('tur_id', turId)
            .single();

        if (turnoError || !turno) {
            logger.error("Error fetching turno:", turnoError);
            return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
        }

        // Obtener información del empleado (play_id referencia directamente a usuario.usu_id)
        const { data: empleado, error: empleadoError } = await supabase
            .from('usuario')
            .select('usu_nom, usu_ape')
            .eq('usu_id', turno.play_id)
            .single();

        if (empleadoError) {
            logger.error("Error fetching empleado:", empleadoError);
        }

        // 2. Contar movimientos durante el turno
        // Construir timestamp de inicio y fin del turno usando dayjs con timezone de Argentina
        const fechaTurno = turno.tur_fecha;
        const horaInicio = turno.tur_hora_entrada;
        const horaFin = turno.tur_hora_salida;
        const fechaSalida = turno.tur_fecha_salida || turno.tur_fecha;

        // Crear timestamps en formato ISO completo con timezone
        const timestampInicio = dayjs.tz(`${fechaTurno} ${horaInicio}`, 'America/Argentina/Buenos_Aires').toISOString();
        const timestampFin = horaFin
            ? dayjs.tz(`${fechaSalida} ${horaFin}`, 'America/Argentina/Buenos_Aires').toISOString()
            : dayjs().tz('America/Argentina/Buenos_Aires').toISOString();

        logger.info(`Buscando movimientos entre ${timestampInicio} y ${timestampFin}`);

        // Contar ingresos (vehículos que entraron durante el turno)
        const { count: totalIngresos, error: ingresosError } = await supabase
            .from('ocupacion')
            .select('*', { count: 'exact', head: true })
            .eq('est_id', turno.est_id)
            .gte('ocu_fh_entrada', timestampInicio)
            .lte('ocu_fh_entrada', timestampFin);

        if (ingresosError) {
            logger.error("Error counting ingresos:", ingresosError);
        } else {
            logger.info(`Total ingresos encontrados: ${totalIngresos}`);
        }

        // Contar egresos (vehículos que salieron durante el turno)
        const { count: totalEgresos, error: egresosError } = await supabase
            .from('ocupacion')
            .select('*', { count: 'exact', head: true })
            .eq('est_id', turno.est_id)
            .gte('ocu_fh_salida', timestampInicio)
            .lte('ocu_fh_salida', timestampFin)
            .not('ocu_fh_salida', 'is', null);

        if (egresosError) {
            logger.error("Error counting egresos:", egresosError);
        } else {
            logger.info(`Total egresos encontrados: ${totalEgresos}`);
        }

        // Contar vehículos actualmente en el estacionamiento
        const { count: vehiculosActivos, error: activosError } = await supabase
            .from('ocupacion')
            .select('*', { count: 'exact', head: true })
            .eq('est_id', turno.est_id)
            .is('ocu_fh_salida', null);

        if (activosError) {
            logger.error("Error counting vehiculos activos:", activosError);
        }

        // 3. Obtener todos los egresos del turno
        const { data: egresos, error: egresosDataError } = await supabase
            .from('ocupacion')
            .select('ocu_id, veh_patente, ocu_fh_entrada, ocu_fh_salida, ocu_precio_acordado, ocu_duracion_tipo, pag_nro')
            .eq('est_id', turno.est_id)
            .gte('ocu_fh_salida', timestampInicio)
            .lte('ocu_fh_salida', timestampFin)
            .not('ocu_fh_salida', 'is', null);

        if (egresosDataError) {
            logger.error("Error fetching egresos:", egresosDataError);
        } else {
            logger.info(`Egresos encontrados: ${egresos?.length || 0}`);
        }

        // 4. Obtener todos los pagos que corresponden a estos egresos
        const pagNros = egresos?.filter(e => e.pag_nro).map(e => e.pag_nro) || [];
        let pagosMap: Record<number, any> = {};

        if (pagNros.length > 0) {
            const { data: pagos, error: pagosError } = await supabase
                .from('pagos')
                .select('pag_nro, pag_monto, mepa_metodo')
                .in('pag_nro', pagNros);

            if (pagosError) {
                logger.error("Error fetching pagos:", pagosError);
            } else {
                logger.info(`Pagos encontrados: ${pagos?.length || 0}`);
                // Crear un mapa de pag_nro -> pago para fácil acceso
                pagos?.forEach(pago => {
                    pagosMap[pago.pag_nro] = pago;
                });
            }
        }

        // 4. Procesar cobros por método de pago
        const cobrosPorMetodo = {
            efectivo: { monto: 0, cantidad: 0 },
            transferencia: { monto: 0, cantidad: 0 },
            mercadopago: { monto: 0, cantidad: 0 },
            link_pago: { monto: 0, cantidad: 0 }
        };

        let totalCobrado = 0;
        let abonosCount = 0;

        egresos?.forEach((egreso: any) => {
            const esAbono = egreso.ocu_duracion_tipo?.toLowerCase() === 'abono';

            if (esAbono) {
                abonosCount++;
            } else {
                // Buscar el pago en el mapa usando pag_nro
                const pago = egreso.pag_nro ? pagosMap[egreso.pag_nro] : null;

                if (pago && pago.pag_monto) {
                    const monto = pago.pag_monto || 0;
                    const metodo = pago.mepa_metodo?.toLowerCase() || 'efectivo';

                    totalCobrado += monto;

                    logger.info(`Procesando pago #${egreso.pag_nro}: $${monto} en ${metodo}`);

                    if (metodo === 'efectivo') {
                        cobrosPorMetodo.efectivo.monto += monto;
                        cobrosPorMetodo.efectivo.cantidad++;
                    } else if (metodo === 'transferencia') {
                        cobrosPorMetodo.transferencia.monto += monto;
                        cobrosPorMetodo.transferencia.cantidad++;
                    } else if (metodo === 'mercadopago' || metodo === 'qr') {
                        cobrosPorMetodo.mercadopago.monto += monto;
                        cobrosPorMetodo.mercadopago.cantidad++;
                    } else if (metodo === 'link de pago') {
                        cobrosPorMetodo.link_pago.monto += monto;
                        cobrosPorMetodo.link_pago.cantidad++;
                    } else {
                        logger.warn(`Método de pago no reconocido: ${metodo} (original: ${pago.mepa_metodo})`);
                    }
                } else if (egreso.pag_nro) {
                    logger.warn(`Egreso ${egreso.ocu_id} tiene pag_nro ${egreso.pag_nro} pero no se encontró el pago en la BD`);
                } else {
                    logger.warn(`Egreso ${egreso.ocu_id} sin pag_nro - posible egreso sin pago registrado`);
                }
            }

        });

        // Calcular caja esperada
        const cajaEsperada = (turno.caja_inicio || 0) + cobrosPorMetodo.efectivo.monto;

        // 5. Construir respuesta
        const empleadoNombre = empleado
            ? `${empleado.usu_nom || ''} ${empleado.usu_ape || ''}`.trim()
            : 'No disponible';

        const jsonResponse = NextResponse.json({
            success: true,
            data: {
                turno: {
                    tur_id: turno.tur_id,
                    tur_fecha: turno.tur_fecha,
                    tur_fecha_salida: turno.tur_fecha_salida,
                    tur_hora_entrada: turno.tur_hora_entrada,
                    tur_hora_salida: turno.tur_hora_salida,
                    caja_inicio: turno.caja_inicio || 0,
                    caja_final: turno.caja_final || 0,
                    empleado_nombre: empleadoNombre || 'No disponible'
                },
                estadisticas: {
                    total_ingresos: totalIngresos || 0,
                    total_egresos: totalEgresos || 0,
                    vehiculos_activos: vehiculosActivos || 0,
                    cobros_por_metodo: cobrosPorMetodo,
                    total_cobrado: totalCobrado,
                    abonos_count: abonosCount,
                    caja_esperada: cajaEsperada
                }
            }
        });

        return copyResponseCookies(response, jsonResponse);

    } catch (err) {
        logger.error("Error en resumen de turno:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
