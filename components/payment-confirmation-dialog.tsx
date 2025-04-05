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
}

export function PaymentConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
}: PaymentConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmación de Pago</DialogTitle>
          <DialogDescription>
            ¿El cliente logró realizar el pago con el código QR?
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