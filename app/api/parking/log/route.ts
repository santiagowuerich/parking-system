import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const body = await req.json();

  const {
    license_plate,
    type,
    entry_time,
    exit_time,
    duration,
    fee,
  } = body;

  // 1. Insertar en historial
  const { error: historyError } = await supabase.from("parking_history").insert([
    {
      license_plate,
      type,
      entry_time,
      exit_time,
      duration,
      fee,
    },
  ]);

  // 2. Eliminar vehículo de parked_vehicles
    const {error: deleteError} = await supabase.from("parked_vehicles").delete().match({license_plate: license_plate});

  if (historyError || deleteError) {
    console.error("❌ Error al registrar salida:", historyError || deleteError);
    return NextResponse.json({ error: "Error al registrar salida" }, { status: 500 });
  }

  return NextResponse.json({ message: "Salida registrada" });
}