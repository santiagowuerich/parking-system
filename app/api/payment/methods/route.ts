import { NextRequest, NextResponse } from "next/server";
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const estId = Number(url.searchParams.get('est_id'));

    if (!estId || estId <= 0) {
      return NextResponse.json({
        error: "ID de estacionamiento inválido",
        methods: []
      }, { status: 400 });
    }

    console.log(`🔍 Obteniendo métodos para estId: ${estId}`);

    // Obtener métodos disponibles
    const { data: allMethods, error: methodsError } = await supabase
      .from("metodos_pagos")
      .select("mepa_metodo, mepa_descripcion");

    if (methodsError) {
      console.error("Error obteniendo métodos:", methodsError);
      return NextResponse.json({ error: methodsError.message }, { status: 500 });
    }

    // Obtener métodos aceptados por este estacionamiento
    const { data: acceptedMethods, error: acceptedError } = await supabase
      .from("est_acepta_metodospago")
      .select("mepa_metodo")
      .eq("est_id", estId);

    if (acceptedError) {
      console.error("Error obteniendo métodos aceptados:", acceptedError);
      return NextResponse.json({ error: acceptedError.message }, { status: 500 });
    }

    // Crear Set con métodos aceptados
    const acceptedSet = new Set(acceptedMethods?.map(am => am.mepa_metodo) || []);

    console.log(`📊 Estacionamiento ${estId}: ${acceptedMethods?.length || 0} métodos configurados`);
    console.log(`📋 Métodos configurados: ${Array.from(acceptedSet).join(', ') || 'NINGUNO'}`);

    // Crear lista de métodos
    const methods = [
      ...(allMethods || []).map(method => ({
        method: method.mepa_metodo,
        description: method.mepa_descripcion,
        enabled: acceptedSet.has(method.mepa_metodo)
      })),
      {
        method: 'QR',
        description: 'Código QR de MercadoPago',
        enabled: acceptedSet.has('MercadoPago')
      }
    ];

    console.log(`✅ Métodos a devolver:`, methods.map(m => `${m.method}: ${m.enabled}`).join(', '));

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

// Endpoint para auto-configurar métodos de pago por defecto
export async function PUT(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const estId = Number(url.searchParams.get('est_id')) || 1;

    console.log(`🔧 Auto-configurando métodos de pago para estacionamiento ${estId}`);

    // Verificar que no haya métodos ya configurados
    const { data: existingMethods, error: checkError } = await supabase
      .from("est_acepta_metodospago")
      .select("mepa_metodo")
      .eq("est_id", estId);

    if (checkError) {
      console.error("❌ Error verificando métodos existentes:", checkError);
      return NextResponse.json({ error: "Error verificando configuración actual" }, { status: 500 });
    }

    // Si ya hay métodos configurados, no hacer nada
    if (existingMethods && existingMethods.length > 0) {
      console.log(`ℹ️ El estacionamiento ${estId} ya tiene ${existingMethods.length} métodos configurados`);
      const jsonResponse = NextResponse.json({
        message: "Los métodos de pago ya están configurados",
        configured_methods: existingMethods.length
      });
      return copyResponseCookies(response, jsonResponse);
    }

    // Configurar métodos por defecto
    const defaultMethods = [
      { est_id: estId, mepa_metodo: 'Efectivo' },
      { est_id: estId, mepa_metodo: 'Transferencia' },
      { est_id: estId, mepa_metodo: 'MercadoPago' }
    ];

    const { error: insertError } = await supabase
      .from("est_acepta_metodospago")
      .insert(defaultMethods);

    if (insertError) {
      console.error("❌ Error configurando métodos por defecto:", insertError);
      return NextResponse.json({
        error: "Error configurando métodos de pago",
        details: insertError.message
      }, { status: 500 });
    }

    console.log(`✅ Auto-configurados ${defaultMethods.length} métodos de pago para estacionamiento ${estId}`);

    const jsonResponse = NextResponse.json({
      success: true,
      message: `Configurados ${defaultMethods.length} métodos de pago por defecto`,
      configured_methods: defaultMethods.map(m => m.mepa_metodo)
    });
    return copyResponseCookies(response, jsonResponse);

  } catch (error) {
    console.error("❌ Error en PUT /api/payment/methods:", error);
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

    // Manejar QR como método especial (es equivalente a MercadoPago)
    if (method === 'QR') {
      if (enabled) {
        // Para QR, habilitamos MercadoPago en la base de datos
        const { error: insertError } = await supabase
          .from("est_acepta_metodospago")
          .upsert({
            est_id: estId,
            mepa_metodo: 'MercadoPago'
          }, {
            onConflict: 'est_id,mepa_metodo'
          });

        if (insertError) {
          console.error("Error habilitando MercadoPago para QR:", insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      } else {
        // Para deshabilitar QR, deshabilitamos MercadoPago
        const { error: deleteError } = await supabase
          .from("est_acepta_metodospago")
          .delete()
          .eq("est_id", estId)
          .eq("mepa_metodo", 'MercadoPago');

        if (deleteError) {
          console.error("Error deshabilitando MercadoPago para QR:", deleteError);
          return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }
      }
    } else {
      // Método normal (Efectivo, Transferencia, MercadoPago)
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
