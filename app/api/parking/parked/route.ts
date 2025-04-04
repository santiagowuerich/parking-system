// app/api/parking/parked/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = createClient();

  // Obtener el user_id del encabezado de la solicitud
  const userId = req.headers.get("user-id");  // Asegúrate de enviar el user_id desde el frontend

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  // Obtener los vehículos estacionados para este usuario
  const { data, error } = await supabase
    .from("parked_vehicles")
    .select("*")
    .eq("user_id", userId);  // Filtrar por user_id

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
