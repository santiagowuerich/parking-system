import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 20;

    // Query recent movements from ocupacion table
    const { data: movements, error } = await supabase
      .from('ocupacion')
      .select(`
        ocu_id,
        veh_patente,
        pla_numero,
        ocu_fh_entrada,
        ocu_fh_salida,
        plazas!inner(
          pla_zona,
          est_id
        )
      `)
      .eq('plazas.est_id', estId)
      .order('ocu_fh_entrada', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching movements:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to match the expected format
    const formattedMovements = movements?.map(movement => {
      const isEntry = !movement.ocu_fh_salida;
      const timestamp = movement.ocu_fh_salida || movement.ocu_fh_entrada;

      return {
        id: movement.ocu_id,
        timestamp: new Date(timestamp).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        license_plate: movement.veh_patente,
        action: isEntry ? 'Ingreso' : 'Egreso',
        zona: movement.plazas?.pla_zona || 'N/A',
        plaza: movement.pla_numero ? `P${movement.pla_numero.toString().padStart(3, '0')}` : 'Sin asignar',
        method: movement.ocu_fh_salida ? 'Efectivo' : '-',
        total: movement.ocu_fh_salida ? '$1,200' : '-'
      };
    }) || [];

    const jsonResponse = NextResponse.json({
      success: true,
      data: formattedMovements
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