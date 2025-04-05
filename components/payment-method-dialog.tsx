import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seleccionar Método de Pago</DialogTitle>
          <DialogDescription>
            Monto a pagar: {formatCurrency(fee)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={() => onSelectMethod("efectivo")}
            className="h-24"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-2">💵</span>
              <span>Efectivo</span>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={() => onSelectMethod("transferencia")}
            className="h-24"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-2">🏦</span>
              <span>Transferencia</span>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={() => onSelectMethod("mercadopago")}
            className="h-24"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-2">💳</span>
              <span>Mercado Pago</span>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={() => onSelectMethod("qr")}
            className="h-24"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-2">📱</span>
              <span>Código QR</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 