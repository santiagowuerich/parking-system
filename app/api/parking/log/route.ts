import { NextRequest, NextResponse } from "next/server";
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  try {
    const {
      license_plate,
      type,
      entry_time,
      exit_time,
      duration,
      fee,
      user_id,
      payment_method,
    } = await request.json();

    const { supabase, response } = createClient(request);

    // Primero eliminamos el vehículo de parked_vehicles
    const { error: deleteError } = await supabase
      .from("parked_vehicles")
      .delete()
      .eq("license_plate", license_plate)
      .eq("user_id", user_id);

    if (deleteError) {
      console.error("Error al eliminar vehículo estacionado:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Luego registramos la salida en el historial
    const { data, error } = await supabase
      .from("parking_history")
      .insert([
        {
          license_plate,
          type,
          entry_time,
          exit_time,
          duration,
          fee,
          user_id,
          payment_method,
        },
      ])
      .select();

    if (error) {
      console.error("Error al registrar en el historial:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json(data);
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en la ruta POST /api/parking/log:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}