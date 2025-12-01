// app/api/tickets/generate-subscription-extension/route.ts
// Endpoint para generar tickets de extensión de abono

import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/services/ticket-service';
import { TicketFormat } from '@/lib/types/ticket';

/**
 * POST /api/tickets/generate-subscription-extension
 * 
 * Genera un ticket de extensión de abono (sin ocupación).
 * 
 * Body:
 * {
 *   paymentId: string | number (requerido)
 *   abo_nro: number (requerido)
 *   est_id: number (requerido)
 *   veh_patente: string (requerido)
 *   format?: 'reduced' | 'detailed' | 'digital'
 *   generatedBy: string (requerido - ID o nombre del operador)
 *   notes?: string
 *   paymentMethod?: 'efectivo' | 'transferencia' | 'qr' | 'link_pago' (opcional - sobrescribe el de la BD)
 * }
 * 
 * Response:
 * {
 *   success: boolean
 *   ticket?: ParkingTicket
 *   error?: string
 *   details?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar campos requeridos
    if (!body.paymentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo requerido faltante',
          details: 'paymentId es requerido',
        },
        { status: 400 }
      );
    }

    if (!body.abo_nro) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo requerido faltante',
          details: 'abo_nro es requerido',
        },
        { status: 400 }
      );
    }

    if (!body.est_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo requerido faltante',
          details: 'est_id es requerido',
        },
        { status: 400 }
      );
    }

    if (!body.veh_patente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo requerido faltante',
          details: 'veh_patente es requerido',
        },
        { status: 400 }
      );
    }

    if (!body.generatedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo requerido faltante',
          details: 'generatedBy es requerido',
        },
        { status: 400 }
      );
    }

    // Validar formato si se proporciona
    const validFormats: TicketFormat[] = ['reduced', 'detailed', 'digital'];
    if (body.format && !validFormats.includes(body.format)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Formato inválido',
          details: `El formato debe ser uno de: ${validFormats.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validar método de pago si se proporciona
    const validPaymentMethods = ['efectivo', 'transferencia', 'qr', 'link_pago'];
    if (body.paymentMethod && !validPaymentMethods.includes(body.paymentMethod)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Método de pago inválido',
          details: `El método de pago debe ser uno de: ${validPaymentMethods.join(', ')}`,
        },
        { status: 400 }
      );
    }

    console.log('🎫 Generando ticket de extensión de abono:', body.abo_nro, 'método:', body.paymentMethod);

    // Generar ticket
    const result = await TicketService.generateSubscriptionExtensionTicket({
      paymentId: body.paymentId,
      abo_nro: Number(body.abo_nro),
      est_id: Number(body.est_id),
      veh_patente: body.veh_patente,
      generatedBy: body.generatedBy,
      format: body.format || 'reduced',
      notes: body.notes || undefined,
      paymentMethod: body.paymentMethod || undefined,
    });

    if (!result.success) {
      console.error('❌ Error generando ticket de extensión:', result.error);
      return NextResponse.json(result, { status: 400 });
    }

    console.log('✅ Ticket de extensión generado:', result.ticket?.ticketId);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('❌ Error en endpoint /api/tickets/generate-subscription-extension:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

