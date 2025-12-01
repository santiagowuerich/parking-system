import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

// Función auxiliar para obtener la API Key del dueño del estacionamiento
async function getApiKeyByEstacionamiento(estId: number, request: NextRequest): Promise<{ key: string, response: NextResponse }> {
  if (!estId || estId <= 0) {
    throw new Error('Se requiere un ID de estacionamiento válido para obtener la API Key');
  }

  const { supabase, response } = createClient(request);
  
  // Buscar el dueño del estacionamiento
  const { data: estData, error: estError } = await supabase
    .from("estacionamientos")
    .select("due_id")
    .eq("est_id", estId)
    .single();

  if (estError || !estData) {
    console.error(`Error fetching estacionamiento ${estId}:`, estError?.message);
    throw new Error('Estacionamiento no encontrado');
  }

  // Buscar el auth_user_id del dueño
  const { data: usuarioData, error: usuarioError } = await supabase
    .from("usuario")
    .select("auth_user_id")
    .eq("usu_id", estData.due_id)
    .single();

  if (usuarioError || !usuarioData?.auth_user_id) {
    console.error(`Error fetching usuario ${estData.due_id}:`, usuarioError?.message);
    throw new Error('No se pudo obtener el dueño del estacionamiento');
  }

  // Obtener la API Key del dueño
  const { data, error } = await supabase
    .from("user_settings")
    .select("mercadopago_api_key")
    .eq("user_id", usuarioData.auth_user_id)
    .single();

  if (error) {
    console.error(`Error fetching API key for owner:`, error.message);
    throw new Error('Error al obtener la API Key del dueño del estacionamiento');
  }

  if (!data?.mercadopago_api_key) {
    throw new Error('No se encontró una API Key configurada para este estacionamiento. El dueño debe configurar su API Key de MercadoPago en el panel de configuración.');
  }

  const key = data.mercadopago_api_key.trim();
  if (!key.startsWith('TEST-') && !key.startsWith('APP_USR-')) {
    throw new Error('El formato de la API Key no es válido. Debe comenzar con TEST- o APP_USR-');
  }

  return { key, response };
}

export async function POST(request: NextRequest) {
  try {
    const { licensePlate, fee, vehicleType, userId, paymentType, est_id } = await request.json();

    // Validar que se proporcione el est_id
    if (!est_id || est_id <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere el ID del estacionamiento',
        details: 'El parámetro est_id es obligatorio'
      }, { status: 400 });
    }

    // Obtener la API Key del dueño del estacionamiento
    const { key: accessToken, response } = await getApiKeyByEstacionamiento(est_id, request);
    const client = new MercadoPagoConfig({ accessToken });

    // Obtener User Info
    const userFetchOptions = {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    };

    const userResponse = await fetch('https://api.mercadopago.com/users/me', userFetchOptions);
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[MP API Error] User Info:', errorText);
      throw new Error('Error al obtener información del usuario de Mercado Pago');
    }

    const userData = await userResponse.json();
    const collectorId = userData.id;

    // Validar monto
    const amount = Number(fee);
    if (!amount || amount <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Monto inválido',
        details: 'El monto debe ser mayor a 0'
      }, { status: 400 });
    }

    // Crear preferencia de pago
    const preferencePayload = {
      items: [{
        id: licensePlate || 'parking-fee',
        title: `Estacionamiento - ${vehicleType || 'Vehículo'} - ${licensePlate || ''}`,
        description: `Pago de estacionamiento para ${vehicleType || 'Vehículo'}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: amount
      }],
      payment_methods: {
        default_payment_method_id: paymentType === 'qr' ? "account_money" : undefined,
        excluded_payment_methods: paymentType === 'qr' ? [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "bank_transfer" }
        ] : [],
        installments: 1
      },
      external_reference: `${licensePlate}_${userId || 'anon'}`,
      notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/webhook`,
      binary_mode: true
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferencePayload)
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      console.error('[MP API Error] Create Preference:', errorData);
      throw new Error(errorData.message || 'Error al crear la preferencia de pago');
    }

    const data = await mpResponse.json();

    // Extraer el código QR si es pago QR
    const qrBase64 = paymentType === 'qr' ? data.point_of_interaction?.transaction_data?.qr_code_base64 : null;
    const qrCode = paymentType === 'qr' ? data.point_of_interaction?.transaction_data?.qr_code : null;

    const jsonResponse = NextResponse.json({
      success: true,
      qr_code: qrCode || data.init_point,
      qr_code_base64: qrBase64,
      init_point: data.init_point,
      fee: Number(fee)
    });

    return copyResponseCookies(response, jsonResponse);

  } catch (error: any) {
    console.error('Error handling payment order:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al crear la orden de pago',
      details: error.message || 'Error desconocido'
    }, { status: 500 });
  }
}