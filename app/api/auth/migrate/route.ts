import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { oldUserId, newUserId } = await request.json();

    if (!oldUserId || !newUserId) {
      return NextResponse.json(
        { error: "Se requieren ambos IDs de usuario" },
        { status: 400 }
      );
    }

    const { supabase, response } = createClient(request);

    // 1. Migrar datos de vehículos estacionados
    const { error: parkedError } = await supabase
      .from("parked_vehicles")
      .update({ user_id: newUserId })
      .eq("user_id", oldUserId);

    if (parkedError) {
      console.error("Error migrando vehículos estacionados:", parkedError);
    }

    // 2. Migrar historial
    const { error: historyError } = await supabase
      .from("parking_history")
      .update({ user_id: newUserId })
      .eq("user_id", oldUserId);

    if (historyError) {
      console.error("Error migrando historial:", historyError);
    }

    // 3. Migrar tarifas
    const { error: ratesError } = await supabase
      .from("rates")
      .update({ user_id: newUserId })
      .eq("user_id", oldUserId);

    if (ratesError) {
      console.error("Error migrando tarifas:", ratesError);
    }

    // 4. Migrar capacidad
    const { error: capacityError } = await supabase
      .from("user_capacity")
      .update({ user_id: newUserId })
      .eq("user_id", oldUserId);

    if (capacityError) {
      console.error("Error migrando capacidad:", capacityError);
    }

    // 5. Eliminar la cuenta antigua
    const { error: deleteError } = await supabase.auth.admin.deleteUser(oldUserId);

    if (deleteError) {
      console.error("Error eliminando usuario antiguo:", deleteError);
    }

    const jsonResponse = NextResponse.json({
      success: true,
      message: "Datos migrados correctamente",
    });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en la migración:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 