'use client';

// components/ticket/ticket-footer.tsx
// Pie del ticket de estacionamiento

import { ParkingTicket } from '@/lib/types/ticket';
import { formatDateTime } from '@/lib/utils/date-time';

interface TicketFooterProps {
  ticket: ParkingTicket;
  showNotes?: boolean;
}

export function TicketFooter({ ticket, showNotes = true }: TicketFooterProps) {

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
        {!ticket.isSubscription && (
          <p>Ticket generado: {formatDateTime(ticket.generatedAt)}</p>
        )}
        <p>Operador: {ticket.generatedBy}</p>
        {ticket.printedAt && (
          <p>Impreso: {formatDateTime(ticket.printedAt)}</p>
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

