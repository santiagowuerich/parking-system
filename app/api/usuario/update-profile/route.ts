import { NextRequest, NextResponse } from "next/server";
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  try {
    const { nombre, apellido, telefono } = await request.json();
    const { supabase, response } = createClient(request);

    // Validar campos requeridos
    if (!nombre || !apellido) {
      return NextResponse.json(
        { error: "Nombre y apellido son requeridos" },
        { status: 400 }
      );
    }

    // Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Actualizar tabla usuario
    const { error } = await supabase
      .from("usuario")
      .update({
        usu_nom: nombre,
        usu_ape: apellido,
        usu_tel: telefono || null
      })
      .eq("auth_user_id", user.id);

    if (error) {
      console.error("Error actualizando perfil:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({
      success: true,
      message: "Perfil actualizado correctamente"
    });

    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en POST /api/usuario/update-profile:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
