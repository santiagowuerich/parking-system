import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);

    // 1. Limpiar vehículos estacionados
    const { error: parkedError } = await supabase
      .from("parked_vehicles")
      .delete()
      .neq("id", 0); // Elimina todos los registros

    if (parkedError) {
      console.error("Error limpiando vehículos estacionados:", parkedError);
    }

    // 2. Limpiar historial
    const { error: historyError } = await supabase
      .from("parking_history")
      .delete()
      .neq("id", 0);

    if (historyError) {
      console.error("Error limpiando historial:", historyError);
    }

    // 3. Limpiar tarifas
    const { error: ratesError } = await supabase
      .from("rates")
      .delete()
      .neq("id", 0);

    if (ratesError) {
      console.error("Error limpiando tarifas:", ratesError);
    }

    // 4. Limpiar capacidad
    const { error: capacityError } = await supabase
      .from("user_capacity")
      .delete()
      .neq("id", 0);

    if (capacityError) {
      console.error("Error limpiando capacidad:", capacityError);
    }

    const jsonResponse = NextResponse.json({
      success: true,
      message: "Todos los datos han sido eliminados correctamente",
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