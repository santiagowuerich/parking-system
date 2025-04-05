import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

interface QRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode: string;
  fee: number;
}

export function QRDialog({
  open,
  onOpenChange,
  qrCode,
  fee,
}: QRDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
} 