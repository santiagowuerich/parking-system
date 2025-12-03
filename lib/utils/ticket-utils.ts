// lib/utils/ticket-utils.ts
// Utilidades para generar PDFs y links de WhatsApp para tickets

import { ParkingTicket } from '@/lib/types/ticket';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDateTime } from '@/lib/utils/date-time';

/**
 * Genera un PDF del ticket como Blob usando jsPDF y html2canvas
 * @param ticketElement - Elemento HTML del ticket ya renderizado (opcional)
 * @param ticket - Datos del ticket (usado si no se proporciona elemento)
 */
export async function generateTicketPDFBlob(
  ticket?: ParkingTicket,
  ticketElement?: HTMLElement | null
): Promise<Blob> {
  let elementToCapture: HTMLElement;

  // Si se proporciona el elemento del ticket, usarlo directamente
  if (ticketElement) {
    elementToCapture = ticketElement;
  } else if (ticket) {
    // Si no, crear elemento temporal desde HTML
    const htmlContent = generateTicketHTML(ticket);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '80mm';
    tempDiv.style.padding = '5mm';
    tempDiv.style.backgroundColor = 'white';
    document.body.appendChild(tempDiv);
    elementToCapture = tempDiv;
  } else {
    throw new Error('Se requiere el ticket o el elemento del ticket');
  }

  try {
    // Convertir elemento a canvas
    const canvas = await html2canvas(elementToCapture, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: elementToCapture.scrollWidth || 302, // 80mm en píxeles a 96 DPI
      height: elementToCapture.scrollHeight,
    });

    // Crear PDF con formato A4 estándar
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Obtener dimensiones de la página
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calcular dimensiones de la imagen para ticket de 80mm de ancho
    const ticketWidthMm = 80; // Ancho del ticket en mm
    const ticketHeightMm = (canvas.height * ticketWidthMm) / canvas.width; // Altura proporcional
    
    // Centrar el ticket en la página (si es más pequeño que A4)
    const xOffset = (pdfWidth - ticketWidthMm) / 2;
    const yOffset = 5; // Margen superior
    
    // Convertir canvas a imagen
    const imgData = canvas.toDataURL('image/png', 0.95);
    
    // Si el ticket cabe en una página
    if (ticketHeightMm + yOffset <= pdfHeight - 5) {
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, ticketWidthMm, ticketHeightMm);
    } else {
      // Si necesita múltiples páginas, dividir la imagen
      let heightLeft = ticketHeightMm;
      let currentY = yOffset;
      let sourceY = 0;
      let pageNumber = 0;
      
      while (heightLeft > 0 && pageNumber < 10) { // Límite de seguridad
        const availableHeight = pdfHeight - currentY - 5; // Altura disponible en la página
        const heightToAdd = Math.min(heightLeft, availableHeight);
        
        // Calcular qué porción de la imagen mostrar
        const sourceHeightPx = (heightToAdd / ticketHeightMm) * canvas.height;
        
        // Crear un canvas temporal con la porción de la imagen
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeightPx;
        const ctx = tempCanvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeightPx,
            0, 0, canvas.width, sourceHeightPx
          );
          
          const pageImgData = tempCanvas.toDataURL('image/png', 0.95);
          pdf.addImage(pageImgData, 'PNG', xOffset, currentY, ticketWidthMm, heightToAdd);
          
          sourceY += sourceHeightPx;
          heightLeft -= heightToAdd;
          
          if (heightLeft > 0) {
            pdf.addPage();
            currentY = 5; // Resetear posición Y para nueva página
            pageNumber++;
          }
        } else {
          break; // Si no se puede obtener el contexto, salir
        }
      }
    }

    // Generar blob del PDF
    const pdfBlob = pdf.output('blob');

    // Limpiar elemento temporal solo si lo creamos nosotros
    if (!ticketElement && elementToCapture.parentNode) {
      document.body.removeChild(elementToCapture);
    }

    return pdfBlob;
  } catch (error) {
    // Limpiar en caso de error
    if (!ticketElement && elementToCapture.parentNode) {
      document.body.removeChild(elementToCapture);
    }
    throw error;
  }
}

/**
 * Genera un PDF del ticket usando window.print()
 * Retorna una promesa que se resuelve cuando se abre la ventana de impresión
 */
export async function generateTicketPDF(ticket: ParkingTicket): Promise<void> {
  // Crear HTML del ticket para PDF
  const htmlContent = generateTicketHTML(ticket);

  // Crear ventana de impresión
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('No se pudo abrir la ventana de impresión. Por favor, permita las ventanas emergentes.');
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Esperar a que se cargue el contenido antes de imprimir
  await new Promise((resolve) => setTimeout(resolve, 250));
  
  printWindow.print();
}

/**
 * Genera el HTML del ticket para PDF
 */
