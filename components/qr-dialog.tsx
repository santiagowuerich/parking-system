import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Button } from "./ui/button";

interface QRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode: string;
  fee: number;
  onConfirmPayment: (success: boolean) => void;
}

export function QRDialog({
  open,
  onOpenChange,
  qrCode,
  fee,
  onConfirmPayment,
}: QRDialogProps) {
  const handleClose = () => {
    // Al cerrar con la X o haciendo clic fuera, preguntar si el pago fue exitoso
    const confirmed = window.confirm("¿El pago fue exitoso?");
    onConfirmPayment(confirmed);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Al hacer clic en Cancelar, no preguntar y simplemente indicar que no fue exitoso
    onConfirmPayment(false);
    onOpenChange(false);
  };

  const handleConfirm = () => {
    // Al hacer clic en Confirmar, indicar que fue exitoso
    onConfirmPayment(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanea el código QR para pagar</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4">
          <div className="text-2xl font-semibold text-blue-600">
            Monto a pagar: {formatCurrency(fee)}
          </div>
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
              alt="Código QR"
              className="w-64 h-64"
            />
          </div>
          <p className="text-center text-gray-600">
            Abre Mercado Pago en tu celular y escanea este código
          </p>
          <div className="flex justify-end space-x-2 w-full">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>
              Confirmar Pago
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 