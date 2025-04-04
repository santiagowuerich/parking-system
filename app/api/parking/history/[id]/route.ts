import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { id } = params;

  try {
    const { error } = await supabase
      .from("parking_history")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error al eliminar registro:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error inesperado al eliminar registro:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { id } = params;
  const body = await req.json();

  try {
    const { error } = await supabase
      .from("parking_history")
      .update({
        license_plate: body.licensePlate,
        fee: body.fee,
      })
      .eq("id", id);

    if (error) {
      console.error("Error al actualizar registro:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error inesperado al actualizar registro:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 