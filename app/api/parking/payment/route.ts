import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const data = await request.json();
    const { historyId, method, amount, userId } = data;

    // Registrar el pago en la base de datos
    const { data: payment, error } = await supabase
      .from("parking_payments")
      .insert([
        {
          history_id: historyId,
          method,
          amount,
          user_id: userId,
          payment_date: new Date().toISOString(),
          status: "completed"
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Error al registrar pago:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error al procesar pago:", error);
    return NextResponse.json(
      { error: "Error al procesar el pago" },
      { status: 500 }
    );
  }
} 