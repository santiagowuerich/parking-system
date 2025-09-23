// app/api/payment/mercadopago/create-qr/route.ts
// API para crear códigos QR de MercadoPago

import { NextRequest, NextResponse } from 'next/server'
import { generatePaymentId } from '@/lib/utils/payment-utils'

// Simulación de la API de MercadoPago (reemplazar con la real)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, vehicleLicensePlate, description, estId } = body

    // Validaciones básicas
    if (!amount || amount <= 0) {
      return NextResponse.json({
        error: 'Monto inválido'
      }, { status: 400 })
    }

    if (!vehicleLicensePlate) {
      return NextResponse.json({
        error: 'Patente del vehículo requerida'
      }, { status: 400 })
    }

    console.log('🔄 Creando preferencia de MercadoPago:', {
      amount,
      vehicleLicensePlate,
      description,
      estId
    })

    // TODO: Aquí iría la integración real con MercadoPago
    // Por ahora simulamos la respuesta

    const paymentId = generatePaymentId()
    const preferenceId = `pref_${paymentId}`

    // Simulación de datos de respuesta de MercadoPago
    const simulatedResponse = {
      success: true,
      paymentId,
      preferenceId,
      qrData: {
        qrCode: `00020101021243650016COM.MERCADOLIBRE02013063638f1192a-5fd1-4180-a180-8bcae3556bc35204000053039865802BR5925JOAO DA SILVA SAURO6009SAO PAULO61080540900062190515RP12345678901263046109`,
        // Generar un QR de ejemplo (en producción vendría de MercadoPago)
        qrCodeImage: generateSimulatedQR(amount, vehicleLicensePlate),
        initPoint: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenceId}`
      },
      amount,
      description: description || `Estacionamiento - ${vehicleLicensePlate}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
      status: 'pending'
    }

    console.log('✅ Preferencia de MercadoPago creada:', {
      paymentId,
      preferenceId,
      amount
    })

    return NextResponse.json(simulatedResponse)

  } catch (error) {
    console.error('❌ Error creando preferencia de MercadoPago:', error)

    return NextResponse.json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

// Función para generar un QR simulado (en producción vendría de MercadoPago)
function generateSimulatedQR(amount: number, vehicleLicensePlate: string): string {
  // QR code placeholder - en producción esto vendría de MercadoPago
  const qrSize = 200
  const encodedData = encodeURIComponent(`Pago: $${amount} - Vehículo: ${vehicleLicensePlate}`)

  // Usando un servicio público de generación de QR para la demo
  return `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodedData}&format=png&margin=10`
}

// API para verificar el estado de un pago QR
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')
    const preferenceId = searchParams.get('preferenceId')

    if (!paymentId && !preferenceId) {
      return NextResponse.json({
        error: 'Payment ID o Preference ID requerido'
      }, { status: 400 })
    }

    console.log('🔍 Verificando estado del pago:', { paymentId, preferenceId })

    // TODO: Aquí iría la consulta real a MercadoPago
    // Por ahora simulamos una respuesta

    // Simular diferentes estados de pago
    const randomOutcome = Math.random()
    let status: 'pending' | 'approved' | 'rejected' | 'expired'

    if (randomOutcome < 0.7) {
      status = 'pending'  // 70% pendiente
    } else if (randomOutcome < 0.9) {
      status = 'approved' // 20% aprobado
    } else if (randomOutcome < 0.95) {
      status = 'rejected' // 5% rechazado
    } else {
      status = 'expired'  // 5% expirado
    }

    const response = {
      success: true,
      paymentId: paymentId || `pay_${preferenceId}`,
      preferenceId: preferenceId || `pref_${paymentId}`,
      status,
      updatedAt: new Date().toISOString()
    }

    console.log('📊 Estado del pago verificado:', response)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error verificando estado del pago:', error)

    return NextResponse.json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}