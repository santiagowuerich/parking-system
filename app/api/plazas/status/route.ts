// app/api/plazas/status/route.ts - Sistema híbrido: simple vs zonas

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

    // 1. Obtener todas las plazas con su información de zona original (pla_zona)
    const { data: plazas, error: ePlazas } = await supabase
      .from('plazas')
      .select('pla_numero, catv_segmento, pla_zona')
      .eq('est_id', estId);

    // 2. Obtener todas las ocupaciones activas que tienen una plaza asignada
    const { data: ocup, error: eOcup } = await supabase
      .from('ocupacion')
      .select('pla_numero, veh_patente')
      .eq('est_id', estId)
      .is('ocu_fh_salida', null)
      .not('pla_numero', 'is', null);

    // 3. Obtener información detallada de vehículos ocupados
    const { data: vehiculosOcupados, error: eVehiculos } = await supabase
      .from('vw_ocupacion_actual')
      .select('license_plate, type, entry_time, plaza_number')
      .eq('est_id', estId);

    if (ePlazas || eOcup || eVehiculos) {
      const err = ePlazas || eOcup || eVehiculos;
      console.error("Error en consulta a la base de datos:", err);
      return NextResponse.json({ error: err!.message }, { status: 500 });
    }

    const occupiedSet = new Set<number>((ocup || []).map(o => o.pla_numero as number));

    // 4. Detectar si hay zonas configuradas
    const hasZones = (plazas || []).some(p => p.pla_zona !== null && p.pla_zona !== '');

    if (!hasZones) {
      // MODO SIMPLE: Sin zonas configuradas
      const totalPlazas = plazas?.length || 0;
      const ocupadas = occupiedSet.size;
      const libres = totalPlazas - ocupadas;

      // Crear lista de todas las plazas con estado
      const todasLasPlazas = (plazas || []).map(p => ({
        numero: p.pla_numero,
        ocupado: occupiedSet.has(p.pla_numero as number),
        tipo: p.catv_segmento
      })).sort((a, b) => a.numero - b.numero);

      const json = NextResponse.json({
        mode: 'simple',
        est_id: estId,
        stats: { total: totalPlazas, ocupadas, libres },
        plazas: todasLasPlazas,
        vehiculos: vehiculosOcupados || []
      });

      response.cookies.getAll().forEach(c => {
        const { name, value, ...opt } = c;
        json.cookies.set({ name, value, ...opt })
      });
      return json;
    }

    // MODO ZONAS: Zonas configuradas
    const zonesData: { [key: string]: any } = {};

    for (const p of plazas || []) {
      const zonaNombre = p.pla_zona || 'Sin Zona';
      const seg = (p.catv_segmento as 'AUT' | 'MOT' | 'CAM') || 'AUT';

      // Inicializar la estructura para la zona si es la primera vez que la vemos
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

      // Actualizar estadísticas globales y por tipo de vehículo
      zonesData[zonaNombre].stats.total++;
      zonesData[zonaNombre].tiposVehiculo[seg].stats.total++;
      if (esOcupado) {
        zonesData[zonaNombre].stats.ocupados++;
        zonesData[zonaNombre].tiposVehiculo[seg].stats.ocupados++;
      }

      // Añadir la plaza a la lista correspondiente
      zonesData[zonaNombre].tiposVehiculo[seg].plazas.push({
        numero: p.pla_numero,
        ocupado: esOcupado
      });
    }

    // Calcular los espacios libres y ordenar las plazas numéricamente
    Object.values(zonesData).forEach(zona => {
      zona.stats.libres = zona.stats.total - zona.stats.ocupados;
      (['AUT', 'MOT', 'CAM'] as const).forEach(seg => {
        const tipo = zona.tiposVehiculo[seg];
        tipo.stats.libres = tipo.stats.total - tipo.stats.ocupados;
        tipo.plazas.sort((a: any, b: any) => a.numero - b.numero);
      });
    });

    const finalData = Object.values(zonesData);

    const json = NextResponse.json({
      mode: 'zones',
      est_id: estId,
      zonas: finalData
    });
    response.cookies.getAll().forEach(c => {
      const { name, value, ...opt } = c;
      json.cookies.set({ name, value, ...opt })
    });
    return json;

  } catch (err: any) {
    console.error("Error inesperado en la API de estado de plazas:", err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}