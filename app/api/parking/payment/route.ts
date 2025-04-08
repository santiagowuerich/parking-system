import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { historyId, method, amount, userId } = data;

    const { supabase, response } = createClient(request);

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

    const jsonResponse = NextResponse.json(payment);
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error al procesar pago:", error);
    return NextResponse.json(
      { error: "Error al procesar el pago" },
      { status: 500 }
    );
  }
} 