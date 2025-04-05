import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();

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
    } = await req.json();

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
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error en la ruta POST /api/parking/log:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}