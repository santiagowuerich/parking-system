import { NextResponse, type NextRequest } from 'next/server'
import { createClient, copyResponseCookies } from '@/lib/supabase/client'
import { nameToSegment } from '@/lib/utils'

/**
 * API Endpoint para calcular tarifas de estacionamiento
 *
 * Funcionalidad:
 * - Para HORA: calcula tarifa basada en tiempo real transcurrido (mínimo 1 hora)
 * - Para DÍA/SEMANA/MES: usa precio fijo configurado (sin cálculos adicionales)
 * - Usa las tarifas existentes de la base de datos por tipo de vehículo y plaza
 *
 * Parámetros del body:
 * - vehicleType: 'Auto', 'Moto', 'Camioneta'
 * - entry_time: fecha/hora de entrada (ISO string)
 * - exit_time: fecha/hora de salida (ISO string)
 * - tarifa_tipo: 'hora', 'dia', 'semana', 'mes' (opcional, por defecto 'hora')
 * - pla_tipo: 'Normal', 'VIP', 'Reservada' (opcional, por defecto 'Normal')
 *
 * Respuesta:
 * - fee: tarifa final a cobrar
 * - hours: horas reales transcurridas (solo informativo)
 * - rate: precio base configurado para el tipo de tarifa
 * - tarifa_tipo: tipo de tarifa utilizada
 *
 * Lógica de cálculo:
 * - HORA: precio_base + (tarifa_por_hora * (horas - 1)) si horas > 1
 * - DÍA/SEMANA/MES: precio_base (fijo, sin cálculos)
 *
 * Ejemplos de uso:
 * POST /api/pricing/calculate?est_id=1
 *
 * 1. Para calcular por hora (con cálculo):
 * {
 *   "vehicleType": "Auto",
 *   "entry_time": "2024-01-15T10:00:00Z",
 *   "exit_time": "2024-01-15T14:00:00Z",
 *   "tarifa_tipo": "hora"
 * }
 *
 * 2. Para precio fijo diario:
 * {
 *   "vehicleType": "Auto",
 *   "entry_time": "2024-01-15T10:00:00Z",
 *   "exit_time": "2024-01-15T12:00:00Z",
 *   "tarifa_tipo": "dia"
 * }
 */

export async function POST(request: NextRequest) {
  const { supabase, response } = createClient(request)

  try {
    const body = await request.json()
    const vehicleType = String(body?.vehicleType || '')
    const entryTimeStr = String(body?.entry_time || '')
    const exitTimeStr = String(body?.exit_time || '')
    const tarifaTipo = String(body?.tarifa_tipo || 'hora') // Tipo de tarifa a usar
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1
    // La columna pla_tipo ya no existe, usar valor por defecto
    const plaRaw = 'Normal'
    const allowedPla = ['Normal', 'VIP', 'Reservada']
    const pla = allowedPla.includes(plaRaw) ? plaRaw : 'Normal'

    if (!vehicleType || !entryTimeStr || !exitTimeStr) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const entry = new Date(entryTimeStr)
    const exit = new Date(exitTimeStr)
    const ms = Math.max(0, exit.getTime() - entry.getTime())
    const minutes = ms / (1000 * 60)
    const hours = Math.max(1, Math.ceil(minutes / 60))

    const seg = nameToSegment(vehicleType)

    // Determinar el tipo de tarifa basado en el parámetro tarifa_tipo
    let tiptar = 1; // Por defecto hora
    if (tarifaTipo.toLowerCase() === 'dia') {
      tiptar = 2; // Diaria
    } else if (tarifaTipo.toLowerCase() === 'mes') {
      tiptar = 3; // Mensual
    } else if (tarifaTipo.toLowerCase() === 'semana') {
      tiptar = 4; // Semanal
    }

    // Obtener la tarifa correspondiente
    let data = null;
    let error = null;

    // Si se proporciona número de plaza, intentar obtener tarifa por plantilla
    if (body.pla_numero) {
      // Primero obtener información de la plaza
      const { data: plazaData, error: plazaError } = await supabase
        .from('plazas')
        .select('plantilla_id, catv_segmento')
        .eq('pla_numero', body.pla_numero)
        .eq('est_id', estId)
        .single();

      if (!plazaError && plazaData?.plantilla_id) {
        // Buscar tarifa por plantilla_id
        const result = await supabase
          .from('tarifas')
          .select('tar_precio, tar_fraccion')
          .eq('est_id', estId)
          .eq('tiptar_nro', tiptar)
          // La columna pla_tipo ya no existe
          .eq('plantilla_id', plazaData.plantilla_id)
          .order('tar_f_desde', { ascending: false })
          .limit(1);

        data = result.data;
        error = result.error;
      }
    }

    // Si no se encontró tarifa por plantilla, usar fallback por catv_segmento
    if (!data || data.length === 0) {
      const result = await supabase
        .from('tarifas')
        .select('tar_precio, tar_fraccion')
        .eq('est_id', estId)
        .eq('tiptar_nro', tiptar)
        // La columna pla_tipo ya no existe
        .eq('catv_segmento', seg)
        .order('tar_f_desde', { ascending: false })
        .limit(1);

      data = result.data;
      error = result.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const basePrice = Number(data?.[0]?.tar_precio || 0)
    const hourlyRate = Number(data?.[0]?.tar_fraccion || 0)

    // Calcular tarifa según el tipo seleccionado
    let fee = 0;
    if (basePrice > 0) {
      // Para tarifa por hora: calcular basado en tiempo transcurrido
      if (tiptar === 1) { // Hora
        if (hours <= 1) {
          fee = basePrice; // Mínimo 1 hora
        } else {
          fee = basePrice + (hourlyRate * (hours - 1));
        }
      } else {
        // Para día, semana, mes: usar precio fijo sin cálculos adicionales
        fee = basePrice;
      }
    }

    const json = NextResponse.json({
      fee,
      hours,
      rate: basePrice,
      tarifa_tipo: tarifaTipo
    })
    return copyResponseCookies(response, json)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}



