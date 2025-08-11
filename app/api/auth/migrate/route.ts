import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { from_est_id, to_est_id } = await request.json();
    if (!from_est_id || !to_est_id) {
      return NextResponse.json({ error: 'Se requieren from_est_id y to_est_id' }, { status: 400 })
    }

    const { supabase, response } = createClient(request);

    // Nuevo esquema: migrar datos por estacionamiento (tarifas, plazas)
    const { data: tarifas, error: eTar } = await supabase
      .from('tarifas')
      .select('*')
      .eq('est_id', from_est_id)
    if (eTar) console.error('Error leyendo tarifas origen:', eTar)

    if (tarifas?.length) {
      const rows = tarifas.map(t => ({ ...t, est_id: to_est_id, tar_f_desde: new Date().toISOString() }))
      const { error: insTar } = await supabase.from('tarifas').insert(rows)
      if (insTar) console.error('Error insertando tarifas destino:', insTar)
    }

    const { data: plazas, error: ePl } = await supabase
      .from('plazas')
      .select('*')
      .eq('est_id', from_est_id)
    if (ePl) console.error('Error leyendo plazas origen:', ePl)
    if (plazas?.length) {
      const numbers = plazas.map(p=>p.pla_numero)
      let next = (numbers.length ? Math.max(...numbers) : 0) + 1
      const rows = plazas.map(p => ({ est_id: to_est_id, pla_numero: next++, pla_estado: 'Libre', catv_segmento: p.catv_segmento, pla_zona: p.pla_zona }))
      const { error: insPl } = await supabase.from('plazas').insert(rows)
      if (insPl) console.error('Error insertando plazas destino:', insPl)
    }

    const jsonResponse = NextResponse.json({ success: true, message: 'Datos migrados por estacionamiento correctamente' });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en la migración:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 