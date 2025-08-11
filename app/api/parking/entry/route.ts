import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { license_plate, type, entry_time, pla_numero } = body;

    if (!license_plate || !type || !entry_time) {
      console.error("❌ Error: Faltan campos requeridos", { body });
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    const { supabase, response } = createClient(request);
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1

    const mapTypeToSegment = (t: string): string => {
      if (t.toLowerCase().startsWith("auto")) return "AUT";
      if (t.toLowerCase().startsWith("moto")) return "MOT";
      return "CAM";
    };

    // Asegurar vehículo en `vehiculos`
    let vehInsertError: any = null;
    try {
      await supabase
        .from("vehiculos")
        .insert({
          veh_patente: license_plate.trim(),
          con_id: null,
          catv_segmento: mapTypeToSegment(type),
        })
        .select()
        .single();
    } catch (e: any) {
      vehInsertError = e;
    }

    if (vehInsertError && vehInsertError.code !== "23505") {
      console.error("❌ Error al asegurar vehiculo:", vehInsertError);
      return NextResponse.json({ error: "Error al registrar vehículo" }, { status: 500 });
    }

    // Buscar una plaza libre por segmento en el estacionamiento:
    const seg = mapTypeToSegment(type)
    const { data: freePlaza, error: plazaErr } = await supabase
      .from('plazas')
      .select('pla_numero')
      .eq('est_id', estId)
      .eq('catv_segmento', seg)
      .order('pla_numero', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (plazaErr) {
      console.error('❌ Error buscando plaza:', plazaErr)
    }

    const plazaNumero = Number(pla_numero) || freePlaza?.pla_numero || 1

    // Registrar entrada en `ocupacion`
    const { data, error } = await supabase
      .from("ocupacion")
      .insert({
        est_id: estId,
        pla_numero: plazaNumero,
        veh_patente: license_plate.trim(),
        ocu_fh_entrada: entry_time,
        ocu_fh_salida: null,
        tiptar_nro: null,
        pag_nro: null,
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Error detallado al guardar entrada:", { error, requestData: { license_plate, type, entry_time } });
      // Clave duplicada: ya existe una ocupación activa
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe una ocupación activa para esta matrícula" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ success: true, data });
    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error("❌ Error inesperado:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
