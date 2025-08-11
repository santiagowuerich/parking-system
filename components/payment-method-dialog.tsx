import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: string) => void;
  fee: number;
  onChangeCalcParams?: (params: { modalidad: 'Hora'|'Diaria'|'Mensual'; pla_tipo: 'Normal'|'VIP'|'Reservada' }) => void;
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  onSelectMethod,
  fee,
  onChangeCalcParams,
}: PaymentMethodDialogProps) {
  const [modalidad, setModalidad] = useState<'Hora'|'Diaria'|'Mensual'>('Hora')
  const [plaTipo, setPlaTipo] = useState<'Normal'|'VIP'|'Reservada'>('Normal')

  useEffect(()=>{
    onChangeCalcParams?.({ modalidad, pla_tipo: plaTipo })
  }, [modalidad, plaTipo])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seleccionar Método de Pago</DialogTitle>
          <DialogDescription>
            Monto a pagar: {formatCurrency(fee)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="mb-1 block">Modalidad</Label>
            <Select value={modalidad} onValueChange={(v:any)=> setModalidad(v)}>
              <SelectTrigger><SelectValue placeholder="Modalidad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Hora">Hora</SelectItem>
                <SelectItem value="Diaria">Diaria</SelectItem>
                <SelectItem value="Mensual">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Tipo de Plaza</Label>
            <Select value={plaTipo} onValueChange={(v:any)=> setPlaTipo(v)}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="Reservada">Reservada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={() => onSelectMethod("efectivo")}
            className="h-24 flex items-center justify-center"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-2">💵</span>
              <span>Efectivo</span>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={() => onSelectMethod("transferencia")}
            className="h-24 flex items-center justify-center"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-2">🏦</span>
              <span>Transferencia</span>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={() => onSelectMethod("mercadopago")}
            className="h-24 flex items-center justify-center"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-2">💳</span>
              <span>Mercado Pago</span>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={() => onSelectMethod("qr")}
            className="h-24 flex items-center justify-center"
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