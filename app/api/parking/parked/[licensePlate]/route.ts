import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { licensePlate: string } }
) {
  const licensePlate = (await params).licensePlate;

  try {
    const { supabase, response } = createClient(request);

    const { error } = await supabase
      .from("parked_vehicles")
      .delete()
      .eq("license_plate", licensePlate);

    if (error) {
      console.error("Error al eliminar vehículo:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ success: true });
    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error("Error inesperado al eliminar vehículo:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 