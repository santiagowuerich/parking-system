import { NextRequest, NextResponse } from "next/server";
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("usuario")
      .select("usu_nom, usu_ape, usu_tel, usu_email")
      .eq("auth_user_id", user.id)
      .single();

    if (error) {
      console.error("Error obteniendo perfil:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({
      nombre: data.usu_nom,
      apellido: data.usu_ape,
      telefono: data.usu_tel || "",
      email: data.usu_email
    });

    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en GET /api/usuario/profile:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