function generateTicketHTML(ticket: ParkingTicket): string {
  // Usar formatDateTime para manejar correctamente la zona horaria de Argentina
  const formatDate = (dateStr: string) => {
    return formatDateTime(dateStr);
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

/**
 * Crea un link de WhatsApp con el mensaje del ticket
 * Nota: WhatsApp Web no permite adjuntar archivos directamente desde un link
 * El usuario puede adjuntar el PDF manualmente después de abrir el chat
 */
export async function createWhatsAppLink(
  phoneNumber: string,
  ticket: ParkingTicket
): Promise<string> {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
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

  // Generar mensaje completo para WhatsApp
  const message = `🎫 *Ticket de Estacionamiento*\n\n` +
    `📋 *Ticket:* ${ticket.ticketId}\n` +
    `🚗 *Vehículo:* ${ticket.vehicleLicensePlate} (${ticket.vehicleType})\n` +
    `🏢 *Estacionamiento:* ${ticket.parkingName}\n` +
    `${ticket.parkingAddress ? `📍 ${ticket.parkingAddress}\n` : ''}` +
    `${ticket.plazaNumber ? `🅿️ Plaza: ${ticket.plazaNumber}${ticket.zone ? ` - Zona ${ticket.zone}` : ''}\n` : ''}` +
    `\n⏰ *Horarios:*\n` +
    `Entrada: ${formatDate(ticket.entryTime)}\n` +
    `Salida: ${formatDate(ticket.exitTime)}\n` +
    `Duración: ${ticket.duration.formatted}\n` +
    `\n💰 *Pago:*\n` +
    `Total: ${formatCurrency(ticket.payment.amount)}\n` +
    `Método: ${getPaymentMethodLabel(ticket.payment.method)}\n` +
    `Fecha: ${formatDate(ticket.payment.date)}\n` +
    `\n✅ ¡Gracias por su visita!`;

  // Codificar el mensaje para URL
  const encodedMessage = encodeURIComponent(message);

  // Crear link de WhatsApp
  // Formato: https://wa.me/[número]?text=[mensaje]
  const whatsappLink = `https://wa.me/${phoneNumber.replace(/\+/g, '')}?text=${encodedMessage}`;

  return whatsappLink;
}

/**
 * Envía el ticket por WhatsApp: abre WhatsApp con el mensaje y descarga el PDF
 * El empleado debe adjuntar el PDF manualmente desde su carpeta de descargas
 * @param phoneNumber - Número de teléfono en formato internacional
 * @param ticket - Datos del ticket
 * @param ticketElement - Elemento HTML del ticket ya renderizado (opcional, mejora la calidad del PDF)
 */
export async function sendTicketViaWhatsApp(
  phoneNumber: string,
  ticket: ParkingTicket,
  ticketElement?: HTMLElement | null
): Promise<void> {
  try {
    // Generar el PDF como blob
    const pdfBlob = await generateTicketPDFBlob(ticket, ticketElement);
    
    // Crear link de WhatsApp con mensaje
    const whatsappLink = await createWhatsAppLink(phoneNumber, ticket);
    
    // Crear URL temporal para el PDF
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Descargar el PDF automáticamente primero
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `ticket-${ticket.ticketId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Esperar un momento para que la descarga inicie, luego abrir WhatsApp
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Abrir WhatsApp en nueva ventana
    window.open(whatsappLink, '_blank');
    
    // Limpiar URL temporal después de un tiempo
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 10000);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error enviando ticket por WhatsApp:', error);
    throw error;
  }
}

/**
 * Crea el mensaje de texto para WhatsApp (sin el link)
 */
async function createWhatsAppMessage(ticket: ParkingTicket): Promise<string> {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
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

  return `🎫 *Ticket de Estacionamiento*\n\n` +
    `📋 *Ticket:* ${ticket.ticketId}\n` +
    `🚗 *Vehículo:* ${ticket.vehicleLicensePlate} (${ticket.vehicleType})\n` +
    `🏢 *Estacionamiento:* ${ticket.parkingName}\n` +
    `${ticket.parkingAddress ? `📍 ${ticket.parkingAddress}\n` : ''}` +
    `${ticket.plazaNumber ? `🅿️ Plaza: ${ticket.plazaNumber}${ticket.zone ? ` - Zona ${ticket.zone}` : ''}\n` : ''}` +
    `\n⏰ *Horarios:*\n` +
    `Entrada: ${formatDate(ticket.entryTime)}\n` +
    `Salida: ${formatDate(ticket.exitTime)}\n` +
    `Duración: ${ticket.duration.formatted}\n` +
    `\n💰 *Pago:*\n` +
    `Total: ${formatCurrency(ticket.payment.amount)}\n` +
    `Método: ${getPaymentMethodLabel(ticket.payment.method)}\n` +
    `Fecha: ${formatDate(ticket.payment.date)}\n` +
    `\n✅ ¡Gracias por su visita!`;
}

