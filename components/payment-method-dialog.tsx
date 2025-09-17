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
import { useAuth } from "@/lib/auth-context";
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: string) => void;
  fee: number;
  onChangeCalcParams?: (params: { modalidad: 'Hora' | 'Diaria' | 'Mensual'; pla_tipo: 'Normal' | 'VIP' | 'Reservada' }) => void;
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  onSelectMethod,
  fee,
  onChangeCalcParams,
}: PaymentMethodDialogProps) {
  const { estId } = useAuth()
  const { getEnabledMethods, loading: loadingMethods } = usePaymentMethods(estId)
  const [modalidad, setModalidad] = useState<'Hora' | 'Diaria' | 'Mensual'>('Hora')
  const plaTipo = 'Normal' // Fijo en Normal

  useEffect(() => {
    onChangeCalcParams?.({ modalidad, pla_tipo: plaTipo })
  }, [modalidad, plaTipo])

  // Los métodos se cargan automáticamente con el hook usePaymentMethods

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seleccionar Método de Pago</DialogTitle>
          <DialogDescription>
            Monto a pagar: {formatCurrency(fee)}
          </DialogDescription>
        </DialogHeader>
        <div className="mb-4">
          <Label className="mb-1 block">Modalidad</Label>
          <Select value={modalidad} onValueChange={(v: any) => setModalidad(v)}>
            <SelectTrigger><SelectValue placeholder="Modalidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Hora">Hora</SelectItem>
              <SelectItem value="Diaria">Diaria</SelectItem>
              <SelectItem value="Mensual">Mensual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loadingMethods ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {getEnabledMethods().includes('Efectivo') && (
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
            )}
            {getEnabledMethods().includes('Transferencia') && (
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
            )}
            {getEnabledMethods().includes('MercadoPago') && (
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
            )}
            {getEnabledMethods().includes('QR') && (
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
            )}
            {getEnabledMethods().includes('Link de Pago') && (
              <Button
                variant="outline"
                onClick={() => onSelectMethod("link_pago")}
                className="h-24 flex items-center justify-center"
              >
                <div className="flex flex-col items-center">
                  <span className="text-2xl mb-2">🔗</span>
                  <span>Link de Pago</span>
                </div>
              </Button>
            )}
            {getEnabledMethods().length === 0 && !loadingMethods && (
              <div className="col-span-2 text-center py-8">
                <div className="text-blue-600 mb-2">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-gray-600 mb-2">
                  No hay métodos de pago habilitados para este estacionamiento
                </p>
                <p className="text-sm text-gray-500 mb-2">
                  Intentando configurar automáticamente...
                </p>
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 