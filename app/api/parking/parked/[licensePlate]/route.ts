import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ licensePlate: string }> }
) {
  const { licensePlate } = await params;

  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || undefined

    let q = supabase
      .from("ocupacion")
      .delete()
      .eq("veh_patente", licensePlate)
      .is("ocu_fh_salida", null)
    if (estId) {
      // @ts-ignore
      q = q.eq('est_id', estId)
    }
    const { error } = await q

    if (error) {
      console.error("Error al eliminar vehículo:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ success: true });
    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error("Error inesperado al eliminar vehículo:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 