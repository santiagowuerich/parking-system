import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const body = await req.json();

  const { license_plate, type, entry_time, user_id } = body;

  if (!user_id) {
    console.error("❌ Error: user_id es requerido");
    return NextResponse.json(
      { error: "user_id es requerido" },
      { status: 400 }
    );
  }

  try {
    // Intentar insertar el vehículo
    const { error } = await supabase
      .from("parked_vehicles")
      .insert({
        license_plate,
        type,
        entry_time,
        user_id,
      });

    if (error) {
      console.error("❌ Error detallado al guardar entrada:", {
        error,
        requestData: {
          license_plate,
          type,
          entry_time,
          user_id,
        }
      });
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Error inesperado:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
