import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function GET(
  request: NextRequest,
  { params }: { params: { tur_id: string } }
) {
  try {
    const { supabase, response } = createClient(request);
    const turId = params.tur_id;

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
      .select('tur_fecha, tur_hora_entrada, tur_fecha_salida, tur_hora_salida, est_id')
      .eq('tur_id', turId)
      .single();

    if (turnoError || !turno) {
      logger.error("Error fetching turno:", turnoError);
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    // Calcular timestamps del turno
    const fechaTurno = turno.tur_fecha;
    const horaInicio = turno.tur_hora_entrada;
    const horaFin = turno.tur_hora_salida;
    const fechaSalida = turno.tur_fecha_salida || turno.tur_fecha;

    const timestampInicio = dayjs.tz(`${fechaTurno} ${horaInicio}`, 'America/Argentina/Buenos_Aires').toISOString();
    const timestampFin = horaFin
      ? dayjs.tz(`${fechaSalida} ${horaFin}`, 'America/Argentina/Buenos_Aires').toISOString()
      : dayjs().tz('America/Argentina/Buenos_Aires').toISOString();

    logger.info(`Buscando movimientos del turno ${turId} entre ${timestampInicio} y ${timestampFin}`);

    // 2. QUERY PRINCIPAL: Obtener TODOS los pagos del turno
    const { data: pagos, error: pagosError } = await supabase
      .from('pagos')
      .select('pag_nro, pag_monto, mepa_metodo, pag_tipo, pag_h_fh, veh_patente, abo_nro, pag_descripcion')
      .eq('est_id', turno.est_id)
      .gte('pag_h_fh', timestampInicio)
      .lte('pag_h_fh', timestampFin)
      .eq('pag_estado', 'completado')
      .order('pag_h_fh', { ascending: false });

    if (pagosError) {
      logger.error("Error fetching pagos:", pagosError);
      return NextResponse.json({ error: "Error al obtener movimientos" }, { status: 500 });
    }

    logger.info(`Pagos encontrados: ${pagos?.length || 0}`);

    // 3. Obtener IDs para queries adicionales
    const pagNrosOcupaciones = pagos?.filter((p: any) => p.pag_tipo === 'ocupacion').map((p: any) => p.pag_nro) || [];
    const pagNrosReservas = pagos?.filter((p: any) => p.pag_tipo === 'reserva').map((p: any) => p.pag_nro) || [];
    const pagNrosAbonos = pagos?.filter((p: any) => p.pag_tipo === 'abono_inicial').map((p: any) => p.pag_nro) || [];
    const aboNrosExtensiones = pagos?.filter((p: any) => p.pag_tipo === 'extension').map((p: any) => p.abo_nro) || [];

    logger.info(`Ocupaciones: ${pagNrosOcupaciones.length}, Reservas: ${pagNrosReservas.length}, Abonos: ${pagNrosAbonos.length}, Extensiones: ${aboNrosExtensiones.length}`);

    // 4. Queries en paralelo para obtener contexto adicional
    const [ocupacionesResult, reservasResult, abonosInicialesResult, abonosExtensionesResult] = await Promise.all([
      pagNrosOcupaciones.length > 0 ? supabase
        .from('ocupacion')
        .select('pag_nro, pla_numero, est_id, ocu_fh_entrada, ocu_fh_salida')
        .in('pag_nro', pagNrosOcupaciones)
      : Promise.resolve({ data: [] }),

      pagNrosReservas.length > 0 ? supabase
        .from('reservas')
        .select('pag_nro, res_fh_ingreso, pla_numero, est_id, veh_patente')
        .in('pag_nro', pagNrosReservas)
      : Promise.resolve({ data: [] }),

      pagNrosAbonos.length > 0 ? supabase
        .from('abonos')
        .select('pag_nro, abo_tipoabono, abo_fecha_inicio, abo_fecha_fin')
        .in('pag_nro', pagNrosAbonos)
      : Promise.resolve({ data: [] }),

      aboNrosExtensiones.length > 0 ? supabase
        .from('abonos')
        .select('abo_nro, abo_tipoabono, abo_fecha_fin')
        .in('abo_nro', aboNrosExtensiones)
      : Promise.resolve({ data: [] })
    ]);

    // 5. Obtener datos de plazas para poder mapear pla_zona
    // Recopilar todos los (est_id, pla_numero) únicos de ocupaciones y reservas
    const plazasParaBuscar = new Set<string>();
    ((ocupacionesResult.data as any[]) || []).forEach((o: any) => {
      if (o.est_id && o.pla_numero) {
        plazasParaBuscar.add(`${o.est_id},${o.pla_numero}`);
      }
    });
    ((reservasResult.data as any[]) || []).forEach((r: any) => {
      if (r.est_id && r.pla_numero) {
        plazasParaBuscar.add(`${r.est_id},${r.pla_numero}`);
      }
    });

    // Query a plazas para obtener pla_zona
    let plazasData: any[] = [];
    if (plazasParaBuscar.size > 0) {
      const plazasArray = Array.from(plazasParaBuscar).map((p) => {
        const [est_id, pla_numero] = p.split(',');
        return { est_id: parseInt(est_id), pla_numero: parseInt(pla_numero) };
      });

      // Query para cada plaza (necesario porque Supabase no soporta OR en filters de forma directa para claves compuestas)
      const plazasQueries = plazasArray.map((p) =>
        supabase
          .from('plazas')
          .select('est_id, pla_numero, pla_zona')
          .eq('est_id', p.est_id)
          .eq('pla_numero', p.pla_numero)
      );

      const plazasResults = await Promise.all(plazasQueries);
      plazasData = plazasResults.flatMap((r) => (r.data as any[]) || []);
    }

    // 6. Crear maps para lookup rápido
    const ocupacionesMap = new Map((ocupacionesResult.data as any[])?.map((o: any) => [o.pag_nro, o]) || []);
    const reservasMap = new Map((reservasResult.data as any[])?.map((r: any) => [r.pag_nro, r]) || []);
    const abonosInicialesMap = new Map((abonosInicialesResult.data as any[])?.map((a: any) => [a.pag_nro, a]) || []);
    const abonosExtensionesMap = new Map((abonosExtensionesResult.data as any[])?.map((a: any) => [a.abo_nro, a]) || []);
    const plazasMap = new Map(plazasData.map((p: any) => [`${p.est_id},${p.pla_numero}`, p]));

    // 6. Helper para normalizar método de pago
    const normalizarMetodoPago = (metodo: string | null | undefined): string => {
      const m = metodo?.toLowerCase() || 'efectivo';
      if (m === 'efectivo') return 'Efectivo';
      if (m === 'transferencia') return 'Transferencia';
      if (m === 'mercadopago' || m === 'qr') return 'Mercado Pago';
      if (m === 'link de pago') return 'Link de Pago';
      return 'Efectivo';
    };

    // 7. Procesar cada pago y construir movimiento
    const movimientos: any[] = [];
    const totalesPorMetodo = {
      efectivo: 0,
      transferencia: 0,
      mercadopago: 0,
      link_pago: 0
    };
    let totalGeneral = 0;

    pagos?.forEach((pago: any) => {
      const base = {
        pag_nro: pago.pag_nro,
        veh_patente: pago.veh_patente,
        fecha: pago.pag_h_fh,
        metodo_pago: normalizarMetodoPago(pago.mepa_metodo),
        monto: pago.pag_monto || 0
      };

      let movimiento: any;

      switch (pago.pag_tipo) {
        case 'ocupacion': {
          const ocu = ocupacionesMap.get(pago.pag_nro);
          let pla_zona = 'N/A';
          if (ocu?.est_id && ocu?.pla_numero) {
            const plaza = plazasMap.get(`${ocu.est_id},${ocu.pla_numero}`);
            pla_zona = plaza?.pla_zona || 'N/A';
          }
          movimiento = {
            ...base,
            tipo: 'Ocupación',
            descripcion: `Plaza ${ocu?.pla_numero || 'N/A'} - ${pla_zona}`,
            ingreso: ocu?.ocu_fh_entrada,
            egreso: ocu?.ocu_fh_salida
          };
          break;
        }

        case 'reserva': {
          const res = reservasMap.get(pago.pag_nro);
          let pla_zona = 'N/A';
          if (res?.est_id && res?.pla_numero) {
            const plaza = plazasMap.get(`${res.est_id},${res.pla_numero}`);
            pla_zona = plaza?.pla_zona || 'N/A';
          }
          movimiento = {
            ...base,
            tipo: 'Reserva',
            descripcion: `Plaza ${res?.pla_numero || 'N/A'} - ${pla_zona} (${res?.veh_patente || 'N/A'})`,
            ingreso: res?.res_fh_ingreso,
            egreso: null
          };
          break;
        }

        case 'abono_inicial': {
          const abo = abonosInicialesMap.get(pago.pag_nro);
          movimiento = {
            ...base,
            tipo: 'Abono Nuevo',
            descripcion: `${abo?.abo_tipoabono || 'Abono'} - Vigencia hasta ${dayjs(abo?.abo_fecha_fin).format('DD/MM/YYYY')}`,
            ingreso: abo?.abo_fecha_inicio,
            egreso: abo?.abo_fecha_fin
          };
          break;
        }

        case 'extension': {
          const abo = abonosExtensionesMap.get(pago.abo_nro);
          movimiento = {
            ...base,
            tipo: 'Extensión Abono',
            descripcion: pago.pag_descripcion || `${abo?.abo_tipoabono || 'Abono'} - Nueva vigencia`,
            ingreso: pago.pag_h_fh,
            egreso: null
          };
          break;
        }

        default:
          movimiento = {
            ...base,
            tipo: 'Otro',
            descripcion: pago.pag_descripcion || 'Pago no categorizado',
            ingreso: pago.pag_h_fh,
            egreso: null
          };
      }

      movimientos.push(movimiento);

      // Agregar a totales
      const monto = pago.pag_monto || 0;
      totalGeneral += monto;
      const metodo = pago.mepa_metodo?.toLowerCase() || 'efectivo';
      if (metodo === 'efectivo') {
        totalesPorMetodo.efectivo += monto;
      } else if (metodo === 'transferencia') {
        totalesPorMetodo.transferencia += monto;
      } else if (metodo === 'mercadopago' || metodo === 'qr') {
        totalesPorMetodo.mercadopago += monto;
      } else if (metodo === 'link de pago') {
        totalesPorMetodo.link_pago += monto;
      }

      logger.info(`Pago ${pago.pag_nro} (${pago.pag_tipo}): ${movimiento.tipo} - $${monto} (${base.metodo_pago})`);
    });

    const jsonResponse = NextResponse.json({
      success: true,
      movimientos,
      totales_por_metodo: totalesPorMetodo,
      total_general: totalGeneral
    });

    return copyResponseCookies(response, jsonResponse);

  } catch (err) {
    logger.error("Error en movimientos del turno:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
