import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const supabase = createClient();
  const { id } = await Promise.resolve(context.params);
  
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
  } catch (error) {
    console.error("Error al eliminar registro:", error);
    return NextResponse.json(
      { error: "Error al eliminar el registro" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const supabase = createClient();
  const { id } = await Promise.resolve(context.params);
  
  try {
    const data = await request.json();

    const { error } = await supabase
      .from("parking_history")
      .update({
        license_plate: data.licensePlate,
        fee: data.fee,
        payment_method: data.paymentMethod || 'No especificado'
      })
      .eq("id", id);

    if (error) {
      console.error("Error al actualizar registro:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al actualizar registro:", error);
    return NextResponse.json(
      { error: "Error al actualizar el registro" },
      { status: 500 }
    );
  }
} 