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
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// Extender dayjs con plugins de zona horaria
dayjs.extend(utc)
dayjs.extend(timezone)

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
      // Los datos en BD están en UTC (timestamp without time zone)
      // Interpretar como UTC y luego convertir a zona local para cálculo
      const entryTime = dayjs.utc(vehicle.entry_time).local()
      const now = dayjs()

      console.log('🕐 Debug egreso-modal:', {
        entryTimeRaw: vehicle.entry_time,
        entryTimeParsed: entryTime.format(),
        now: now.format(),
        vehicle: vehicle.license_plate
      })
      const durationMs = Math.max(0, now.diff(entryTime)) // Asegurar que no sea negativo

      // Calcular duración en formato hh:mm
      const totalMinutes = Math.floor(durationMs / (1000 * 60))
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      const duration = `${hours.toString().padStart(2, '0')} h ${minutes.toString().padStart(2, '0')} min`

      // Calcular tarifa corregida - $200 por hora base
      const baseRate = 200 // $200 por hora base
      const durationHours = Math.max(0.1, durationMs / (1000 * 60 * 60)) // Mínimo 0.1 horas (6 minutos)

      // Calcular total: mínimo la tarifa base, o proporcional al tiempo
      let total = Math.round(baseRate * durationHours)

      // Mínimo cobrar la tarifa base completa si estuvo menos de 1 hora
      if (durationHours < 1) {
        total = baseRate
      }

      console.log('🕐 Cálculo de egreso:', {
        entryTime: entryTime.toISOString(),
        now: now.toISOString(),
        durationMs,
        durationHours,
        baseRate,
        total,
        vehicle: vehicle.license_plate
      })

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
          {/* Fecha y hora de ingreso */}
          <div className="space-y-2">
            <Label htmlFor="ingreso">Fecha y hora de ingreso</Label>
            <div className="relative">
              <Input
                id="ingreso"
                value={dayjs.utc(vehicle.entry_time).local().format('DD/MM/YYYY HH:mm')}
                readOnly
                className="bg-muted"
              />
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Fecha y hora de egreso */}
          <div className="space-y-2">
            <Label htmlFor="egreso">Fecha y hora de egreso</Label>
            <div className="relative">
              <Input
                id="egreso"
                value={dayjs().tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm')}
                readOnly
                className="bg-muted"
              />
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

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
            <Label htmlFor="tiempo">Tiempo estacionado</Label>
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
            <Label htmlFor="tarifa">Tarifa vigente</Label>
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
            <Label htmlFor="total">Total a cobrar</Label>
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