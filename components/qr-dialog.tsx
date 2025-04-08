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
  qrCodeBase64?: string;
  fee: number;
  onConfirmPayment: (success: boolean) => void;
}

export function QRDialog({
  open,
  onOpenChange,
  qrCode,
  qrCodeBase64,
  fee,
  onConfirmPayment,
}: QRDialogProps) {
  const handleClose = () => {
    // Al cerrar con la X o haciendo clic fuera, simplemente cerrar el diálogo
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Al cancelar, simplemente cerrar el diálogo
    onOpenChange(false);
  };

  const handleConfirm = () => {
    // SOLO al confirmar explícitamente llamamos a onConfirmPayment
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
            {qrCodeBase64 ? (
              <img
                src={`data:image/png;base64,${qrCodeBase64}`}
                alt="Código QR"
                className="w-64 h-64"
              />
            ) : qrCode ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
                alt="Código QR"
                className="w-64 h-64"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-gray-400">
                Error al generar QR
              </div>
            )}
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