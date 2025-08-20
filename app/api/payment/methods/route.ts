import { NextRequest, NextResponse } from "next/server";
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const estId = Number(url.searchParams.get('est_id')) || 1;

    // Obtener todos los métodos de pago disponibles
    const { data: allMethods, error: methodsError } = await supabase
      .from("metodos_pagos")
      .select("mepa_metodo, mepa_descripcion");

    if (methodsError) {
      console.error("Error obteniendo métodos de pago:", methodsError);
      return NextResponse.json({ error: methodsError.message }, { status: 500 });
    }

    // Obtener métodos aceptados por este estacionamiento
    const { data: acceptedMethods, error: acceptedError } = await supabase
      .from("est_acepta_metodospago")
      .select("mepa_metodo")
      .eq("est_id", estId);

    if (acceptedError) {
      console.error("Error obteniendo métodos aceptados:", acceptedError);
      // Si no existe la tabla o hay error, asumir que todos están habilitados
    }

    const acceptedSet = new Set(acceptedMethods?.map(am => am.mepa_metodo) || []);
    
    // Agregar QR como método adicional (basado en MercadoPago)
    const methods = [
      ...(allMethods || []).map(method => ({
        method: method.mepa_metodo,
        description: method.mepa_descripcion,
        enabled: acceptedMethods?.length === 0 ? true : acceptedSet.has(method.mepa_metodo)
      })),
      {
        method: 'QR',
        description: 'Código QR de MercadoPago',
        enabled: acceptedMethods?.length === 0 ? true : acceptedSet.has('QR')
      }
    ];

    const jsonResponse = NextResponse.json({ methods });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en GET /api/payment/methods:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { method, enabled } = await request.json();
    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const estId = Number(url.searchParams.get('est_id')) || 1;

    if (!method) {
      return NextResponse.json({ error: "Método de pago requerido" }, { status: 400 });
    }

    if (enabled) {
      // Habilitar método: insertar en est_acepta_metodospago
      const { error: insertError } = await supabase
        .from("est_acepta_metodospago")
        .upsert({
          est_id: estId,
          mepa_metodo: method
        }, {
          onConflict: 'est_id,mepa_metodo'
        });

      if (insertError) {
        console.error("Error habilitando método:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    } else {
      // Deshabilitar método: eliminar de est_acepta_metodospago
      const { error: deleteError } = await supabase
        .from("est_acepta_metodospago")
        .delete()
        .eq("est_id", estId)
        .eq("mepa_metodo", method);

      if (deleteError) {
        console.error("Error deshabilitando método:", deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    const jsonResponse = NextResponse.json({ 
      success: true, 
      message: `Método ${method} ${enabled ? 'habilitado' : 'deshabilitado'} correctamente` 
    });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en POST /api/payment/methods:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
