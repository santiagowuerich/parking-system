import { NextRequest, NextResponse } from "next/server";
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  // Ya no dependemos de userId en el nuevo esquema

  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || undefined

    // Obtener todas las ocupaciones abiertas
    let q = supabase
      .from("ocupacion")
      .select("ocu_id, veh_patente, ocu_fh_entrada")
      .is("ocu_fh_salida", null)
    if (estId) q = q.eq('est_id', estId)
    const { data: ocupaciones, error: fetchError } = await q

    if (fetchError) {
      console.error("Error al obtener vehículos:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Agrupar por matrícula y mantener solo el registro más reciente (por fecha de entrada)
    const latestByPlate = new Map<string, { ocu_id: number; veh_patente: string; ocu_fh_entrada: string }>();
    for (const o of ocupaciones || []) {
      const existing = latestByPlate.get(o.veh_patente);
      if (!existing || new Date(o.ocu_fh_entrada) > new Date(existing.ocu_fh_entrada)) {
        latestByPlate.set(o.veh_patente, o);
      }
    }

    // Eliminar ocupaciones duplicadas (mantener solo la última por patente)
    for (const ocu of ocupaciones || []) {
      const latest = latestByPlate.get(ocu.veh_patente);
      if (latest && latest.ocu_id !== ocu.ocu_id) {
        const { error: deleteError } = await supabase
          .from("ocupacion")
          .delete()
          .eq("ocu_id", ocu.ocu_id);

        if (deleteError) console.error("Error al eliminar duplicado:", deleteError);
      }
    }

    const jsonResponse = NextResponse.json({ success: true });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error al limpiar registros:", error);
    return NextResponse.json(
      { error: "Error al limpiar registros duplicados" },
      { status: 500 }
    );
  }
} 