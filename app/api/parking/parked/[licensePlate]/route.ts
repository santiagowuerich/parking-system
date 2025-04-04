import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { licensePlate: string } }
) {
  const supabase = createClient();
  const { licensePlate } = params;

  try {
    const { error } = await supabase
      .from("parked_vehicles")
      .delete()
      .eq("license_plate", licensePlate);

    if (error) {
      console.error("Error al eliminar vehículo:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error inesperado al eliminar vehículo:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 