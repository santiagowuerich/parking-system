import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = await Promise.resolve(context.params);
  
  try {
    const { supabase, response } = createClient(request);

    const { error } = await supabase
      .from("parking_history")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error al eliminar registro:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ success: true });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error al eliminar registro:", error);
    return NextResponse.json(
      { error: "Error al eliminar el registro" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = await Promise.resolve(context.params);
  
  try {
    const data = await request.json();
    const { supabase, response } = createClient(request);

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

    const jsonResponse = NextResponse.json({ success: true });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error al actualizar registro:", error);
    return NextResponse.json(
      { error: "Error al actualizar el registro" },
      { status: 500 }
    );
  }
} 