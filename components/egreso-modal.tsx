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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Vehicle } from "@/lib/types"
import { Loader2, Lock, Clock, CreditCard } from "lucide-react"

interface PlazaCompleta {
  pla_numero: number
  pla_estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento'
  pla_zona: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
}

interface EgresoModalProps {
  vehicle: Vehicle | null
  plaza: PlazaCompleta | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (paymentMethod: string) => Promise<void>
  loading?: boolean
}

export default function EgresoModal({
  vehicle,
  plaza,
  isOpen,
  onClose,
  onConfirm,
  loading = false
}: EgresoModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [calculatedData, setCalculatedData] = useState<{
    duration: string
    rate: number
    total: number
  } | null>(null)

  // Calcular datos cuando se abre el modal
  useEffect(() => {
    if (isOpen && vehicle) {
      const entryTime = new Date(vehicle.entry_time)
      const now = new Date()
      const durationMs = now.getTime() - entryTime.getTime()

      // Calcular duración en formato hh:mm
      const hours = Math.floor(durationMs / (1000 * 60 * 60))
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
      const duration = `${hours.toString().padStart(2, '0')} h ${minutes.toString().padStart(2, '0')} min`

      // Calcular tarifa (simplificado - aquí deberías usar tu lógica de tarifas)
      const baseRate = 1200 // $1200 por hora base
      const durationHours = durationMs / (1000 * 60 * 60)
      const total = Math.max(baseRate, Math.round(baseRate * durationHours))

      setCalculatedData({
        duration,
        rate: baseRate,
        total
      })
    }
  }, [isOpen, vehicle])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod("")
    }
  }, [isOpen])

  const handleConfirm = async () => {
    if (!paymentMethod) return

    try {
      await onConfirm(paymentMethod)
      onClose()
    } catch (error) {
      console.error('Error processing exit:', error)
    }
  }

  if (!vehicle || !plaza || !calculatedData) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Egreso</DialogTitle>
          <DialogDescription>
            Plaza {plaza.pla_zona} • {vehicle.license_plate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patente */}
          <div className="space-y-2">
            <Label htmlFor="patente">Patente</Label>
            <div className="relative">
              <Input
                id="patente"
                value={vehicle.license_plate}
                readOnly
                className="bg-muted"
              />
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Tiempo estacionado */}
          <div className="space-y-2">
            <Label htmlFor="tiempo">Tiempo estacionado (auto)</Label>
            <div className="relative">
              <Input
                id="tiempo"
                value={calculatedData.duration}
                readOnly
                className="bg-muted"
              />
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Tarifa vigente */}
          <div className="space-y-2">
            <Label htmlFor="tarifa">Tarifa vigente (auto)</Label>
            <div className="relative">
              <Input
                id="tarifa"
                value={`$${calculatedData.rate} por hora`}
                readOnly
                className="bg-muted"
              />
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Total a cobrar */}
          <div className="space-y-2">
            <Label htmlFor="total">Total a cobrar (auto)</Label>
            <div className="relative">
              <Input
                id="total"
                value={`$ ${calculatedData.total.toLocaleString()}`}
                readOnly
                className="bg-muted font-semibold"
              />
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Método de pago */}
          <div className="space-y-2">
            <Label htmlFor="payment-method">Método de pago (auto)</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Efectivo / Tarjeta / App" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                <SelectItem value="tarjeta">💳 Tarjeta</SelectItem>
                <SelectItem value="app">📱 App</SelectItem>
                <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!paymentMethod || loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              "Registrar egreso"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}