import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createClient } from "@/lib/supabase/server"; // Importar cliente Supabase

// Función auxiliar para obtener la API Key del usuario o la global
async function getApiKey(userId: string | null): Promise<string> {
  let apiKey = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (userId) {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("mercadopago_api_key")
        .eq("id", userId)
        .single();

      if (error) {
        console.error(`Error fetching API key for user ${userId}:`, error.message);
      } else if (data?.mercadopago_api_key) {
        // Verificar que la API key tenga un formato válido (comienza con TEST- o APP_USR-)
        const key = data.mercadopago_api_key.trim();
        if (key.startsWith('TEST-') || key.startsWith('APP_USR-')) {
          apiKey = key;
          console.log(`Using API key for user ${userId}`);
        } else {
          console.error(`Invalid API key format for user ${userId}`);
        }
      } else {
        console.log(`User ${userId} has no specific API key, using global.`);
      }
    } catch (err) {
      console.error(`Unexpected error fetching API key for user ${userId}:`, err);
    }
  }

  // Validar la API key global si no se encontró una válida del usuario
  if (!apiKey) {
    throw new Error('No se encontró una API Key válida. Por favor, configura tu API Key de MercadoPago en el panel de tarifas.');
  }

  // Verificar que la API key global tenga un formato válido
  if (!apiKey.startsWith('TEST-') && !apiKey.startsWith('APP_USR-')) {
    throw new Error('El formato de la API Key no es válido. Debe comenzar con TEST- o APP_USR-');
  }

  return apiKey;
}

export async function POST(req: Request) {
    try {
        const { licensePlate, fee, vehicleType, userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Se requiere ID de usuario" }, { status: 400 });
        }

        const accessToken = await getApiKey(userId);
        const client = new MercadoPagoConfig({ accessToken });
        const preference_client = new Preference(client);

        console.log('Creating preference with data:', { licensePlate, fee, vehicleType });

        const preferenceData = {
            body: {
                items: [{
                    id: licensePlate || 'parking-fee',
                    title: `Estacionamiento - ${vehicleType || 'Vehículo'} - ${licensePlate || ''}`,
                    unit_price: Number(fee),
                    quantity: 1,
                    currency_id: "ARS"
                }],
                payment_methods: {
                    default_payment_method_id: "account_money",
                    excluded_payment_methods: [{ id: "bank_transfer" }],
                    installments: 1
                },
                external_reference: `${licensePlate}_${userId}`,
                notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/webhook?userId=${userId}`
            }
        };

        console.log('Creating preference with data:', JSON.stringify(preferenceData, null, 2));

        const preference = await preference_client.create(preferenceData);
        console.log('Preference created:', JSON.stringify(preference, null, 2));

        // Intentar obtener el QR directamente del point_of_interaction
        const response = preference as any;
        const qrData = response.point_of_interaction?.transaction_data?.qr_code;
        const qrCodeBase64 = response.point_of_interaction?.transaction_data?.qr_code_base64;

        console.log('QR Data extracted:', { qrData, qrCodeBase64 });

        return NextResponse.json({
            success: true,
            qr_code: qrData || preference.init_point,
            qr_code_base64: qrCodeBase64,
            init_point: preference.init_point
        });

    } catch (error: any) {
        console.error('Error creating payment preference:', error);
        return NextResponse.json({
            success: false,
            error: 'Error al crear la preferencia de pago',
            details: error.message,
            cause: error.cause
        }, { status: 500 });
    }
} 