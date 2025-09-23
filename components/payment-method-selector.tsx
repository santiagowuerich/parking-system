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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PaymentMethod, PaymentMethodOption, PaymentData } from "@/lib/types/payment"
import { getAvailablePaymentMethods, formatCurrency, getPaymentMethodColors } from "@/lib/utils/payment-utils"
import { PAYMENT_METHOD_ICONS } from "@/lib/constants/payment-methods"
import { Clock, CreditCard, Banknote, Link as LinkIcon, Smartphone } from "lucide-react"

interface PaymentMethodSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectMethod: (method: PaymentMethod) => void
  paymentData: PaymentData | null
  loading?: boolean
  paymentSettings?: any
}

export default function PaymentMethodSelector({
  isOpen,
  onClose,
  onSelectMethod,
  paymentData,
  loading = false,
  paymentSettings
}: PaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)

  if (!paymentData) return null

  const availableMethods = getAvailablePaymentMethods(paymentSettings)

  // Debug para ver qué métodos están disponibles
  console.log('🎯 PaymentMethodSelector - métodos disponibles:', {
    availableMethods: availableMethods.map(m => ({ id: m.id, name: m.name })),
    paymentSettings
  })

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method)
  }

  const handleConfirm = () => {
    if (selectedMethod) {
      onSelectMethod(selectedMethod)
    }
  }

  const formatDuration = (durationMs: number): string => {
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const getMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'efectivo':
        return <Banknote className="h-6 w-6" />
      case 'transferencia':
        return <CreditCard className="h-6 w-6" />
      case 'link_pago':
        return <LinkIcon className="h-6 w-6" />
      case 'qr':
        return <Smartphone className="h-6 w-6" />
      default:
        return <CreditCard className="h-6 w-6" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-0 rounded-2xl shadow-xl border-0 bg-white">
        {/* Header - Estilo similar al modal de la imagen */}
        <div className="px-6 py-4">
          <DialogTitle className="text-lg font-semibold text-gray-900 mb-1">
            Egreso
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {paymentData.zone && paymentData.plazaNumber ? (
              `Plaza zona ${paymentData.zone} • ${paymentData.vehicleLicensePlate}`
            ) : (
              `Plaza zona Zona General • ${paymentData.vehicleLicensePlate}`
            )}
          </DialogDescription>
        </div>

        <div className="px-6 space-y-4">
          {/* Información del egreso - campos tipo input como en la imagen */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Patente</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 font-medium text-sm">
                {paymentData.vehicleLicensePlate}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tiempo estacionado (auto)</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 text-sm">
                {formatDuration(paymentData.duration)}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tarifa vigente (auto)</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 text-sm">
                {formatCurrency(paymentData.calculatedFee || paymentData.amount)} por hora
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Total a cobrar (auto)</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 font-bold text-base">
                {formatCurrency(paymentData.amount)}
              </div>
            </div>
          </div>

          {/* Métodos de pago - Grid 2x2 */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 block">Método de pago</label>

            <div className="grid grid-cols-2 gap-3">
              {availableMethods.map((method) => {
                const colors = getPaymentMethodColors(method.id)

                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      setSelectedMethod(method.id)
                      handleConfirm()
                    }}
                    disabled={loading}
                    className={`
                      p-3 rounded-xl border transition-all duration-200 text-left
                      ${colors.button} text-white hover:opacity-90 disabled:opacity-50
                      min-h-[80px] flex flex-col justify-center
                    `}
                  >
                    <div className="flex flex-col items-center gap-1 text-center">
                      <div className="text-xl mb-1">
                        {method.icon}
                      </div>
                      <div className="font-medium text-sm">
                        {method.name}
                      </div>
                      <div className="text-xs opacity-90 leading-tight">
                        {method.description}
                      </div>
                      {loading && selectedMethod === method.id && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mt-1"></div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Botón cancelar */}
        <div className="px-6 pb-6 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full h-10 rounded-xl border-gray-200 hover:bg-gray-50 text-sm"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}