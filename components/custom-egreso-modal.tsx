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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Vehicle } from "@/lib/types"
import { Loader2, Lock } from "lucide-react"
import { createBrowserClient } from "@supabase/ssr"
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

interface CustomEgresoModalProps {
  vehicle: Vehicle | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (paymentMethod: string) => Promise<void>
  loading?: boolean
  rates: any[] | null
  estId: string | null
}

export default function CustomEgresoModal({
  vehicle,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  rates,
  estId
}: CustomEgresoModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [calculatedData, setCalculatedData] = useState<{
    duration: string
    rate: number
    total: number
    baseRate: number
  } | null>(null)
  const [calculating, setCalculating] = useState(false)

  // Calcular datos cuando se abre el modal usando el sistema de plantillas
  useEffect(() => {
    if (isOpen && vehicle && estId) {
      calculateFeeWithTemplate()
    }
  }, [isOpen, vehicle, rates, estId])

  const calculateFeeWithTemplate = async () => {
    if (!vehicle || !estId) return

    setCalculating(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Buscar la ocupación activa del vehículo
      const { data: ocupacion, error: ocupacionError } = await supabase
        .from('vw_ocupacion_actual')
        .select('*')
        .eq('license_plate', vehicle.license_plate)
        .eq('est_id', estId)
        .single()

      if (ocupacionError || !ocupacion) {
        console.error('Error obteniendo ocupación:', ocupacionError)
        // Usar cálculo básico como fallback
        calculateBasicFee()
        return
      }

      // Calcular duración
      const entryTime = dayjs.utc(ocupacion.entry_time).local()
      const exitTime = dayjs()

      console.log('🕐 Debug custom-egreso-modal:', {
        entryTimeRaw: ocupacion.entry_time,
        entryTimeParsed: entryTime.format(),
        exitTime: exitTime.format(),
        vehicle: vehicle.license_plate
      })
      const durationMs = Math.max(0, exitTime.diff(entryTime))
      const durationHours = durationMs / (1000 * 60 * 60)

      // Formatear duración
      const totalMinutes = Math.floor(durationMs / (1000 * 60))
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      const duration = `${hours.toString().padStart(2, '0')} h ${minutes.toString().padStart(2, '0')} min`

      let fee = 0
      let calculatedFee = 0
      let baseRate = 200 // Fallback
      let agreedPrice = ocupacion.ocu_precio_acordado || 0

      if (rates && rates.length > 0) {
        // Determinar el tipo de tarifa basado en la duración acordada
        let tiptar = 1 // Por defecto hora
        if (ocupacion.ocu_duracion_tipo === 'dia') {
          tiptar = 2
        } else if (ocupacion.ocu_duracion_tipo === 'mes') {
          tiptar = 3
        } else if (ocupacion.ocu_duracion_tipo === 'semana') {
          tiptar = 4
        }

        let vehicleRate = null

        // Obtener información de la plaza para determinar la plantilla
        let plazaPlantillaId = null
        if (ocupacion.plaza_number) {
          try {
            const { data: plazaData, error: plazaError } = await supabase
              .from('plazas')
              .select('plantilla_id')
              .eq('pla_numero', ocupacion.plaza_number)
              .eq('est_id', estId)
              .single()

            if (!plazaError && plazaData?.plantilla_id) {
              plazaPlantillaId = plazaData.plantilla_id
            }
          } catch (error) {
            console.warn('Error obteniendo plantilla de plaza:', error)
          }
        }

        // Buscar tarifa por plantilla
        if (plazaPlantillaId) {
          vehicleRate = rates.find((r: any) => {
            return r.plantilla_id === plazaPlantillaId && r.tiptar_nro === tiptar
          })
        }

        // Fallback: buscar por tipo de vehículo
        if (!vehicleRate) {
          vehicleRate = rates.find((r: any) => {
            return r.catv_segmento === ocupacion.type && r.tiptar_nro === tiptar
          })
        }

        if (vehicleRate) {
          baseRate = parseFloat(vehicleRate.tar_precio) || 200
          const hourlyRate = parseFloat(vehicleRate.tar_fraccion) || baseRate

          // Calcular según tipo de tarifa
          if (tiptar === 1) { // HORA
            if (durationHours <= 1) {
              calculatedFee = baseRate
            } else {
              calculatedFee = baseRate + (hourlyRate * (durationHours - 1))
            }
          } else if (tiptar === 2) { // DÍA
            const durationDays = Math.ceil(durationHours / 24)
            calculatedFee = baseRate * durationDays
          } else if (tiptar === 4) { // SEMANA
            const durationWeeks = Math.ceil(durationHours / (24 * 7))
            calculatedFee = baseRate * durationWeeks
          } else if (tiptar === 3) { // MES
            const durationMonths = Math.ceil(durationHours / (24 * 30))
            calculatedFee = baseRate * durationMonths
          } else {
            calculatedFee = baseRate
          }

          fee = Math.max(calculatedFee, agreedPrice)

          console.log('💰 Cálculo con plantilla:', {
            vehicleRate,
            baseRate,
            hourlyRate,
            durationHours,
            tiptar,
            calculatedFee,
            agreedPrice,
            fee,
            plazaPlantillaId
          })
        } else {
          console.warn('⚠️ No se encontró tarifa, usando precio acordado o fallback')
          fee = agreedPrice > 0 ? agreedPrice : 200
          baseRate = 200
        }
      } else {
        console.warn('⚠️ No hay tarifas configuradas')
        fee = agreedPrice > 0 ? agreedPrice : 200
      }

      setCalculatedData({
        duration,
        rate: baseRate,
        total: Math.round(fee),
        baseRate
      })

    } catch (error) {
      console.error('Error calculando tarifa:', error)
      calculateBasicFee()
    } finally {
      setCalculating(false)
    }
  }

  const calculateBasicFee = () => {
    if (!vehicle) return

    // Los datos en BD están en UTC (timestamp without time zone)
    // Interpretar como UTC y luego convertir a zona local para cálculo
    const entryTime = dayjs.utc(vehicle.entry_time).local()
    const now = dayjs()

    console.log('🕐 Debug calculateBasicFee:', {
      entryTimeRaw: vehicle.entry_time,
      entryTimeParsed: entryTime.format(),
      now: now.format(),
      vehicle: vehicle.license_plate
    })
    const durationMs = Math.max(0, now.diff(entryTime))

    const totalMinutes = Math.floor(durationMs / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const duration = `${hours.toString().padStart(2, '0')} h ${minutes.toString().padStart(2, '0')} min`

    const baseRate = 200
    const durationHours = Math.max(0.1, durationMs / (1000 * 60 * 60))
    let total = Math.round(baseRate * durationHours)

    if (durationHours < 1) {
      total = baseRate
    }

    setCalculatedData({
      duration,
      rate: baseRate,
      total,
      baseRate
    })
  }

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod("")
    } else {
      setCalculatedData(null)
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

  if (!vehicle) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Egreso</DialogTitle>
          <DialogDescription>
            Plaza {vehicle.plaza_number || 'N/A'} • {vehicle.license_plate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {calculating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Calculando tarifa...</span>
            </div>
          ) : calculatedData ? (
            <>
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
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Error cargando datos del vehículo
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!paymentMethod || loading || calculating || !calculatedData}
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