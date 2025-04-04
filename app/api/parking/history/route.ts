// app/api/parking/history/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = createClient();

  // Obtener el user_id del encabezado de la solicitud
  const userId = req.headers.get("user-id");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    // Obtener los datos del historial para este usuario
    const { data, error } = await supabase
      .from("parking_history")
      .select("*")
      .eq("user_id", userId)
      .order("exit_time", { ascending: false });

    if (error) {
      console.error("Error al obtener historial:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Asegurarse de que data sea un arreglo
    const historyData = Array.isArray(data) ? data : [];
    
    return NextResponse.json(historyData);
  } catch (err) {
    console.error("Error inesperado al obtener historial:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
