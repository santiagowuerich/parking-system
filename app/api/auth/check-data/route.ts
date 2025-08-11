import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const estId = Number(searchParams.get('est_id')) || 1

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const { supabase, response } = createClient(request);

    // Nuevo esquema: revisar si hay datos en tablas clave para el est_id
    const [{ data: ocup }, { data: pagos }, { data: tarifas }] = await Promise.all([
      supabase.from('ocupacion').select('ocu_id').eq('est_id', estId).limit(1),
      supabase.from('pagos').select('pag_nro').eq('est_id', estId).limit(1),
      supabase.from('tarifas').select('est_id').eq('est_id', estId).limit(1),
    ])

    const hasData = Boolean(ocup?.length || pagos?.length || tarifas?.length)

    const jsonResponse = NextResponse.json({ hasData, estId });
    return copyResponseCookies(response, jsonResponse);
  } catch (error: any) {
    console.error("Error checking user data:", error);
    return NextResponse.json(
      { error: "Error checking user data" },
      { status: 500 }
    );
  }
} 