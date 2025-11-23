import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Endpoint para verificar si una ocupación (relacionada a una reserva) está activa
 * GET /api/ocupacion/check?res_codigo=RES-XXX
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const resCodigo = url.searchParams.get('res_codigo');

    if (!resCodigo) {
      return NextResponse.json(
        { error: 'res_codigo es requerido' },
        { status: 400 }
      );
    }

    // Buscar si hay una ocupación para esta reserva sin salida registrada
    const { data: ocupacion, error } = await supabase
      .from('ocupacion')
      .select('ocu_id, ocu_fh_salida')
      .eq('res_codigo', resCodigo)
      .is('ocu_fh_salida', null)
      .maybeSingle();

    if (error) {
      console.error('Error verificando ocupación:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Si encontramos una ocupación sin salida, la plaza está ocupada
    const ocupada = !!ocupacion;

    console.log(`✅ [OCUPACION CHECK] res_codigo: ${resCodigo}, ocupada: ${ocupada}`);

    const jsonResponse = NextResponse.json({
      success: true,
      ocupada: ocupada,
      ocu_id: ocupacion?.ocu_id || null
    });

    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error('❌ Error en verificación de ocupación:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
