import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Seleccionar todos los campos relevantes de user_settings
    const { data, error } = await supabase
      .from("user_settings")
      .select("mercadopago_api_key, bank_account_holder, bank_account_cbu, bank_account_alias")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
        console.error("Error fetching user settings:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Devolver todos los datos encontrados o nulls si no hay fila
    const responseData = {
      mercadopagoApiKey: data?.mercadopago_api_key || null,
      bankAccountHolder: data?.bank_account_holder || null,
      bankAccountCbu: data?.bank_account_cbu || null,
      bankAccountAlias: data?.bank_account_alias || null,
    };

    const jsonResponse = NextResponse.json(responseData);
    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error("Unexpected error fetching user settings:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Aceptar todos los campos posibles en el body
    const { 
      userId,
      mercadopagoApiKey, 
      bankAccountHolder, 
      bankAccountCbu, 
      bankAccountAlias 
    } = await request.json();

    const { supabase, response } = createClient(request);
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      effectiveUserId = user.id;
    }
    
    // Construir el objeto de datos a actualizar/insertar
    // Incluir solo los campos que realmente vienen en la petición
    // (o definir si se deben borrar si vienen como null/undefined)
    const dataToUpsert: any = {
        user_id: effectiveUserId,
        updated_at: new Date().toISOString()
    };
    if (mercadopagoApiKey !== undefined) dataToUpsert.mercadopago_api_key = mercadopagoApiKey;
    if (bankAccountHolder !== undefined) dataToUpsert.bank_account_holder = bankAccountHolder;
    if (bankAccountCbu !== undefined) dataToUpsert.bank_account_cbu = bankAccountCbu;
    if (bankAccountAlias !== undefined) dataToUpsert.bank_account_alias = bankAccountAlias;

    const { error: upsertError } = await supabase
      .from("user_settings")
      .upsert(dataToUpsert, { onConflict: 'user_id' });

    if (upsertError) {
      console.error("Error updating user settings:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ 
      success: true,
      message: "Configuración guardada correctamente" 
    });
    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error("Unexpected error updating user settings:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
} 