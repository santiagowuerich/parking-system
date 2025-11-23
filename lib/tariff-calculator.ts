import { createBrowserClient } from "@supabase/ssr";
import dayjs from "dayjs";

/**
 * Tipos de tarifa soportados
 */
export const TARIFF_TYPES = {
  HORA: 1,
  DIA: 2,
  MES: 3,
  SEMANA: 4
} as const;

export type TariffType = typeof TARIFF_TYPES[keyof typeof TARIFF_TYPES];

/**
 * Información de ocupación necesaria para calcular tarifa
 */
export interface OcupacionInfo {
  entry_time: string;
  plaza_number: number | null;
  ocu_duracion_tipo: 'hora' | 'dia' | 'mes' | 'semana';
  ocu_precio_acordado: number;
}

/**
 * Resultado del cálculo de tarifa
 */
export interface FeeCalculation {
  fee: number;                    // Monto final a cobrar
  calculatedFee: number;          // Monto calculado por tiempo real
  agreedPrice: number;            // Precio acordado al ingreso
  durationMs: number;             // Duración en milisegundos
  durationUnits: number;          // Unidades de tiempo cobradas (horas, días, etc)
  plantillaId: number | null;     // ID de plantilla usada
  plantillaNombre: string | null; // Nombre de plantilla usada
  tariffType: string;             // Tipo de tarifa usada
  precioBase: number;             // Precio base de la tarifa por unidad de tiempo
}

/**
 * Calcula la tarifa de estacionamiento basándose ÚNICAMENTE en la plantilla de la plaza
 *
 * REGLAS:
 * 1. La tarifa se obtiene de la plantilla asignada a la plaza
 * 2. NO hay fallback por tipo de vehículo
 * 3. Si no hay plaza, plantilla o tarifa → Error claro
 *
 * CÁLCULO:
 * - tar_precio = precio de la primera unidad de tiempo
 * - Horas/días/meses adicionales se calculan con el mismo tar_precio
 * - Fórmula: tar_precio × unidades_totales
 *
 * @param ocupacion - Información de la ocupación actual
 * @param estId - ID del estacionamiento
 * @returns Resultado del cálculo de tarifa
 * @throws Error si no se encuentra la plaza, plantilla o tarifa
 */
