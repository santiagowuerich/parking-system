// lib/hooks/use-ticket.ts
// Hook para la generación y gestión de tickets de estacionamiento

import { useState, useCallback } from 'react';
import {
  ParkingTicket,
  GenerateTicketResponse,
  TicketFormat,
} from '@/lib/types/ticket';

interface UseTicketOptions {
  autoShowOnGenerate?: boolean;
  defaultFormat?: TicketFormat;
}

interface UseTicketReturn {
  ticket: ParkingTicket | null;
  isLoading: boolean;
  error: string | null;
  isDialogOpen: boolean;
  generateTicket: (
    occupationId: number,
    generatedBy: string,
    paymentId?: string | number,
    format?: TicketFormat,
    notes?: string,
    paymentMethod?: 'efectivo' | 'transferencia' | 'qr' | 'link_pago'
  ) => Promise<ParkingTicket | null>;
  generateSubscriptionExtensionTicket: (
    paymentId: string | number,
    abo_nro: number,
    est_id: number,
    veh_patente: string,
    generatedBy: string,
    paymentMethod?: 'efectivo' | 'transferencia' | 'qr' | 'link_pago',
    format?: TicketFormat,
    notes?: string
  ) => Promise<ParkingTicket | null>;
  getTicket: (ticketId: string) => Promise<ParkingTicket | null>;
  getTicketsByOccupation: (occupationId: number) => Promise<ParkingTicket[]>;
  markAsPrinted: (ticketId: string) => Promise<boolean>;
  markAsSent: (ticketId: string) => Promise<boolean>;
  openDialog: () => void;
  closeDialog: () => void;
  setTicket: (ticket: ParkingTicket | null) => void;
  clearError: () => void;
}

export function useTicket(options: UseTicketOptions = {}): UseTicketReturn {
  const { autoShowOnGenerate = true, defaultFormat = 'reduced' } = options;

  const [ticket, setTicket] = useState<ParkingTicket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  /**
   * Genera un nuevo ticket de estacionamiento
   */
  const generateTicket = useCallback(
    async (
      occupationId: number,
      generatedBy: string,
      paymentId?: string | number,
      format?: TicketFormat,
      notes?: string,
      paymentMethod?: 'efectivo' | 'transferencia' | 'qr' | 'link_pago'
    ): Promise<ParkingTicket | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/tickets/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            occupationId,
            generatedBy,
            paymentId: paymentId || undefined,
            format: format || defaultFormat,
            notes,
            paymentMethod,
          }),
        });

        const data: GenerateTicketResponse = await response.json();

        if (!data.success || !data.ticket) {
          setError(data.error || 'Error al generar el ticket');
          return null;
        }

        setTicket(data.ticket);

        if (autoShowOnGenerate) {
          setIsDialogOpen(true);
        }

        return data.ticket;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al generar el ticket';
        setError(message);
        console.error('Error generando ticket:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [autoShowOnGenerate, defaultFormat]
  );

  /**
   * Obtiene un ticket existente por ID
   */
  const getTicket = useCallback(
    async (ticketId: string): Promise<ParkingTicket | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/tickets/generate?ticketId=${encodeURIComponent(ticketId)}`
        );
        const data = await response.json();

        if (!data.success || !data.ticket) {
          setError(data.error || 'Ticket no encontrado');
          return null;
        }

        setTicket(data.ticket);
        return data.ticket;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al obtener el ticket';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Obtiene todos los tickets de una ocupación
   */
  const getTicketsByOccupation = useCallback(
    async (occupationId: number): Promise<ParkingTicket[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/tickets/generate?occupationId=${occupationId}`
        );
        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Error al obtener tickets');
          return [];
        }

        return data.tickets || [];
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al obtener tickets';
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Marca un ticket como impreso
   */
  const markAsPrinted = useCallback(
    async (ticketId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/tickets/${ticketId}/print`, {
          method: 'POST',
        });

        const data = await response.json();
        return data.success;
      } catch (err) {
        console.error('Error marcando ticket como impreso:', err);
        return false;
      }
    },
    []
  );

  /**
   * Marca un ticket como enviado
   */
  const markAsSent = useCallback(
    async (ticketId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/tickets/${ticketId}/send`, {
          method: 'POST',
        });

        const data = await response.json();
        return data.success;
      } catch (err) {
        console.error('Error marcando ticket como enviado:', err);
        return false;
      }
    },
    []
  );

  /**
   * Genera un ticket de extensión de abono
   */
  const generateSubscriptionExtensionTicket = useCallback(
    async (
      paymentId: string | number,
      abo_nro: number,
      est_id: number,
      veh_patente: string,
      generatedBy: string,
      paymentMethod?: 'efectivo' | 'transferencia' | 'qr' | 'link_pago',
      format?: TicketFormat,
      notes?: string
    ): Promise<ParkingTicket | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/tickets/generate-subscription-extension', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentId,
            abo_nro,
            est_id,
            veh_patente,
            generatedBy,
            paymentMethod,
            format: format || defaultFormat,
            notes,
          }),
        });

        const data: GenerateTicketResponse = await response.json();

        if (!data.success || !data.ticket) {
          setError(data.error || 'Error al generar el ticket');
          return null;
        }

        setTicket(data.ticket);

        if (autoShowOnGenerate) {
          setIsDialogOpen(true);
        }

        return data.ticket;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al generar el ticket';
        setError(message);
        console.error('Error generando ticket de extensión:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [autoShowOnGenerate, defaultFormat]
  );

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    ticket,
    isLoading,
    error,
    isDialogOpen,
    generateTicket,
    generateSubscriptionExtensionTicket,
    getTicket,
    getTicketsByOccupation,
    markAsPrinted,
    markAsSent,
    openDialog,
    closeDialog,
    setTicket,
    clearError,
  };
}

export default useTicket;

