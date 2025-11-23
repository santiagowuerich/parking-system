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
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

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
              <label className="text-sm font-medium text-gray-700 block mb-1">Fecha y hora de ingreso</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 text-sm">
                {dayjs.utc(paymentData.entryTime).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm')}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fecha y hora de egreso</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 text-sm">
                {dayjs.utc(paymentData.exitTime).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm')}
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

            {/* Información de reserva si aplica */}
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
                  {paymentData.reservationCode && (
                    <div><strong>Código:</strong> {paymentData.reservationCode}</div>
                  )}
                </div>
                <div className="text-xs text-orange-700 font-medium pt-1 border-t border-green-200">
                  <span className="text-xs">⏱️ Tiempo excedido:</span> {formatDuration(paymentData.excessDuration || 0)}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tarifa vigente</label>
              <div className="w-full p-2 bg-gray-100 rounded-lg text-gray-900 text-sm">
                {formatCurrency(paymentData.precioBase || 0)} {getTariffTypeDisplay(paymentData.tariffType)}
              </div>
            </div>

            {paymentData.durationUnits && paymentData.precioBase && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cálculo del total</label>
                <div className="w-full p-2 bg-blue-50 rounded-lg text-gray-900 text-sm">
                  {paymentData.durationUnits} {paymentData.tariffType === 'hora' ? 'horas' : paymentData.tariffType} × {formatCurrency(paymentData.precioBase)} = {formatCurrency(paymentData.calculatedFee || paymentData.amount)}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Total a cobrar</label>
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