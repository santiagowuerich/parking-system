import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    const { supabase, response } = createClient(request);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("Error de registro:", error);
      return NextResponse.json(
        { error: "Error al crear la cuenta" },
        { status: 400 }
      );
    }

    const jsonResponse = NextResponse.json({
      message: "Usuario registrado exitosamente",
      userId: data.user?.id,
    });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en el servidor:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 