export async function calculateParkingFee(
  ocupacion: OcupacionInfo,
  estId: number
): Promise<FeeCalculation> {

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Validar que haya plaza asignada
  if (!ocupacion.plaza_number) {
    throw new Error('La ocupación no tiene plaza asignada. No se puede calcular tarifa.');
  }

  // 2. Obtener plantilla de la plaza
  const { data: plazaData, error: plazaError } = await supabase
    .from('plazas')
    .select(`
      plantilla_id,
      pla_numero,
      plantillas (
        plantilla_id,
        nombre_plantilla,
        catv_segmento
      )
    `)
    .eq('pla_numero', ocupacion.plaza_number)
    .eq('est_id', estId)
    .single();

  if (plazaError || !plazaData) {
    throw new Error(
      `Plaza ${ocupacion.plaza_number} no encontrada en estacionamiento ${estId}`
    );
  }

  if (!plazaData.plantilla_id) {
    throw new Error(
      `Plaza ${ocupacion.plaza_number} no tiene plantilla asignada. ` +
      `Configure una plantilla para esta plaza antes de usarla.`
    );
  }

  const plantillaId = plazaData.plantilla_id;
  const plantillaNombre = (plazaData.plantillas as any)?.nombre_plantilla || 'Sin nombre';

  // 3. Determinar tipo de tarifa según duración acordada
  let tiptar: TariffType = TARIFF_TYPES.HORA;
  let tariffTypeName = 'hora';

  switch (ocupacion.ocu_duracion_tipo) {
    case 'dia':
      tiptar = TARIFF_TYPES.DIA;
      tariffTypeName = 'día';
      break;
    case 'mes':
      tiptar = TARIFF_TYPES.MES;
      tariffTypeName = 'mes';
      break;
    case 'semana':
      tiptar = TARIFF_TYPES.SEMANA;
      tariffTypeName = 'semana';
      break;
    default:
      tiptar = TARIFF_TYPES.HORA;
      tariffTypeName = 'hora';
  }

  // 4. Obtener tarifa de la plantilla (ÚNICA FUENTE DE VERDAD)
  const { data: tarifasData, error: tarifaError } = await supabase
    .from('tarifas')
    .select('tar_precio, tar_f_desde')
    .eq('est_id', estId)
    .eq('plantilla_id', plantillaId)
    .eq('tiptar_nro', tiptar)
    .order('tar_f_desde', { ascending: false }) // Obtener la más reciente
    .limit(1);

  if (tarifaError || !tarifasData || tarifasData.length === 0) {
    throw new Error(
      `No se encontró tarifa configurada para:\n` +
      `- Plaza: ${ocupacion.plaza_number}\n` +
      `- Plantilla: "${plantillaNombre}" (ID: ${plantillaId})\n` +
      `- Tipo de tarifa: ${tariffTypeName}\n\n` +
      `Configure las tarifas en el panel de administración.`
    );
  }

  const tarifaData = tarifasData[0];
  const precioBase = parseFloat(tarifaData.tar_precio) || 0;

  if (precioBase <= 0) {
    throw new Error(
      `Tarifa configurada incorrectamente para plantilla "${plantillaNombre}": ` +
      `el precio debe ser mayor a 0`
    );
  }

  // 5. Calcular duración
  const entryTime = dayjs.tz(ocupacion.entry_time, 'America/Argentina/Buenos_Aires');
  const exitTime = dayjs().tz('America/Argentina/Buenos_Aires');
  const durationMs = exitTime.diff(entryTime);
  const durationHours = durationMs / (1000 * 60 * 60);

  // 6. Calcular tarifa según tipo de tiempo seleccionado AL INGRESO
  // REGLA: Se cobra MÍNIMO el tipo seleccionado, aunque pase menos tiempo
  let calculatedFee = 0;
  let durationUnits = 0;

  switch (tiptar) {
    case TARIFF_TYPES.HORA:
      // MÍNIMO 1 hora, luego se cobra por horas completas (redondeo hacia arriba)
      durationUnits = Math.max(1, Math.ceil(durationHours));
      calculatedFee = precioBase * durationUnits;
      break;

    case TARIFF_TYPES.DIA:
      // MÍNIMO 1 día, luego se cobra por días completos (redondeo hacia arriba)
      durationUnits = Math.max(1, Math.ceil(durationHours / 24));
      calculatedFee = precioBase * durationUnits;
      break;

    case TARIFF_TYPES.SEMANA:
      // MÍNIMO 1 semana, luego se cobra por semanas completas (redondeo hacia arriba)
      durationUnits = Math.max(1, Math.ceil(durationHours / (24 * 7)));
      calculatedFee = precioBase * durationUnits;
      break;

    case TARIFF_TYPES.MES:
      // MÍNIMO 1 mes, luego se cobra por meses completos (redondeo hacia arriba, 30 días por mes)
      durationUnits = Math.max(1, Math.ceil(durationHours / (24 * 30)));
      calculatedFee = precioBase * durationUnits;
      break;

    default:
      // Fallback a 1 unidad
      calculatedFee = precioBase;
      durationUnits = 1;
  }

  // 7. Comparar con precio acordado y usar el mayor
  const agreedPrice = ocupacion.ocu_precio_acordado || 0;
  const fee = Math.max(calculatedFee, agreedPrice);

  // 8. Log para debugging
  console.log('💰 FLUJO CON MÍNIMO - Cálculo de tarifa:', {
    entrada: entryTime.format('YYYY-MM-DD HH:mm:ss'),
    salida: exitTime.format('YYYY-MM-DD HH:mm:ss'),
    duracion_real_horas: durationHours.toFixed(2),
    plaza: ocupacion.plaza_number,
    plantilla: plantillaNombre,
    plantillaId,
    tipo_tiempo_seleccionado_al_ingreso: tariffTypeName,
    precio_por_unidad: precioBase,
    unidades_cobradas: durationUnits,
    monto_calculado: calculatedFee,
    precio_acordado: agreedPrice,
    monto_final: fee,
    logica: `MÍNIMO ${tariffTypeName} seleccionado al ingreso`,
    formula: `${precioBase} × ${durationUnits} = ${calculatedFee}`
  });

  return {
    fee,
    calculatedFee,
    agreedPrice,
    durationMs,
    durationUnits,
    plantillaId,
    plantillaNombre,
    tariffType: tariffTypeName,
    precioBase: precioBase // Agregar precio base de la tarifa
  };
}

/**
 * Formatea el tipo de tarifa para mostrar al usuario
 */
export function formatTariffType(tipo: string): string {
  const tipos: Record<string, string> = {
    'hora': 'por hora',
    'dia': 'por día',
    'semana': 'por semana',
    'mes': 'mensual'
  };
  return tipos[tipo] || tipo;
}
