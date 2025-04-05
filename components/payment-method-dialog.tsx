import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, Banknote, QrCode, Building2 } from "lucide-react";

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seleccionar método de pago</DialogTitle>
          <DialogDescription>
            Total a pagar: ${fee.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onSelectMethod("efectivo")}
          >
            <Banknote className="mr-2 h-4 w-4" />
            Efectivo
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onSelectMethod("transferencia")}
          >
            <Building2 className="mr-2 h-4 w-4" />
            Transferencia Bancaria
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onSelectMethod("mercadopago")}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Mercado Pago
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onSelectMethod("qr")}
          >
            <QrCode className="mr-2 h-4 w-4" />
            Código QR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 