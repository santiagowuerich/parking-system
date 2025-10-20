import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const ocuId = url.searchParams.get('ocu_id');
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id'));

    if (!ocuId) {
      return NextResponse.json({ error: 'ocu_id es requerido' }, { status: 400 });
    }

    // Obtener información de la ocupación para filtrar movimientos
    const { data: ocupacion, error: ocupacionError } = await supabase
      .from('ocupacion')
      .select('veh_patente, ocu_fh_entrada, ocu_fh_salida')
      .eq('ocu_id', ocuId)
      .single();

    if (ocupacionError || !ocupacion) {
      console.error('❌ Error obteniendo ocupación:', ocupacionError);
      return NextResponse.json({ error: 'Ocupación no encontrada' }, { status: 404 });
    }

    // Obtener movimientos de vehículo durante el periodo de ocupación
    // Usar un rango más amplio para evitar problemas de zona horaria
    const entryDate = new Date(ocupacion.ocu_fh_entrada);
    const entryDateWithBuffer = new Date(entryDate.getTime() - 60000); // 1 minuto antes

    let query = supabase
      .from('vehicle_movements')
      .select(`
        mov_id,
        veh_patente,
        pla_origen,
        pla_destino,
        mov_fecha_hora,
        mov_razon,
        est_id,
        usuario:usu_id(
          usu_nom,
          usu_ape,
          usu_email
        )
      `)
      .eq('veh_patente', ocupacion.veh_patente)
      .eq('est_id', estId)
      .gte('mov_fecha_hora', entryDateWithBuffer.toISOString())
      .order('mov_fecha_hora', { ascending: false });

    // Si hay fecha de salida, filtrar hasta esa fecha (con buffer)
    if (ocupacion.ocu_fh_salida) {
      const exitDate = new Date(ocupacion.ocu_fh_salida);
      const exitDateWithBuffer = new Date(exitDate.getTime() + 60000); // 1 minuto después
      query = query.lte('mov_fecha_hora', exitDateWithBuffer.toISOString());
    }

    const { data: movements, error: movementsError } = await query;

    if (movementsError) {
      console.error('❌ Error obteniendo movimientos:', movementsError);
      return NextResponse.json({ error: movementsError.message }, { status: 500 });
    }

    // Obtener información de zonas para las plazas origen y destino
    const plazaNumbers = new Set<number>();
    movements?.forEach(m => {
      plazaNumbers.add(m.pla_origen);
      plazaNumbers.add(m.pla_destino);
    });

    const { data: plazas, error: plazasError } = await supabase
      .from('plazas')
      .select('pla_numero, pla_zona')
      .eq('est_id', estId)
      .in('pla_numero', Array.from(plazaNumbers));

    if (plazasError) {
      console.error('❌ Error obteniendo plazas:', plazasError);
    }

    // Crear mapa de plaza -> zona
    const plazaToZone = new Map<number, string>();
    plazas?.forEach(p => {
      plazaToZone.set(p.pla_numero, p.pla_zona);
    });

    // Formatear movimientos
    const formattedMovements = movements?.map(m => {
      const operadorNombre = m.usuario
        ? `${m.usuario.usu_nom || ''} ${m.usuario.usu_ape || ''}`.trim() || 'Sistema'
        : 'Sistema';

      return {
        mov_id: m.mov_id,
        fecha_hora: m.mov_fecha_hora,
        pla_origen: m.pla_origen,
        pla_destino: m.pla_destino,
        zona_origen: plazaToZone.get(m.pla_origen) || 'N/A',
        zona_destino: plazaToZone.get(m.pla_destino) || 'N/A',
        operador: operadorNombre,
        razon: m.mov_razon
      };
    }) || [];

    const jsonResponse = NextResponse.json({
      success: true,
      data: formattedMovements,
      count: formattedMovements.length
    });

    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error('❌ Error inesperado:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
