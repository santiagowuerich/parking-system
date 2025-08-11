import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || 1

    // 1. Limpiar ocupación y pagos del estacionamiento indicado
    const { error: ocuError } = await supabase
      .from("ocupacion")
      .delete()
      .eq('est_id', estId);

    if (ocuError) {
      console.error("Error limpiando ocupación:", ocuError);
    }

    const { error: pagosError } = await supabase
      .from("pagos")
      .delete()
      .eq('est_id', estId);

    if (pagosError) {
      console.error("Error limpiando pagos:", pagosError);
    }

    // 3. Limpiar tarifas del estacionamiento
    const { error: ratesError } = await supabase
      .from("tarifas")
      .delete()
      .eq('est_id', estId);

    if (ratesError) {
      console.error("Error limpiando tarifas:", ratesError);
    }

    // 4. Limpiar plazas del estacionamiento
    const { error: capacityError } = await supabase
      .from("plazas")
      .delete()
      .eq('est_id', estId);

    if (capacityError) {
      console.error("Error limpiando capacidad:", capacityError);
    }

    const jsonResponse = NextResponse.json({
      success: true,
      message: `Datos del estacionamiento ${estId} eliminados correctamente`,
    });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en la limpieza de datos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 