'use client';

// components/ticket/ticket-body.tsx
// Cuerpo del ticket de estacionamiento con información principal

import { ParkingTicket } from '@/lib/types/ticket';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Car, Clock, CreditCard, MapPin, Calendar } from 'lucide-react';

interface TicketBodyProps {
  ticket: ParkingTicket;
  showDetails?: boolean;
}

export function TicketBody({ ticket, showDetails = true }: TicketBodyProps) {
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: es });
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

  return (
    <div className="ticket-body space-y-4">
      {/* Información del Vehículo */}
      <div className="vehicle-info bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Car className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Vehículo</span>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold font-mono tracking-wider">
            {ticket.vehicleLicensePlate}
          </p>
          <p className="text-sm text-muted-foreground">{ticket.vehicleType}</p>
          {showDetails && ticket.vehicleBrand && (
            <p className="text-xs text-muted-foreground">
              {ticket.vehicleBrand} {ticket.vehicleModel} {ticket.vehicleColor}
            </p>
          )}
        </div>
        {ticket.plazaNumber && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">
              Plaza: <strong>{ticket.plazaNumber}</strong>
              {ticket.zone && ` - Zona ${ticket.zone}`}
            </span>
          </div>
        )}
      </div>

      {/* Información Temporal */}
      <div className="time-info">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Tiempo</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Entrada</p>
            <p className="font-medium">{formatDate(ticket.entryTime)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Salida</p>
            <p className="font-medium">{formatDate(ticket.exitTime)}</p>
          </div>
        </div>
        <div className="mt-2 text-center bg-primary/5 rounded py-2">
          <p className="text-xs text-muted-foreground">Duración</p>
          <p className="text-lg font-bold text-primary">{ticket.duration.formatted}</p>
        </div>
      </div>

      {/* Información de Pago */}
      <div className="payment-info border-t border-dashed border-gray-300 pt-3">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Pago</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Método:</span>
          <span className="text-sm font-medium">{getPaymentMethodLabel(ticket.payment.method)}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-sm text-muted-foreground">Fecha:</span>
          <span className="text-sm">{formatDate(ticket.payment.date)}</span>
        </div>
        <div className="flex justify-between items-center mt-3 pt-2 border-t">
          <span className="text-base font-semibold">Total:</span>
          <span className="text-xl font-bold text-primary">
            {formatCurrency(ticket.payment.amount)}
          </span>
        </div>
      </div>

      {/* Información de Reserva/Abono si aplica */}
      {(ticket.isReservation || ticket.isSubscription) && (
        <div className="special-info bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
          {ticket.isReservation && (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              <Calendar className="h-3 w-3 inline mr-1" />
              Reserva: <strong>{ticket.reservationCode}</strong>
            </p>
          )}
          {ticket.isSubscription && (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Abono #{ticket.subscriptionNumber}
            </p>
          )}
        </div>
      )}

      {/* Conductor si está disponible */}
      {showDetails && ticket.conductor && (
        <div className="conductor-info text-xs text-muted-foreground border-t border-dashed pt-2">
          <p>Cliente: {ticket.conductor.name}</p>
          {ticket.conductor.phone && <p>Tel: {ticket.conductor.phone}</p>}
        </div>
      )}
    </div>
  );
}

export default TicketBody;

