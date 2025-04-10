import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PaymentConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (success: boolean) => void;
  paymentMethod?: string;
}

export function PaymentConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  paymentMethod,
}: PaymentConfirmationDialogProps) {

  const confirmationMessage = 
    paymentMethod === 'Transferencia' ? '¿Confirmas que la transferencia fue recibida?' :
    paymentMethod?.toLowerCase().includes('qr') ? '¿El cliente logró realizar el pago con el código QR?' :
    paymentMethod === 'Efectivo' ? '¿Confirmas que el pago en efectivo fue recibido?' :
    '¿Confirmas que el pago fue exitoso?';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmación de Pago</DialogTitle>
          <DialogDescription>
            {confirmationMessage}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-4 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              onConfirm(false);
              onOpenChange(false);
            }}
          >
            No, elegir otro método
          </Button>
          <Button
            onClick={() => {
              onConfirm(true);
              onOpenChange(false);
            }}
          >
            Sí, pago exitoso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 