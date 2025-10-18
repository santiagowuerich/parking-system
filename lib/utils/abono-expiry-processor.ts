/**
 * Utilidad para procesar vencimientos automáticos de abonos
 *
 * Maneja la lógica de:
 * 1. Marcar abono como inactivo (baja lógica)
 * 2. Liberar plaza si no hay vehículo
 * 3. Convertir ocupación de abonado a regular si hay vehículo
 */

import { SupabaseClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface AbonoVencido {
  abo_nro: number;
  est_id: number;
  pla_numero: number;
  abo_fecha_fin: string;
}

export interface OcupacionActiva {
  ocu_id: number;
  veh_patente: string;
  pla_numero: number;
  ocu_fh_entrada: string;
}

export interface ProcessResult {
  success: boolean;
  action: 'liberado' | 'convertido' | 'error';
  abono_nro: number;
  plaza_numero: number;
  vehiculo?: string;
  error?: string;
}

/**
 * Procesa un abono vencido de forma automática
 *
 * @param supabase - Cliente de Supabase
 * @param abono - Datos del abono vencido
 * @param ocupacionActiva - Ocupación activa en la plaza (si existe)
 * @returns Resultado del procesamiento
 */
export async function processExpiredSubscription(
  supabase: SupabaseClient,
  abono: AbonoVencido,
  ocupacionActiva: OcupacionActiva | null
): Promise<ProcessResult> {
  try {
    console.log(`🔄 Procesando abono vencido: ${abono.abo_nro} en plaza ${abono.pla_numero}`);

    // PASO 1: Marcar abono como inactivo (baja lógica)
    const { error: updateAbonoError } = await supabase
      .from('abonos')
      .update({ abo_estado: 'inactivo' })
      .eq('abo_nro', abono.abo_nro)
      .eq('est_id', abono.est_id);

    if (updateAbonoError) {
      console.error(`❌ Error marcando abono ${abono.abo_nro} como inactivo:`, updateAbonoError);
      return {
        success: false,
        action: 'error',
        abono_nro: abono.abo_nro,
        plaza_numero: abono.pla_numero,
        error: updateAbonoError.message
      };
    }

    console.log(`✅ Abono ${abono.abo_nro} marcado como inactivo`);

    // PASO 2: Verificar si hay vehículo estacionado
    if (!ocupacionActiva) {
      // CASO A: No hay vehículo - Liberar plaza
      const { error: liberarPlazaError } = await supabase
        .from('plazas')
        .update({ pla_estado: 'Libre' })
        .eq('pla_numero', abono.pla_numero)
        .eq('est_id', abono.est_id);

      if (liberarPlazaError) {
        console.error(`❌ Error liberando plaza ${abono.pla_numero}:`, liberarPlazaError);
        return {
          success: false,
          action: 'error',
          abono_nro: abono.abo_nro,
          plaza_numero: abono.pla_numero,
          error: liberarPlazaError.message
        };
      }

      console.log(`✅ Abono ${abono.abo_nro} vencido - Plaza ${abono.pla_numero} liberada`);

      return {
        success: true,
        action: 'liberado',
        abono_nro: abono.abo_nro,
        plaza_numero: abono.pla_numero
      };
    }

    // CASO B: Hay vehículo estacionado - Convertir a ocupación regular

    // FIX: Usar dayjs con timezone de Argentina para manejar correctamente las fechas
    // El problema: Supabase JS convierte automáticamente las fechas a UTC
    // Solución: Convertir explícitamente a timezone de Argentina y formatear como ISO

    const fechaArgentina = dayjs(abono.abo_fecha_fin).tz('America/Argentina/Buenos_Aires');
    const fechaFormateada = fechaArgentina.format('YYYY-MM-DD HH:mm:ss');

    console.log(`🔧 Fecha original del abono: ${abono.abo_fecha_fin}`);
    console.log(`🔧 Fecha en timezone Argentina: ${fechaFormateada}`);

    // Paso B.1: Cerrar ocupación anterior
    // WORKAROUND: Usar SQL directo para evitar que Supabase JS convierta la fecha a UTC
    // Como no podemos usar RPC arbitrario, vamos a sumar 3 horas para compensar la conversión
    const fechaCompensada = dayjs(abono.abo_fecha_fin).add(3, 'hour').format('YYYY-MM-DD HH:mm:ss');

    console.log(`🔧 Fecha compensada (UTC +3): ${fechaCompensada}`);

    const { error: cerrarOcupacionError } = await supabase
      .from('ocupacion')
      .update({ ocu_fh_salida: fechaCompensada })
      .eq('ocu_id', ocupacionActiva.ocu_id);

    if (cerrarOcupacionError) {
      console.error(`❌ Error cerrando ocupación ${ocupacionActiva.ocu_id}:`, cerrarOcupacionError);
      return {
        success: false,
        action: 'error',
        abono_nro: abono.abo_nro,
        plaza_numero: abono.pla_numero,
        error: cerrarOcupacionError.message
      };
    }

    console.log(`✅ Ocupación anterior ${ocupacionActiva.ocu_id} cerrada con fecha ${fechaCompensada}`);

    // Paso B.2: Crear nueva ocupación regular (por hora desde la fecha de vencimiento)
    console.log(`🔍 Creando nueva ocupación con fecha de entrada: ${fechaCompensada}`);

    const { error: nuevaOcupacionError } = await supabase
      .from('ocupacion')
      .insert({
        est_id: abono.est_id,
        veh_patente: ocupacionActiva.veh_patente,
        pla_numero: ocupacionActiva.pla_numero,
        ocu_fh_entrada: fechaCompensada,
        ocu_duracion_tipo: 'hora',
        ocu_precio_acordado: 0,
        ocu_fh_salida: null,
        tiptar_nro: null,
        pag_nro: null
      });

    if (nuevaOcupacionError) {
      console.error(`❌ Error creando nueva ocupación para ${ocupacionActiva.veh_patente}:`, nuevaOcupacionError);
      return {
        success: false,
        action: 'error',
        abono_nro: abono.abo_nro,
        plaza_numero: abono.pla_numero,
        error: nuevaOcupacionError.message
      };
    }

    console.log(`✅ Abono ${abono.abo_nro} vencido - Vehículo ${ocupacionActiva.veh_patente} convertido a ocupación regular`);

    return {
      success: true,
      action: 'convertido',
      abono_nro: abono.abo_nro,
      plaza_numero: abono.pla_numero,
      vehiculo: ocupacionActiva.veh_patente
    };

  } catch (error: any) {
    console.error(`❌ Error inesperado procesando abono ${abono.abo_nro}:`, error);
    return {
      success: false,
      action: 'error',
      abono_nro: abono.abo_nro,
      plaza_numero: abono.pla_numero,
      error: error.message || 'Error desconocido'
    };
  }
}

/**
 * Procesa múltiples abonos vencidos en lote
 *
 * @param supabase - Cliente de Supabase
 * @param abonosVencidos - Lista de abonos vencidos a procesar
 * @param ocupaciones - Mapa de ocupaciones activas por plaza
 * @returns Resultados del procesamiento por lotes
 */
export async function processExpiredSubscriptionsBatch(
  supabase: SupabaseClient,
  abonosVencidos: AbonoVencido[],
  ocupacionesPorPlaza: Map<number, OcupacionActiva>
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];

  for (const abono of abonosVencidos) {
    const ocupacionActiva = ocupacionesPorPlaza.get(abono.pla_numero) || null;
    const result = await processExpiredSubscription(supabase, abono, ocupacionActiva);
    results.push(result);

    // Pequeña pausa para evitar sobrecarga de BD
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Log resumen
  const exitosos = results.filter(r => r.success).length;
  const liberados = results.filter(r => r.action === 'liberado').length;
  const convertidos = results.filter(r => r.action === 'convertido').length;
  const errores = results.filter(r => r.action === 'error').length;

  console.log(`📊 Resumen procesamiento vencimientos: ${exitosos}/${results.length} exitosos - ${liberados} liberados, ${convertidos} convertidos, ${errores} errores`);

  return results;
}
