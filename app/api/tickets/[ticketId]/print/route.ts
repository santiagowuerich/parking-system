// app/api/tickets/[ticketId]/print/route.ts
// Endpoint para marcar un ticket como impreso

import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/services/ticket-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ticketId es requerido',
        },
        { status: 400 }
      );
    }

    const success = await TicketService.markAsPrinted(ticketId);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo marcar el ticket como impreso',
        },
        { status: 500 }
      );
    }

    console.log('🖨️ Ticket marcado como impreso:', ticketId);

    return NextResponse.json({
      success: true,
      message: 'Ticket marcado como impreso',
      ticketId,
      printedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error en endpoint /api/tickets/[ticketId]/print:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

