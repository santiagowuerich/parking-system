'use client';

// components/ticket/ticket-footer.tsx
// Pie del ticket de estacionamiento

import { ParkingTicket } from '@/lib/types/ticket';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TicketFooterProps {
  ticket: ParkingTicket;
  showNotes?: boolean;
}

export function TicketFooter({ ticket, showNotes = true }: TicketFooterProps) {
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="ticket-footer border-t border-dashed border-gray-400 pt-3 mt-4">
      {/* Mensaje de agradecimiento */}
      <div className="text-center mb-3">
        <p className="text-sm font-medium">¡Gracias por su visita!</p>
        <p className="text-xs text-muted-foreground">
          Conserve este ticket para su referencia
        </p>
      </div>

      {/* Notas adicionales */}
      {showNotes && ticket.notes && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-2 mb-3">
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            Nota: {ticket.notes}
          </p>
        </div>
      )}

      {/* Metadatos del ticket */}
      <div className="text-center text-[10px] text-muted-foreground space-y-0.5">
        <p>Ticket generado: {formatDate(ticket.generatedAt)}</p>
        <p>Operador: {ticket.generatedBy}</p>
        {ticket.printedAt && (
          <p>Impreso: {formatDate(ticket.printedAt)}</p>
        )}
      </div>

      {/* Línea decorativa final */}
      <div className="mt-3 text-center text-muted-foreground">
        <span className="text-xs">{'━'.repeat(20)}</span>
      </div>
    </div>
  );
}

export default TicketFooter;

