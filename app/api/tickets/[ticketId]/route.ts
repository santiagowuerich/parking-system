// app/api/tickets/[ticketId]/route.ts
// Endpoint para obtener o cancelar un ticket específico

import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/services/ticket-service';

/**
 * GET /api/tickets/[ticketId]
 * Obtiene un ticket específico por su ID
 */
export async function GET(
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
  } catch (error) {
    console.error('❌ Error en GET /api/tickets/[ticketId]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tickets/[ticketId]
 * Cancela un ticket (no lo elimina, solo cambia su estado)
 */
export async function DELETE(
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

    const success = await TicketService.cancelTicket(ticketId);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo cancelar el ticket',
        },
        { status: 500 }
      );
    }

    console.log('❌ Ticket cancelado:', ticketId);

    return NextResponse.json({
      success: true,
      message: 'Ticket cancelado',
      ticketId,
    });
  } catch (error) {
    console.error('❌ Error en DELETE /api/tickets/[ticketId]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

