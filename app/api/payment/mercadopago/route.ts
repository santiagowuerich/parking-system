import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from 'mercadopago';

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  throw new Error('MERCADOPAGO_ACCESS_TOKEN must be defined');
}

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

export async function POST(req: Request) {
  try {
    const { 
      licensePlate,
      fee,
      vehicleType,
      paymentType // 'regular' o 'qr'
    } = await req.json();

    console.log('Creating preference with data:', { licensePlate, fee, vehicleType, paymentType });

    // Crear la preferencia de pago
    const preferenceData = {
      body: {
        items: [
          {
            id: licensePlate,
            title: `Estacionamiento - ${vehicleType} - ${licensePlate}`,
            unit_price: Number(fee),
            quantity: 1,
            currency_id: "ARS"
          }
        ],
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success`,
          failure: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/failure`,
          pending: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/pending`
        },
        notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/webhook`,
        auto_return: "approved",
        statement_descriptor: "Parking System",
        external_reference: licensePlate,
        payment_methods: paymentType === 'qr' ? {
          excluded_payment_types: [
            { id: "credit_card" },
            { id: "debit_card" },
            { id: "bank_transfer" }
          ],
          default_payment_method_id: "account_money"
        } : undefined
      }
    };

    console.log('Preference data:', preferenceData);

    const preference_client = new Preference(client);
    const response = await preference_client.create(preferenceData);

    console.log('Mercado Pago response:', response);

    if (paymentType === 'qr') {
      // Para pagos QR, generamos un QR que apunte directamente al punto de pago
      const qrData = response.init_point;
      return NextResponse.json({
        id: response.id,
        init_point: response.init_point,
        qr_code: qrData
      });
    }

    return NextResponse.json({
      id: response.id,
      init_point: response.init_point
    });
  } catch (error) {
    console.error("Error detallado de Mercado Pago:", error);
    return NextResponse.json(
      { error: "Error al procesar el pago", details: error },
      { status: 500 }
    );
  }
} 