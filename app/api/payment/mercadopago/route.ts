import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

// Función auxiliar para obtener la API Key del usuario
async function getApiKey(userId: string | null, request: NextRequest): Promise<{ key: string, response: NextResponse }> {
  if (!userId) {
    throw new Error('Se requiere un ID de usuario para obtener la API Key');
  }

  const { supabase, response } = createClient(request);
  const { data, error } = await supabase
    .from("user_settings")
    .select("mercadopago_api_key")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error(`Error fetching API key for user ${userId}:`, error.message);
    throw new Error('Error al obtener la API Key del usuario');
  }

  if (!data?.mercadopago_api_key) {
    throw new Error('No se encontró una API Key configurada. Por favor, configura tu API Key de MercadoPago en el panel de tarifas.');
  }

  const key = data.mercadopago_api_key.trim();
  if (!key.startsWith('TEST-') && !key.startsWith('APP_USR-')) {
    throw new Error('El formato de la API Key no es válido. Debe comenzar con TEST- o APP_USR-');
  }

  return { key, response };
}

export async function POST(request: NextRequest) {
  try {
    const { licensePlate, fee, vehicleType, userId, paymentType } = await request.json();

    // userId solo se usa para buscar API key y referencia externa si está disponible
    const { key: accessToken, response } = await getApiKey(userId || null, request);
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