import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const userId = req.headers.get("user-id");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    // Obtener todos los vehículos estacionados del usuario
    const { data: parkedVehicles, error: fetchError } = await supabase
      .from("parked_vehicles")
      .select("*")
      .eq("user_id", userId);

    if (fetchError) {
      console.error("Error al obtener vehículos:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Agrupar por matrícula y mantener solo el registro más reciente
    const vehicleMap = new Map();
    parkedVehicles?.forEach(vehicle => {
      const existing = vehicleMap.get(vehicle.license_plate);
      if (!existing || new Date(vehicle.entry_time) > new Date(existing.entry_time)) {
        vehicleMap.set(vehicle.license_plate, vehicle);
      }
    });

    // Eliminar todos los registros duplicados
    for (const vehicle of parkedVehicles || []) {
      const latest = vehicleMap.get(vehicle.license_plate);
      if (latest.id !== vehicle.id) {
        const { error: deleteError } = await supabase
          .from("parked_vehicles")
          .delete()
          .eq("id", vehicle.id);

        if (deleteError) {
          console.error("Error al eliminar duplicado:", deleteError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al limpiar registros:", error);
    return NextResponse.json(
      { error: "Error al limpiar registros duplicados" },
      { status: 500 }
    );
  }
} 