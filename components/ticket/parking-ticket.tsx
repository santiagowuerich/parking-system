'use client';

// components/ticket/parking-ticket.tsx
// Componente principal de ticket de estacionamiento

import { useRef, useCallback, useState } from 'react';
import { ParkingTicket as ParkingTicketType, TicketFormat } from '@/lib/types/ticket';
import { TicketHeader } from './ticket-header';
import { TicketBody } from './ticket-body';
import { TicketFooter } from './ticket-footer';
import { WhatsAppDialog } from './whatsapp-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Printer, Download, Mail, X, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sendTicketViaWhatsApp } from '@/lib/utils/ticket-utils';
import { toast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/utils/date-time';

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
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

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

    // Formatear fechas correctamente con zona horaria de Argentina
    const formattedEntryTime = formatDateTime(ticket.entryTime);
    const formattedExitTime = formatDateTime(ticket.exitTime);
    const formattedPaymentDate = formatDateTime(ticket.payment.date);
    const formattedGeneratedAt = formatDateTime(ticket.generatedAt);

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
              <span>${formattedEntryTime}</span>
            </div>
            <div class="time-row">
              <span class="time-label">Salida:</span>
              <span>${formattedExitTime}</span>
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
              <span>${formattedPaymentDate}</span>
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
              Generado: ${formattedGeneratedAt}<br>
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

  // Función para formatear número de teléfono al formato internacional
  const formatPhoneNumber = useCallback((phone: string): string => {
    // Remover espacios, guiones y paréntesis
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Asegurar formato internacional para Argentina
    let formattedPhone = cleaned;
    if (!formattedPhone.startsWith('+')) {
      // Si no tiene código de país, asumir Argentina (+54)
      if (formattedPhone.startsWith('54')) {
        formattedPhone = '+' + formattedPhone;
      } else if (formattedPhone.startsWith('9')) {
        // Si empieza con 9, agregar código de país
        formattedPhone = '+54' + formattedPhone;
      } else {
        // Si es número local, agregar código de país y 9
        formattedPhone = '+549' + formattedPhone;
      }
    }
    
    return formattedPhone;
  }, []);

  // Función para validar número de teléfono
  const isValidPhoneNumber = useCallback((phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(\+?54)?9?\d{10}$/;
    return phoneRegex.test(cleaned) || /^\d{10,15}$/.test(cleaned);
  }, []);

  // Función para enviar el ticket por WhatsApp (función interna reutilizable)
  const sendTicketToWhatsApp = useCallback(async (phoneNumber: string, shouldCloseDialog = false) => {
    setWhatsappLoading(true);
    try {
      // Pasar el elemento del ticket para mejor calidad del PDF
      const ticketElement = ticketRef.current?.querySelector('.parking-ticket') as HTMLElement;
      await sendTicketViaWhatsApp(phoneNumber, ticket, ticketElement);
      
      if (shouldCloseDialog) {
        setShowWhatsAppDialog(false);
      }
      
      // Mostrar mensaje informativo
      toast({
        title: 'WhatsApp abierto',
        description: 'El PDF se descargó automáticamente. Adjútelo al chat desde su carpeta de descargas.',
      });
    } catch (error) {
      console.error('Error enviando por WhatsApp:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el ticket. Por favor, intente nuevamente.',
      });
      throw error; // Re-lanzar para que el diálogo lo maneje si está abierto
    } finally {
      setWhatsappLoading(false);
    }
  }, [ticket]);

  // Función para enviar por WhatsApp
  const handleWhatsApp = useCallback(() => {
    // Verificar si el ticket tiene teléfono del conductor disponible
    const conductorPhone = ticket.conductor?.phone;
    
    if (conductorPhone && isValidPhoneNumber(conductorPhone)) {
      // Si hay teléfono disponible y es válido, usarlo directamente sin mostrar diálogo
      const formattedPhone = formatPhoneNumber(conductorPhone);
      sendTicketToWhatsApp(formattedPhone, false);
    } else {
      // Si no hay teléfono o no es válido, mostrar el diálogo para ingresarlo
      setShowWhatsAppDialog(true);
    }
  }, [ticket, formatPhoneNumber, isValidPhoneNumber, sendTicketToWhatsApp]);

  // Función para enviar el ticket por WhatsApp (desde el diálogo)
  const handleSendWhatsApp = useCallback(async (phoneNumber: string) => {
    await sendTicketToWhatsApp(phoneNumber, true);
  }, [sendTicketToWhatsApp]);

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
          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsApp}
            className="gap-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
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
          {/* Botón Cerrar removido según requerimiento del usuario */}
          {/* Anteriormente: {onClose && !ticket?.isSubscription && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cerrar
            </Button>
          )} */}
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

      {/* Diálogo de WhatsApp */}
      <WhatsAppDialog
        isOpen={showWhatsAppDialog}
        onClose={() => setShowWhatsAppDialog(false)}
        onSend={handleSendWhatsApp}
        loading={whatsappLoading}
      />

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

