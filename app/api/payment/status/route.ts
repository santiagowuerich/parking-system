// app/api/payment/status/route.ts
// Endpoint para verificar el estado de un pago de MercadoPago

import { NextRequest, NextResponse } from 'next/server';

// Función auxiliar para obtener la API Key del usuario
async function getApiKey(userId: string | null, request: NextRequest): Promise<{ key: string, response: NextResponse }> {
  if (!userId) {
    throw new Error('Se requiere un ID de usuario para obtener la API Key');
  }

  // Aquí necesitaríamos acceder a la base de datos para obtener la API key
  // Por simplicidad, vamos a devolver una respuesta simulada por ahora
  // En producción, esto debería consultar la base de datos

  return {
    key: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    response: NextResponse.next()
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const preferenceId = searchParams.get('preferenceId');
    const userId = searchParams.get('userId');

    if (!preferenceId) {
      return NextResponse.json({
        error: 'Preference ID requerido'
      }, { status: 400 });
    }

    console.log('🔍 Verificando estado del pago para preferenceId:', preferenceId);

    // Obtener API key del usuario
    const { key: accessToken } = await getApiKey(userId, request);

    if (!accessToken) {
      console.warn('⚠️ No se pudo obtener API key, devolviendo estado pendiente');
      return NextResponse.json({
        status: 'pending',
        preferenceId
      });
    }

    try {
      // Consultar pagos asociados a la preferencia usando la API de MercadoPago
      const searchResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/search?preference_id=${preferenceId}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!searchResponse.ok) {
        console.warn('⚠️ Error consultando API de MercadoPago, devolviendo pendiente');
        return NextResponse.json({
          status: 'pending',
          preferenceId
        });
      }

      const searchData = await searchResponse.json();
      console.log('📊 Respuesta de búsqueda de pagos:', searchData);

      // Buscar el pago más reciente aprobado
      const payments = searchData.results || [];
      const approvedPayment = payments.find((payment: any) =>
        payment.status === 'approved' || payment.status === 'authorized'
      );

      if (approvedPayment) {
        console.log('✅ Pago aprobado encontrado:', approvedPayment.id);
        return NextResponse.json({
          status: 'approved',
          paymentId: approvedPayment.id,
          preferenceId,
          amount: approvedPayment.transaction_amount,
          date_approved: approvedPayment.date_approved
        });
      }

      // Si hay pagos pero ninguno aprobado, verificar si hay rechazados
      const rejectedPayment = payments.find((payment: any) =>
        payment.status === 'rejected' || payment.status === 'cancelled'
      );

      if (rejectedPayment) {
        console.log('❌ Pago rechazado encontrado:', rejectedPayment.id);
        return NextResponse.json({
          status: 'rejected',
          paymentId: rejectedPayment.id,
          preferenceId,
          reason: rejectedPayment.status_detail
        });
      }

      // Si no hay pagos o todos están pendientes
      console.log('⏳ No hay pagos aprobados o rechazados, estado pendiente');
      return NextResponse.json({
        status: 'pending',
        preferenceId,
        payments_count: payments.length
      });

    } catch (apiError) {
      console.error('❌ Error consultando API de MercadoPago:', apiError);
      // En caso de error de API, devolver pendiente para no bloquear
      return NextResponse.json({
        status: 'pending',
        preferenceId,
        error: 'API_ERROR'
      });
    }

  } catch (error) {
    console.error('❌ Error en endpoint /api/payment/status:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      status: 'error'
    }, { status: 500 });
  }
}
