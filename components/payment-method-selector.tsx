"use client"

import { useState, useEffect } from "react"
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
import { formatDateTime } from "@/lib/utils/date-time"

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

  // Logs cuando se abre el modal
  useEffect(() => {
    if (isOpen && paymentData) {
      console.log('🚀 PAYMENT METHOD SELECTOR - Modal abierto:', {
        isOpen,
        tiene_paymentData: !!paymentData,
        vehicle: paymentData.vehicleLicensePlate,
        amount: paymentData.amount,
        hasReservation: paymentData.hasReservation,
        reservationCode: paymentData.reservationCode,
        reservationPaidAmount: paymentData.reservationPaidAmount,
        timestamp: new Date().toISOString()
      })

      if (paymentData.hasReservation) {
        console.log('🎫 INFORMACIÓN DE RESERVA EN MODAL:', {
          tiene_reserva: true,
          res_codigo: paymentData.reservationCode,
          monto_pagado: paymentData.reservationPaidAmount,
          tiempo_excedido: paymentData.excessDuration,
          horas_reservadas: paymentData.reservationHours,
          amount_final: paymentData.amount,
          calculatedFee: paymentData.calculatedFee
        })
      } else {
        console.log('ℹ️ No hay reserva en este egreso')
      }
    }
  }, [isOpen, paymentData])

  if (!paymentData) return null

  const availableMethods = getAvailablePaymentMethods(paymentSettings)

  // Función para formatear el tipo de tarifa para mostrar
  const getTariffTypeDisplay = (tariffType?: string): string => {
    if (!tariffType) return 'por hora' // Fallback

    switch (tariffType) {
      case 'hora':
        return 'por hora'
      case 'dia':
        return 'por día'
      case 'semana':
        return 'por semana'
      case 'mes':
        return 'por mes'
      default:
        return `por ${tariffType}`
    }
  }

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
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden p-0 rounded-2xl shadow-xl border-0 bg-white">
        <div className="max-h-[85vh] overflow-y-auto">
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
          {/* Información de reserva si aplica - ARRIBA */}
          {paymentData.hasReservation && paymentData.reservationPaidAmount && (
            <div className="space-y-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-green-700">🎫 Reserva confirmada</label>
              </div>
              <div className="text-xs text-green-600 space-y-1">
                <div><strong>Monto pagado:</strong> {formatCurrency(paymentData.reservationPaidAmount)}</div>
                {paymentData.reservationHours && (
                  <div><strong>Horas reservadas:</strong> {paymentData.reservationHours.toFixed(1)}h</div>
                )}
              </div>
              <div className="text-xs text-orange-700 font-medium pt-1 border-t border-green-200">
                <span className="text-xs">⏱️ Tiempo excedido:</span> {formatDuration(paymentData.excessDuration || 0)}
              </div>
            </div>
          )}

          {/* Información del egreso - campos tipo input como en la imagen */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fecha y hora de ingreso</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 text-sm">
                {formatDateTime(paymentData.entryTime)}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fecha y hora de egreso</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 text-sm">
                {formatDateTime(paymentData.exitTime)}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Patente</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 font-medium text-sm">
                {paymentData.vehicleLicensePlate}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tiempo estacionado</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 text-sm">
                {formatDuration(paymentData.duration)}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tarifa vigente</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 text-sm">
                {formatCurrency(paymentData.precioBase || 0)} {getTariffTypeDisplay(paymentData.tariffType)}
              </div>
            </div>

            {paymentData.durationUnits && paymentData.precioBase && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cálculo del total</label>
                <div className="w-full p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200 text-gray-900 text-sm space-y-2.5">
                  {/* Línea 1: Cálculo básico */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-blue-300">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{paymentData.durationUnits}</span>
                      <span className="text-gray-600">{paymentData.tariffType === 'hora' ? 'horas' : paymentData.tariffType}</span>
                      <span className="text-gray-400">×</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(paymentData.precioBase)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">=</span>
                      <span className="text-lg font-bold text-blue-700">{formatCurrency(paymentData.calculatedFee || paymentData.amount)}</span>
                    </div>
                  </div>

                  {/* Línea 2: Descuento (si aplica) */}
                  {paymentData.calculatedFee && paymentData.calculatedFee > paymentData.amount && (
                    <div className="flex items-center justify-between pb-2.5 border-b border-blue-200">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-medium">-</span>
                        <span className="text-green-700">Pago por reserva</span>
                      </div>
                      <span className="text-green-700 font-semibold">{formatCurrency(paymentData.calculatedFee - paymentData.amount)}</span>
                    </div>
                  )}

                  {/* Línea 3: Total final */}
                  {paymentData.calculatedFee && paymentData.calculatedFee > paymentData.amount && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-gray-700 font-semibold">A cobrar</span>
                      <span className="text-lg font-bold text-blue-700">{formatCurrency(paymentData.amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
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
        </div>
      </DialogContent>
    </Dialog>
  )
}