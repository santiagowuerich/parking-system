// app/api/tickets/[ticketId]/pdf/route.ts
// Endpoint para generar y servir el PDF del ticket

import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/services/ticket-service';
import { ParkingTicket } from '@/lib/types/ticket';

/**
 * GET /api/tickets/[ticketId]/pdf
 * 
 * Genera y retorna el PDF del ticket
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

    // Obtener el ticket
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

    // Generar HTML del ticket
    const htmlContent = generateTicketHTML(ticket);

    // Retornar HTML que se puede convertir a PDF en el cliente
    // O mejor aún, usar un servicio de generación de PDF en el servidor
    // Por ahora retornamos el HTML y el cliente lo convierte
    
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="ticket-${ticketId}.html"`,
      },
    });
  } catch (error) {
    console.error('❌ Error en GET /api/tickets/[ticketId]/pdf:', error);
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
 * Genera el HTML del ticket para PDF
 */
function generateTicketHTML(ticket: ParkingTicket): string {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('es-AR');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      link_pago: 'Link de Pago',
      qr: 'QR',
    };
    return labels[method] || method;
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            size: 80mm auto;
            margin: 5mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            width: 80mm;
            padding: 5mm;
          }
          .ticket-header {
            text-align: center;
            border-bottom: 1px dashed #333;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .ticket-header h1 {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .parking-name {
            font-weight: bold;
            font-size: 13px;
            margin-top: 8px;
          }
          .parking-address {
            font-size: 11px;
            color: #666;
          }
          .ticket-id {
            font-size: 10px;
            color: #666;
            margin-top: 5px;
          }
          .vehicle-section {
            text-align: center;
            background: #f5f5f5;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
          }
          .license-plate {
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 2px;
          }
          .vehicle-type {
            font-size: 11px;
            color: #666;
          }
          .plaza-info {
            font-size: 11px;
            margin-top: 5px;
          }
          .time-section {
            margin: 10px 0;
          }
          .time-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          .time-label {
            font-size: 10px;
            color: #666;
          }
          .duration-box {
            text-align: center;
            background: #e8f4e8;
            padding: 8px;
            border-radius: 4px;
            margin-top: 10px;
          }
          .duration-value {
            font-size: 16px;
            font-weight: bold;
          }
          .payment-section {
            border-top: 1px dashed #333;
            padding-top: 10px;
            margin-top: 10px;
          }
          .payment-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 11px;
          }
          .total-row {
            border-top: 1px solid #333;
            padding-top: 8px;
            margin-top: 8px;
            font-size: 14px;
            font-weight: bold;
          }
          .total-amount {
            font-size: 18px;
          }
          .footer {
            text-align: center;
            border-top: 1px dashed #333;
            padding-top: 10px;
            margin-top: 15px;
          }
          .thank-you {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .meta-info {
            font-size: 9px;
            color: #999;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="ticket-header">
          <h1>Ticket de Estacionamiento</h1>
          <div class="parking-name">${ticket.parkingName}</div>
          <div class="parking-address">${ticket.parkingAddress}</div>
          ${ticket.parkingPhone ? `<div class="parking-address">Tel: ${ticket.parkingPhone}</div>` : ''}
          <div class="ticket-id">Ticket: ${ticket.ticketId}</div>
        </div>
        
        <div class="vehicle-section">
          <div class="license-plate">${ticket.vehicleLicensePlate}</div>
          <div class="vehicle-type">${ticket.vehicleType}</div>
          ${ticket.plazaNumber ? `<div class="plaza-info">Plaza: ${ticket.plazaNumber}${ticket.zone ? ` - Zona ${ticket.zone}` : ''}</div>` : ''}
        </div>
        
        <div class="time-section">
          <div class="time-row">
            <span class="time-label">Entrada:</span>
            <span>${formatDate(ticket.entryTime)}</span>
          </div>
          <div class="time-row">
            <span class="time-label">Salida:</span>
            <span>${formatDate(ticket.exitTime)}</span>
          </div>
          <div class="duration-box">
            <div class="time-label">Duración</div>
            <div class="duration-value">${ticket.duration.formatted}</div>
          </div>
        </div>
        
        <div class="payment-section">
          <div class="payment-row">
            <span>Método:</span>
            <span>${getPaymentMethodLabel(ticket.payment.method)}</span>
          </div>
          <div class="payment-row">
            <span>Fecha pago:</span>
            <span>${formatDate(ticket.payment.date)}</span>
          </div>
          <div class="payment-row total-row">
            <span>Total:</span>
            <span class="total-amount">${formatCurrency(ticket.payment.amount)}</span>
          </div>
        </div>
        
        <div class="footer">
          <div class="thank-you">¡Gracias por su visita!</div>
          <div style="font-size: 10px; color: #666;">Conserve este ticket para su referencia</div>
          <div class="meta-info">
            Generado: ${formatDate(ticket.generatedAt)}<br>
            Operador: ${ticket.generatedBy}
          </div>
        </div>
      </body>
    </html>
  `;
}

