'use client';

// components/ticket/ticket-header.tsx
// Cabecera del ticket de estacionamiento

import { ParkingTicket } from '@/lib/types/ticket';
import { Car } from 'lucide-react';

interface TicketHeaderProps {
  ticket: ParkingTicket;
  showLogo?: boolean;
}

export function TicketHeader({ ticket, showLogo = true }: TicketHeaderProps) {
  return (
    <div className="ticket-header text-center border-b border-dashed border-gray-400 pb-3 mb-3">
      {showLogo && (
        <div className="flex justify-center mb-2">
          <div className="bg-primary/10 p-2 rounded-full">
            <Car className="h-6 w-6 text-primary" />
          </div>
        </div>
      )}
      
      <h1 className="text-lg font-bold uppercase tracking-wide">
        Ticket de Estacionamiento
      </h1>
      
      <div className="mt-2">
        <p className="font-semibold text-base">{ticket.parkingName}</p>
        <p className="text-sm text-muted-foreground">{ticket.parkingAddress}</p>
        {ticket.parkingPhone && (
          <p className="text-xs text-muted-foreground">Tel: {ticket.parkingPhone}</p>
        )}
      </div>
      
      <div className="mt-2 text-xs text-muted-foreground">
        Ticket: <span className="font-mono font-semibold">{ticket.ticketId}</span>
      </div>
    </div>
  );
}

export default TicketHeader;

