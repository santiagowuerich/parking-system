import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const userId = new URL(request.url).searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Se requiere ID de usuario" }, { status: 400 });
  }

  try {
    const { supabase, response } = createClient(request);

    const { data, error } = await supabase
      .from("user_settings")
      .select("mercadopago_api_key")
      .eq("user_id", userId)
      .single();

    if (error) {
      // Si el error es porque no se encontró la fila, devolvemos un objeto vacío
      if (error.code === 'PGRST116') {
        const jsonResponse = NextResponse.json({ mercadopagoApiKey: null });
        return copyResponseCookies(response, jsonResponse);
      }
      console.error("Error fetching user settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({
      mercadopagoApiKey: data?.mercadopago_api_key || null
    });
    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error("Unexpected error fetching user settings:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, mercadopagoApiKey } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    if (typeof mercadopagoApiKey !== 'string') {
      return NextResponse.json({ error: "mercadopagoApiKey must be a string" }, { status: 400 });
    }

    const { supabase, response } = createClient(request);

    // Primero intentamos actualizar, si no existe el registro lo creamos
    const { error: updateError } = await supabase
      .from("user_settings")
      .upsert({
        user_id: userId,
        mercadopago_api_key: mercadopagoApiKey,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error("Error updating user settings:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ 
      success: true,
      message: "API Key guardada correctamente" 
    });
    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error("Unexpected error updating user settings:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
} 