"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/payment-utils"
import { Copy, Check, Banknote, Clock, AlertCircle } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface TransferInfoDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirmTransfer: () => void
  paymentData: {
    amount: number
    vehicleLicensePlate: string
    paymentId: string
    duration: string
  }
  transferConfig: {
    cbu: string
    alias: string
    accountHolder: string
    bank: string
  }
  loading?: boolean
}

export default function TransferInfoDialog({
  isOpen,
  onClose,
  onConfirmTransfer,
  paymentData,
  transferConfig,
  loading = false
}: TransferInfoDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast({
        title: "Copiado",
        description: `${field} copiado al portapapeles`
      })

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo copiar al portapapeles"
      })
    }
  }

  const CopyButton = ({ text, field, label }: { text: string, field: string, label: string }) => (
    <button
      onClick={() => copyToClipboard(text, label)}
      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
      title={`Copiar ${label}`}
    >
      {copiedField === label ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4 text-gray-500" />
      )}
    </button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] p-0 rounded-2xl shadow-xl border-0 bg-white flex flex-col">
        {/* Header fijo */}
        <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Pago por transferencia
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-1">
            Transferí {formatCurrency(paymentData.amount)} a la cuenta del estacionamiento
          </DialogDescription>
        </div>

        {/* Contenido con scroll */}
        <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
          {/* Resumen del pago */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-blue-700">Monto a transferir</span>
                <span className="text-lg font-bold text-blue-900">
                  {formatCurrency(paymentData.amount)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-blue-600">
                <div>Vehículo: {paymentData.vehicleLicensePlate}</div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {paymentData.duration}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información bancaria */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-700 uppercase">
              Datos para la transferencia
            </h3>

            {/* CBU */}
            <Card className="border border-gray-200">
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 uppercase font-medium">CBU</div>
                    <div className="font-mono text-sm font-medium text-gray-900">
                      {transferConfig.cbu}
                    </div>
                  </div>
                  <CopyButton text={transferConfig.cbu} field="cbu" label="CBU" />
                </div>
              </CardContent>
            </Card>

            {/* Alias */}
            <Card className="border border-gray-200">
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 uppercase font-medium">Alias</div>
                    <div className="text-sm font-medium text-gray-900">
                      {transferConfig.alias}
                    </div>
                  </div>
                  <CopyButton text={transferConfig.alias} field="alias" label="Alias" />
                </div>
              </CardContent>
            </Card>

            {/* Titular */}
            <Card className="border border-gray-200">
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 uppercase font-medium">Titular</div>
                    <div className="text-sm font-medium text-gray-900">
                      {transferConfig.accountHolder}
                    </div>
                  </div>
                  <CopyButton text={transferConfig.accountHolder} field="titular" label="Titular" />
                </div>
              </CardContent>
            </Card>

            {/* Banco */}
            <Card className="border border-gray-200">
              <CardContent className="p-2">
                <div className="text-xs text-gray-500 uppercase font-medium">Banco</div>
                <div className="text-sm font-medium text-gray-900">
                  {transferConfig.bank}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Instrucciones */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <div className="font-medium mb-1">Instrucciones importantes:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    <li>Conservá el comprobante de transferencia</li>
                    <li>El pago será validado manualmente por el operador</li>
                    <li>Podés retirar el vehículo una vez confirmado el pago</li>
                    <li>En caso de dudas, contactá al personal del estacionamiento</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ID de referencia */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 uppercase font-medium">ID de pago</div>
                  <div className="font-mono text-xs text-gray-700">
                    {paymentData.paymentId}
                  </div>
                </div>
                <CopyButton text={paymentData.paymentId} field="paymentId" label="ID de pago" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botones de acción fijos */}
        <div className="px-6 py-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-10 rounded-xl border-gray-200 hover:bg-gray-50 text-sm"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirmTransfer}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm transition-all duration-200 text-sm"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Confirmando...
              </>
            ) : (
              '✅ Confirmar recepción'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}