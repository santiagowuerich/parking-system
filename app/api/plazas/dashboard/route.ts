// app/api/plazas/dashboard/route.ts
// API CONSOLIDADA para el operador-simple: combina status, plazas completas y vehículos básicos

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { processExpiredSubscriptionsBatch } from '@/lib/utils/abono-expiry-processor'

export async function GET(request: NextRequest) {
  let response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) { response.cookies.set({ name, value, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', ...options }) },
        remove(name) { response.cookies.set({ name, value: '', path: '/', expires: new Date(0) }) }
      }
    }
  )

  try {
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1

    console.log(`🚀 [Dashboard API] Consultando datos consolidados para est_id=${estId}`)

    // 1. Obtener todas las plazas con información de plantillas (reemplaza /api/plazas)
    const { data: plazasCompletas, error: plazasError } = await supabase
      .from('plazas')
      .select(`
        *,
        plantillas (
          plantilla_id,
          nombre_plantilla,
          catv_segmento
        )
      `)
      .eq('est_id', estId)
      .order('pla_numero');

    if (plazasError) {
      console.error('❌ Error obteniendo plazas completas:', plazasError);
      return NextResponse.json({ error: `Error obteniendo plazas: ${plazasError.message}` }, { status: 500 });
    }

    const plazasBase = plazasCompletas || [];

    // 1.1 Obtener abonos activos para mapear titulares de plazas abonadas
    const { data: abonosData, error: abonosError } = await supabase
      .from('abonos')
      .select(`
        abo_nro,
        est_id,
        pla_numero,
        abo_fecha_inicio,
        abo_fecha_fin,
        abo_tipoabono,
        abo_estado,
        abonado (
          abon_id,
          abon_nombre,
          abon_apellido,
          abon_dni
        )
      `)
      .eq('est_id', estId)
      .eq('abo_estado', 'activo')
      .not('pla_numero', 'is', null)
      .order('abo_fecha_fin', { ascending: false });

    if (abonosError) {
      console.error('Error obteniendo abonos asociados a plazas:', abonosError);
    }

    // 1.2 Vehículos permitidos por abono
    const { data: abonoVehiculosData, error: abonoVehiculosError } = await supabase
      .from('vehiculos_abonados')
      .select(`
        abo_nro,
        est_id,
        veh_patente,
        vehiculos (
          catv_segmento,
          veh_marca,
          veh_modelo,
          veh_color
        )
      `)
      .eq('est_id', estId);

    if (abonoVehiculosError) {
      console.error('Error obteniendo vehículos de abonos:', abonoVehiculosError);
    }

    const vehiculosPorAbono = new Map<number, any[]>();
    (abonoVehiculosData || []).forEach((row) => {
      if (!vehiculosPorAbono.has(row.abo_nro)) {
        vehiculosPorAbono.set(row.abo_nro, []);
      }
      vehiculosPorAbono.get(row.abo_nro)?.push(row);
    });

    const now = new Date();
    const abonosPorPlaza = new Map<number, any>();

    (abonosData || []).forEach((abono) => {
      if (abono.pla_numero == null) return;
      const plazaNumero = Number(abono.pla_numero);
      if (Number.isNaN(plazaNumero)) return;

      const inicio = abono.abo_fecha_inicio ? new Date(abono.abo_fecha_inicio) : null;
      const fin = abono.abo_fecha_fin ? new Date(abono.abo_fecha_fin) : null;
      const vigente = (!inicio || inicio <= now) && (!fin || fin >= now);
      if (!vigente) return;

      const existente = abonosPorPlaza.get(plazaNumero);
      if (!existente) {
        abonosPorPlaza.set(plazaNumero, abono);
        return;
      }

      const existenteFin = existente.abo_fecha_fin ? new Date(existente.abo_fecha_fin) : null;
      if (!existenteFin || (fin && existenteFin < fin)) {
        abonosPorPlaza.set(plazaNumero, abono);
      }
    });

    // ========== PROCESAMIENTO DE ABONOS VENCIDOS ==========
    // Detectar abonos activos que ya vencieron (solo los activos, porque ya filtramos por abo_estado='activo')
    const abonosVencidos = (abonosData || []).filter((abono) => {
      const fin = abono.abo_fecha_fin ? new Date(abono.abo_fecha_fin) : null;
      return fin && fin < now;
    });

    if (abonosVencidos.length > 0) {
      console.log(`⚠️ [Vencimientos] Detectados ${abonosVencidos.length} abonos vencidos que requieren procesamiento`);

      // Obtener todas las ocupaciones activas del estacionamiento
      const { data: ocupacionesActivas } = await supabase
        .from('ocupacion')
        .select('ocu_id, veh_patente, pla_numero, ocu_fh_entrada')
        .eq('est_id', estId)
        .is('ocu_fh_salida', null);

      // Crear mapa de ocupaciones por plaza para búsqueda eficiente
      const ocupacionesPorPlaza = new Map();
      (ocupacionesActivas || []).forEach((ocu) => {
        if (ocu.pla_numero) {
          ocupacionesPorPlaza.set(ocu.pla_numero, ocu);
        }
      });

      // DEBUG: Ver qué datos tienen los abonos vencidos
      console.log(`🔍 DEBUG - Abonos vencidos antes de mapear:`);
      abonosVencidos.forEach(a => {
        console.log(`  Abono ${a.abo_nro}:`, {
          abo_fecha_inicio: a.abo_fecha_inicio,
          abo_fecha_fin: a.abo_fecha_fin,
          pla_numero: a.pla_numero
        });
      });

      // Procesar vencimientos en lote
      const resultados = await processExpiredSubscriptionsBatch(
        supabase,
        abonosVencidos.map((abono) => ({
          abo_nro: abono.abo_nro,
          est_id: abono.est_id,
          pla_numero: abono.pla_numero,
          abo_fecha_fin: abono.abo_fecha_fin
        })),
        ocupacionesPorPlaza
      );

      const exitosos = resultados.filter(r => r.success).length;
      console.log(`✅ [Vencimientos] Procesados ${exitosos}/${resultados.length} abonos vencidos`);
    }
    // ========== FIN PROCESAMIENTO VENCIMIENTOS ==========

    const plazasEnriquecidas = plazasBase.map((plaza) => {
      const plazaNumero = plaza.pla_numero == null ? null : Number(plaza.pla_numero);
      if (plazaNumero == null || Number.isNaN(plazaNumero)) {
        return {
          ...plaza,
          abono: null,
        };
      }

      const abonoAsociado = abonosPorPlaza.get(plazaNumero);
      if (!abonoAsociado) {
        return {
          ...plaza,
          abono: null,
        };
      }

      const vehiculosAbono = (vehiculosPorAbono.get(abonoAsociado.abo_nro) || []).map((vehiculo) => ({
        veh_patente: vehiculo.veh_patente,
        catv_segmento: vehiculo.vehiculos?.catv_segmento ?? null,
        veh_marca: vehiculo.vehiculos?.veh_marca ?? null,
        veh_modelo: vehiculo.vehiculos?.veh_modelo ?? null,
        veh_color: vehiculo.vehiculos?.veh_color ?? null,
      }));

      const abonoDetallado = {
        ...abonoAsociado,
        vehiculos: vehiculosAbono,
      };

      const plazaConAbono = {
        ...plaza,
        abono: abonoDetallado,
      };

      if (plazaConAbono.pla_estado === 'Libre' || plazaConAbono.pla_estado === 'Abonado') {
        plazaConAbono.pla_estado = 'Abonado';
      }

      return plazaConAbono;
    });

    // 2. Obtener ocupaciones activas que tienen plaza asignada (para status)
    const { data: ocupaciones, error: ocupError } = await supabase
      .from('ocupacion')
      .select('pla_numero, veh_patente')
      .eq('est_id', estId)
      .is('ocu_fh_salida', null)
      .not('pla_numero', 'is', null);

    if (ocupError) {
      console.error('❌ Error obteniendo ocupaciones:', ocupError);
      return NextResponse.json({ error: `Error obteniendo ocupaciones: ${ocupError.message}` }, { status: 500 });
    }

    // 3. Obtener vehículos estacionados con detalles (básico para operador)
    const { data: vehiculosEstacionados, error: vehiculosError } = await supabase
      .from('vw_ocupacion_actual')
      .select('license_plate, type, entry_time, plaza_number')
      .eq('est_id', estId);

    if (vehiculosError) {
      console.error('❌ Error obteniendo vehículos estacionados:', vehiculosError);
      return NextResponse.json({ error: `Error obteniendo vehículos: ${vehiculosError.message}` }, { status: 500 });
    }

    const occupiedSet = new Set<number>((ocupaciones || []).map(o => o.pla_numero as number));

    // 4. Detectar si hay zonas configuradas (lógica del /api/plazas/status)
    const hasZones = plazasEnriquecidas.some(p => p.pla_zona !== null && p.pla_zona !== '');

    let statusData: any;

    if (!hasZones) {
      // MODO SIMPLE: Sin zonas
      const totalPlazas = plazasEnriquecidas.length;
      const ocupadas = occupiedSet.size;
      const libres = totalPlazas - ocupadas;

      const todasLasPlazas = plazasEnriquecidas.map(p => ({
        numero: p.pla_numero,
        ocupado: occupiedSet.has(p.pla_numero as number),
        tipo: p.catv_segmento,
        estado: p.pla_estado,
        abono: p.abono || null,
      })).sort((a, b) => a.numero - b.numero);

      statusData = {
        mode: 'simple',
        est_id: estId,
        stats: { total: totalPlazas, ocupadas, libres },
        plazas: todasLasPlazas,
        vehiculos: vehiculosEstacionados || []
      };
    } else {
      // MODO ZONAS: Zonas configuradas
      const zonesData: { [key: string]: any } = {};

      for (const p of plazasEnriquecidas) {
        const zonaNombre = p.pla_zona || 'Sin Zona';
        const seg = (p.catv_segmento as 'AUT' | 'MOT' | 'CAM') || 'AUT';

        if (!zonesData[zonaNombre]) {
          zonesData[zonaNombre] = {
            nombre: zonaNombre,
            stats: { total: 0, ocupados: 0, libres: 0 },
            tiposVehiculo: {
              AUT: { nombre: 'Autos', stats: { total: 0, ocupados: 0, libres: 0 }, plazas: [] },
              MOT: { nombre: 'Motos', stats: { total: 0, ocupados: 0, libres: 0 }, plazas: [] },
              CAM: { nombre: 'Camionetas', stats: { total: 0, ocupados: 0, libres: 0 }, plazas: [] },
            }
          };
        }

        const esOcupado = occupiedSet.has(p.pla_numero as number);

        zonesData[zonaNombre].stats.total++;
        zonesData[zonaNombre].tiposVehiculo[seg].stats.total++;
        if (esOcupado) {
          zonesData[zonaNombre].stats.ocupados++;
          zonesData[zonaNombre].tiposVehiculo[seg].stats.ocupados++;
        }

        zonesData[zonaNombre].tiposVehiculo[seg].plazas.push({
          numero: p.pla_numero,
          ocupado: esOcupado
        });
      }

      // Calcular espacios libres y ordenar
      Object.values(zonesData).forEach(zona => {
        zona.stats.libres = zona.stats.total - zona.stats.ocupados;
        (['AUT', 'MOT', 'CAM'] as const).forEach(seg => {
          const tipo = zona.tiposVehiculo[seg];
          tipo.stats.libres = tipo.stats.total - tipo.stats.ocupados;
          tipo.plazas.sort((a: any, b: any) => a.numero - b.numero);
        });
      });

      statusData = {
        mode: 'zones',
        est_id: estId,
        zonas: Object.values(zonesData)
      };
    }

    // 5. Calcular estadísticas para plazas completas
    const estadisticas = {
      total_plazas: plazasEnriquecidas.length,
      plazas_libres: plazasEnriquecidas.filter(p => p.pla_estado === 'Libre').length || 0,
      plazas_ocupadas: plazasEnriquecidas.filter(p => p.pla_estado === 'Ocupada').length || 0,
      plazas_reservadas: plazasEnriquecidas.filter(p => p.pla_estado === 'Reservada').length || 0,
      plazas_mantenimiento: plazasEnriquecidas.filter(p => p.pla_estado === 'Mantenimiento').length || 0,
      ocupacion_porcentaje: plazasEnriquecidas.length > 0
        ? ((plazasEnriquecidas.filter(p => p.pla_estado === 'Ocupada').length / plazasEnriquecidas.length) * 100)
        : 0
    };

    console.log(`✅ [Dashboard API] Datos consolidados obtenidos: ${estadisticas.total_plazas} plazas, ${vehiculosEstacionados?.length || 0} vehículos`);

    const json = NextResponse.json({
      success: true,
      // Datos para operador (reemplaza /api/plazas/status)
      status: statusData,
      // Datos completos (reemplaza /api/plazas)
      plazasCompletas: plazasEnriquecidas,
      estadisticas,
      // Vehículos básicos (reduce necesidad de /api/parking/parked)
      vehiculosEstacionados: vehiculosEstacionados || [],
      // Metadatos
      timestamp: new Date().toISOString(),
      cached: false
    });

    response.cookies.getAll().forEach(c => {
      const { name, value, ...opt } = c;
      json.cookies.set({ name, value, ...opt })
    });

    return json;

  } catch (err: any) {
    console.error("❌ [Dashboard API] Error inesperado:", err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
