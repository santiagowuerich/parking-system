import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, Banknote, Link, QrCode } from "lucide-react";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: string) => void;
  fee: number;
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  onSelectMethod,
  fee,
}: PaymentMethodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>¿Cómo deseas realizar el pago?</DialogTitle>
          <DialogDescription>
            Selecciona el método de pago para completar la operación. Monto a pagar: ${fee}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => onSelectMethod("efectivo")}
          >
            <Banknote className="h-6 w-6" />
            <span>Efectivo</span>
            <span className="text-xs text-muted-foreground">Pago en efectivo</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => onSelectMethod("transferencia")}
          >
            <CreditCard className="h-6 w-6" />
            <span>Transferencia</span>
            <span className="text-xs text-muted-foreground">Transferencia bancaria</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => onSelectMethod("link")}
          >
            <Link className="h-6 w-6" />
            <span>Link de Pago</span>
            <span className="text-xs text-muted-foreground">Pago online</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => onSelectMethod("qr")}
          >
            <QrCode className="h-6 w-6" />
            <span>QR</span>
            <span className="text-xs text-muted-foreground">Escanear código QR</span>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 