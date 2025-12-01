'use client';

// components/ticket/ticket-dialog.tsx
// Diálogo modal para mostrar y manejar tickets de estacionamiento

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ParkingTicket } from './parking-ticket';
import { ParkingTicket as ParkingTicketType } from '@/lib/types/ticket';
import { Loader2 } from 'lucide-react';

interface TicketDialogProps {
  ticket: ParkingTicketType | null;
  isOpen: boolean;
  onClose: () => void;
  onPrint?: () => void;
  onDownload?: () => void;
  onEmail?: () => void;
  loading?: boolean;
  title?: string;
  description?: string;
}

export function TicketDialog({
  ticket,
  isOpen,
  onClose,
  onPrint,
  onDownload,
  onEmail,
  loading = false,
  title = 'Ticket de Estacionamiento',
  description,
}: TicketDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generando ticket...</p>
          </div>
        ) : ticket ? (
          <ParkingTicket
            ticket={ticket}
            format="screen"
            showActions={true}
            onPrint={onPrint}
            onDownload={onDownload}
            onEmail={onEmail}
            onClose={onClose}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-sm text-muted-foreground">
              No hay ticket disponible
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TicketDialog;

