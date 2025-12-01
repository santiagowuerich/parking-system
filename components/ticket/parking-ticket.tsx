'use client';

// components/ticket/parking-ticket.tsx
// Componente principal de ticket de estacionamiento

import { useRef, useCallback } from 'react';
import { ParkingTicket as ParkingTicketType, TicketFormat } from '@/lib/types/ticket';
import { TicketHeader } from './ticket-header';
import { TicketBody } from './ticket-body';
import { TicketFooter } from './ticket-footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Printer, Download, Mail, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParkingTicketProps {
  ticket: ParkingTicketType;
  format?: 'print' | 'screen';
  showActions?: boolean;
  onPrint?: () => void;
  onDownload?: () => void;
  onEmail?: () => void;
  onClose?: () => void;
  className?: string;
}

export function ParkingTicket({
  ticket,
  format = 'screen',
  showActions = true,
  onPrint,
  onDownload,
  onEmail,
  onClose,
  className,
}: ParkingTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

  // Función para imprimir el ticket
  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint();
      return;
    }

    // Impresión por defecto usando window.print()
    const printContent = ticketRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita las ventanas emergentes para imprimir');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket ${ticket.ticketId}</title>
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
              <span>${new Date(ticket.entryTime).toLocaleString('es-AR')}</span>
            </div>
            <div class="time-row">
              <span class="time-label">Salida:</span>
              <span>${new Date(ticket.exitTime).toLocaleString('es-AR')}</span>
            </div>
            <div class="duration-box">
              <div class="time-label">Duración</div>
              <div class="duration-value">${ticket.duration.formatted}</div>
            </div>
          </div>
          
          <div class="payment-section">
            <div class="payment-row">
              <span>Método:</span>
              <span>${ticket.payment.method}</span>
            </div>
            <div class="payment-row">
              <span>Fecha pago:</span>
              <span>${new Date(ticket.payment.date).toLocaleString('es-AR')}</span>
            </div>
            <div class="payment-row total-row">
              <span>Total:</span>
              <span class="total-amount">$${ticket.payment.amount.toLocaleString('es-AR')}</span>
            </div>
          </div>
          
          <div class="footer">
            <div class="thank-you">¡Gracias por su visita!</div>
            <div style="font-size: 10px; color: #666;">Conserve este ticket para su referencia</div>
            <div class="meta-info">
              Generado: ${new Date(ticket.generatedAt).toLocaleString('es-AR')}<br>
              Operador: ${ticket.generatedBy}
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Esperar a que se cargue el contenido antes de imprimir
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }, [ticket, onPrint]);

  const isPrintFormat = format === 'print';

  return (
    <div className={cn('parking-ticket-container', className)}>
      {/* Acciones del ticket */}
      {showActions && !isPrintFormat && (
        <div className="flex justify-end gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          )}
          {onEmail && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEmail}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Enviar
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cerrar
            </Button>
          )}
        </div>
      )}

      {/* Contenido del ticket */}
      <Card
        ref={ticketRef}
        className={cn(
          'parking-ticket p-4',
          isPrintFormat ? 'w-[80mm] mx-auto shadow-none border-dashed' : 'max-w-sm mx-auto'
        )}
      >
        <TicketHeader ticket={ticket} showLogo={!isPrintFormat} />
        <TicketBody ticket={ticket} showDetails={ticket.format !== 'reduced'} />
        <TicketFooter ticket={ticket} showNotes={ticket.format !== 'reduced'} />
      </Card>

      {/* Estilos para impresión */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .parking-ticket-container,
          .parking-ticket-container * {
            visibility: visible;
          }
          .parking-ticket-container {
            position: absolute;
            left: 0;
            top: 0;
          }
          .parking-ticket-container button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default ParkingTicket;

