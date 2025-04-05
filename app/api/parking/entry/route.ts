import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();

    const { license_plate, type, entry_time, user_id } = body;

    // Validar que todos los campos requeridos estén presentes
    if (!license_plate || !type || !entry_time || !user_id) {
      console.error("❌ Error: Faltan campos requeridos", { body });
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Intentar insertar el vehículo
    const { data, error } = await supabase
      .from("parked_vehicles")
      .insert({
        license_plate,
        type,
        entry_time,
        user_id,
      })
      .select()
      .single();

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

      // Si es un error de violación única, dar un mensaje más amigable
      if (error.code === '23505') {
        return NextResponse.json(
          { error: "Ya existe un vehículo con esta matrícula estacionado" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("❌ Error inesperado:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
