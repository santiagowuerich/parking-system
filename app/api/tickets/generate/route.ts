// app/api/tickets/generate/route.ts
// Endpoint para generar tickets de estacionamiento

import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/services/ticket-service';
import { GenerateTicketRequest, TicketFormat } from '@/lib/types/ticket';

/**
 * POST /api/tickets/generate
 * 
 * Genera un ticket de estacionamiento consolidando datos de múltiples fuentes.
 * 
 * Body:
 * {
 *   paymentId: string | number (opcional)
 *   occupationId: number (requerido)
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
    if (!body.occupationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo requerido faltante',
          details: 'occupationId es requerido',
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

    // Construir request
    const ticketRequest: GenerateTicketRequest = {
      paymentId: body.paymentId || '',
      occupationId: Number(body.occupationId),
      format: body.format || 'reduced',
      generatedBy: body.generatedBy,
      notes: body.notes || undefined,
      paymentMethod: body.paymentMethod || undefined,
    };

    console.log('🎫 Generando ticket para ocupación:', ticketRequest.occupationId, 'método:', ticketRequest.paymentMethod);

    // Generar ticket
    const result = await TicketService.generateTicket(ticketRequest);

    if (!result.success) {
      console.error('❌ Error generando ticket:', result.error);
      return NextResponse.json(result, { status: 400 });
    }

    console.log('✅ Ticket generado:', result.ticket?.ticketId);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('❌ Error en endpoint /api/tickets/generate:', error);
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

/**
 * GET /api/tickets/generate
 * 
 * Obtiene un ticket existente por ID o por occupationId
 * 
 * Query params:
 * - ticketId: string
 * - occupationId: number
 * - estId: number
 * - vehiclePlate: string
 * - dateFrom: string (ISO)
 * - dateTo: string (ISO)
 * - status: string
 * - format: string
 * - limit: number
 * - offset: number
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const ticketId = searchParams.get('ticketId');
    
    // Si se busca por ticketId específico
    if (ticketId) {
      const ticket = await TicketService.getTicketById(ticketId);
      
      if (!ticket) {
        return NextResponse.json(
          {
            success: false,
            error: 'Ticket no encontrado',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        ticket,
      });
    }

    // Búsqueda con filtros
    const searchResult = await TicketService.searchTickets({
      occupationId: searchParams.get('occupationId')
        ? Number(searchParams.get('occupationId'))
        : undefined,
      paymentId: searchParams.get('paymentId')
        ? Number(searchParams.get('paymentId'))
        : undefined,
      estId: searchParams.get('estId')
        ? Number(searchParams.get('estId'))
        : undefined,
      vehiclePlate: searchParams.get('vehiclePlate') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      status: searchParams.get('status') as any || undefined,
      format: searchParams.get('format') as any || undefined,
      limit: searchParams.get('limit')
        ? Number(searchParams.get('limit'))
        : 50,
      offset: searchParams.get('offset')
        ? Number(searchParams.get('offset'))
        : 0,
    });

    return NextResponse.json(searchResult);
  } catch (error) {
    console.error('❌ Error en GET /api/tickets/generate:', error);
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

