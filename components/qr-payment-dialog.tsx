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
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatTimeUntilExpiry } from "@/lib/utils/payment-utils"
import { Smartphone, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react"
import { PaymentStatus } from "@/lib/types/payment"

interface QRPaymentDialogProps {
  isOpen: boolean
  onClose: () => void
  onPaymentComplete: () => void
  paymentData: {
    amount: number
    vehicleLicensePlate: string
    paymentId: string
    duration: string
    expiresAt: string
  }
  qrData: {
    qrCode: string
    qrCodeImage: string
    preferenceId: string
  }
  paymentStatus: PaymentStatus
  loading?: boolean
  onRefreshStatus?: () => void
}

export default function QRPaymentDialog({
  isOpen,
  onClose,
  onPaymentComplete,
  paymentData,
  qrData,
  paymentStatus,
  loading = false,
  onRefreshStatus
}: QRPaymentDialogProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("")

  // Update countdown timer
  useEffect(() => {
    if (!paymentData.expiresAt) return

    const interval = setInterval(() => {
      const remaining = formatTimeUntilExpiry(paymentData.expiresAt)
      setTimeRemaining(remaining)

      if (remaining === 'Expirado') {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [paymentData.expiresAt])

  // Handle payment completion
  useEffect(() => {
    if (paymentStatus === 'aprobado') {
      onPaymentComplete()
    }
  }, [paymentStatus, onPaymentComplete])

  const getStatusConfig = () => {
    switch (paymentStatus) {
      case 'pendiente':
        return {
          icon: <Clock className="h-5 w-5 text-blue-600" />,
          title: "Esperando pago",
          description: "Escanea el código QR para pagar",
          color: "bg-blue-50 border-blue-200 text-blue-800"
        }
      case 'aprobado':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          title: "Pago aprobado",
          description: "Tu pago fue procesado exitosamente",
          color: "bg-green-50 border-green-200 text-green-800"
        }
      case 'rechazado':
        return {
          icon: <XCircle className="h-5 w-5 text-red-600" />,
          title: "Pago rechazado",
          description: "Hubo un problema con tu pago",
          color: "bg-red-50 border-red-200 text-red-800"
        }
      case 'expirado':
        return {
          icon: <AlertCircle className="h-5 w-5 text-gray-600" />,
          title: "Pago expirado",
          description: "El tiempo para pagar ha expirado",
          color: "bg-gray-50 border-gray-200 text-gray-800"
        }
      default:
        return {
          icon: <Clock className="h-5 w-5 text-blue-600" />,
          title: "Procesando",
          description: "Verificando estado del pago",
          color: "bg-blue-50 border-blue-200 text-blue-800"
        }
    }
  }

  const statusConfig = getStatusConfig()
  const isExpired = timeRemaining === 'Expirado'
  const canRefresh = paymentStatus === 'pendiente' && !isExpired

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md p-0 rounded-2xl shadow-xl border-0 bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Pago con QR
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-1">
            Escaneá el código con tu celular para pagar {formatCurrency(paymentData.amount)}
          </DialogDescription>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Estado del pago */}
          <Card className={`border ${statusConfig.color}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {statusConfig.icon}
                <div>
                  <div className="font-medium">{statusConfig.title}</div>
                  <div className="text-sm opacity-80">{statusConfig.description}</div>
                </div>
                {canRefresh && onRefreshStatus && (
                  <button
                    onClick={onRefreshStatus}
                    className="ml-auto p-2 rounded-lg hover:bg-white/20 transition-colors"
                    title="Actualizar estado"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Código QR */}
          {paymentStatus === 'pendiente' && !isExpired && (
            <div className="text-center space-y-4">
              <Card className="border border-gray-200">
                <CardContent className="p-6">
                  {qrData.qrCodeImage ? (
                    <div className="flex justify-center">
                      <img
                        src={qrData.qrCodeImage}
                        alt="Código QR para pagar"
                        className="w-48 h-48 border border-gray-200 rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 mx-auto bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <Smartphone className="h-8 w-8 mx-auto mb-2" />
                        <div className="text-sm">Cargando QR...</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tiempo restante */}
              {timeRemaining && !isExpired && (
                <Badge variant="outline" className="text-sm">
                  <Clock className="h-3 w-3 mr-1" />
                  Expira en {timeRemaining}
                </Badge>
              )}
            </div>
          )}

          {/* Información del pago */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Vehículo:</span>
                <span className="font-medium">{paymentData.vehicleLicensePlate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tiempo:</span>
                <span className="font-medium">{paymentData.duration}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total:</span>
                <span className="font-bold text-lg">{formatCurrency(paymentData.amount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Instrucciones */}
          {paymentStatus === 'pendiente' && !isExpired && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-2">Cómo pagar:</div>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Abrí la app de tu banco o MercadoPago</li>
                    <li>Escaneá el código QR con la cámara</li>
                    <li>Confirmá el pago en tu app</li>
                    <li>El estado se actualizará automáticamente</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mensaje de expiración */}
          {isExpired && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="text-sm text-red-800 text-center">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                  <div className="font-medium">El código QR ha expirado</div>
                  <div className="text-xs mt-1">Genera un nuevo código para pagar</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ID de referencia */}
          <div className="text-center">
            <div className="text-xs text-gray-500">ID de pago</div>
            <div className="font-mono text-xs text-gray-700 bg-gray-100 rounded px-2 py-1 inline-block">
              {paymentData.paymentId}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="px-6 pb-6">
          {paymentStatus === 'aprobado' ? (
            <Button
              onClick={onPaymentComplete}
              className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Continuar
            </Button>
          ) : paymentStatus === 'rechazado' || isExpired ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 h-12 rounded-xl border-gray-200 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => window.location.reload()}
                className="flex-1 h-12 rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
              >
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1 h-12 rounded-xl border-gray-200 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              {canRefresh && onRefreshStatus && (
                <Button
                  onClick={onRefreshStatus}
                  disabled={loading}
                  variant="outline"
                  className="px-4 h-12 rounded-xl border-blue-200 hover:bg-blue-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}