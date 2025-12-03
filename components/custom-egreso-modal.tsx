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
import { formatDateTime } from "@/lib/utils/date-time"

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
    vehicleType: string
    modality: string
    reservationPaidAmount?: number
    reservationCode?: string
    originalTotal?: number
  } | null>(null)
  const [calculating, setCalculating] = useState(false)

  // Calcular datos cuando se abre el modal usando el sistema de plantillas
  useEffect(() => {
    console.log('🚀 MODAL DE EGRESO - useEffect ejecutado:', {
      isOpen,
      tiene_vehicle: !!vehicle,
      vehicle_license_plate: vehicle?.license_plate,
      estId,
      tiene_rates: !!rates,
      cantidad_rates: rates?.length || 0
    })

    if (isOpen && vehicle && estId) {
      console.log('✅ Condiciones cumplidas, ejecutando calculateFeeWithTemplate...')
      calculateFeeWithTemplate()
    } else {
      console.warn('⚠️ Condiciones NO cumplidas para calcular tarifa:', {
        isOpen,
        tiene_vehicle: !!vehicle,
        tiene_estId: !!estId
      })
    }
  }, [isOpen, vehicle, rates, estId])

  const calculateFeeWithTemplate = async () => {
    console.log('🔄 INICIANDO calculateFeeWithTemplate:', {
      vehicle: vehicle?.license_plate,
      estId,
      timestamp: new Date().toISOString()
    })

    if (!vehicle || !estId) {
      console.error('❌ calculateFeeWithTemplate: Falta vehicle o estId', { vehicle, estId })
      return
    }

    console.log('⏳ Estableciendo calculating = true...')
    setCalculating(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      console.log('🔍 Buscando ocupación para:', {
        license_plate: vehicle.license_plate,
        plaza_number: vehicle.plaza_number,
        estId
      })

      // 🟢 CORRECCIÓN: Buscar la ocupación activa usando PLAZA_NUMBER si está disponible
      // Esto evita cruzar datos de diferentes ingresos de la misma patente
      let ocupacion
      let ocupacionError

      if (vehicle.plaza_number) {
        // Si tenemos plaza_number, usarlo para buscar la ocupación exacta
        const result = await supabase
          .from('vw_ocupacion_actual')
          .select('*')
          .eq('plaza_number', vehicle.plaza_number)
          .eq('est_id', estId)
          .single()

        ocupacion = result.data
        ocupacionError = result.error

        console.log('🎯 Búsqueda por plaza_number:', { plaza_number: vehicle.plaza_number, found: !!ocupacion })
      } else {
        // Fallback: buscar por patente si no hay plaza_number
        const result = await supabase
          .from('vw_ocupacion_actual')
          .select('*')
          .eq('license_plate', vehicle.license_plate)
          .eq('est_id', estId)
          .single()

        ocupacion = result.data
        ocupacionError = result.error

        console.log('🔍 Búsqueda por license_plate:', { license_plate: vehicle.license_plate, found: !!ocupacion })
      }

      if (ocupacionError || !ocupacion) {
        console.error('❌ Error obteniendo ocupación:', ocupacionError)
        // Usar cálculo básico como fallback
        calculateBasicFee()
        return
      }

      console.log('✅ Ocupación obtenida:', {
        ocu_id: ocupacion.ocu_id,
        res_codigo: ocupacion.res_codigo,
        ocu_duracion_tipo: ocupacion.ocu_duracion_tipo,
        ocu_precio_acordado: ocupacion.ocu_precio_acordado,
        vehicle_type: ocupacion.vehicle_type,
        entry_time: ocupacion.entry_time,
        est_id: estId
      })

      // Calcular duración
      const entryTime = dayjs.tz(ocupacion.entry_time, 'America/Argentina/Buenos_Aires')
      const exitTime = dayjs().tz('America/Argentina/Buenos_Aires')

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
            return r.catv_segmento === (ocupacion.vehicle_type || ocupacion.type) && r.tiptar_nro === tiptar
          })
        }

        if (vehicleRate) {
          baseRate = parseFloat(vehicleRate.tar_precio) || 200
          const hourlyRate = parseFloat(vehicleRate.tar_fraccion) || baseRate

          // Calcular según tipo de tarifa
          if (tiptar === 1) { // HORA
            // Mínimo 1 hora
            const hoursToCharge = Math.max(1, Math.ceil(durationHours))
            if (hoursToCharge <= 1) {
              calculatedFee = baseRate
            } else {
              calculatedFee = baseRate + (hourlyRate * (hoursToCharge - 1))
            }
          } else if (tiptar === 2) { // DÍA
            // Mínimo 1 día
            const durationDays = Math.max(1, Math.ceil(durationHours / 24))
            calculatedFee = baseRate * durationDays
          } else if (tiptar === 4) { // SEMANA
            // Mínimo 1 semana
            const durationWeeks = Math.max(1, Math.ceil(durationHours / (24 * 7)))
            calculatedFee = baseRate * durationWeeks
          } else if (tiptar === 3) { // MES
            // Mínimo 1 mes
            const durationMonths = Math.max(1, Math.ceil(durationHours / (24 * 30)))
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
            tipoTarifa: tiptar === 1 ? 'HORA' : tiptar === 2 ? 'DÍA' : tiptar === 3 ? 'MES' : tiptar === 4 ? 'SEMANA' : 'OTRO',
            unidadesCalculadas: tiptar === 1 ? Math.max(1, Math.ceil(durationHours)) :
              tiptar === 2 ? Math.max(1, Math.ceil(durationHours / 24)) :
                tiptar === 3 ? Math.max(1, Math.ceil(durationHours / (24 * 30))) :
                  tiptar === 4 ? Math.max(1, Math.ceil(durationHours / (24 * 7))) : 0,
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

      // 🎫 VERIFICAR SI HAY PAGO DE RESERVA PREVIO
      // Esto se hace después de calcular el fee para descontar el pago previo de la reserva
      console.log('🔍 Iniciando verificación de reserva pagada:', {
        tiene_res_codigo: !!ocupacion.res_codigo,
        res_codigo: ocupacion.res_codigo,
        ocu_duracion_tipo: ocupacion.ocu_duracion_tipo,
        ocu_precio_acordado: ocupacion.ocu_precio_acordado,
        es_reserva: ocupacion.ocu_duracion_tipo === 'reserva'
      })

      let reservationPaidAmount = 0
      let reservationCode: string | undefined = undefined
      const originalFee = fee // Guardar el fee original antes de aplicar descuentos
      
      if (ocupacion.res_codigo && ocupacion.ocu_duracion_tipo === 'reserva') {
        console.log('✅ RESERVA DETECTADA - Condiciones cumplidas:', {
          tiene_res_codigo: !!ocupacion.res_codigo,
          es_tipo_reserva: ocupacion.ocu_duracion_tipo === 'reserva',
          res_codigo: ocupacion.res_codigo
        })
        // Si viene de una reserva, obtener el monto pagado
        // Primero intentar desde ocu_precio_acordado (monto de la reserva pagada)
        console.log('📊 Verificando monto de reserva desde ocu_precio_acordado:', {
          ocu_precio_acordado: ocupacion.ocu_precio_acordado,
          tiene_precio_acordado: !!ocupacion.ocu_precio_acordado,
          precio_mayor_cero: ocupacion.ocu_precio_acordado && ocupacion.ocu_precio_acordado > 0
        })

        if (ocupacion.ocu_precio_acordado && ocupacion.ocu_precio_acordado > 0) {
          reservationPaidAmount = ocupacion.ocu_precio_acordado
          reservationCode = ocupacion.res_codigo
          
          console.log('✅ 🎫 RESERVA CON PAGO DETECTADA - Usando ocu_precio_acordado:', {
            res_codigo: ocupacion.res_codigo,
            monto_pagado_reserva: reservationPaidAmount,
            total_calculado_antes_descuento: fee,
            metodo: 'ocu_precio_acordado'
          })
          
          // Restar el monto del pago de reserva del total
          const feeAntesDescuento = fee
          fee = Math.max(0, fee - reservationPaidAmount)
          
          console.log('💰 CALCULO DE DESCUENTO DE RESERVA:', {
            total_original: feeAntesDescuento,
            monto_pagado_reserva: reservationPaidAmount,
            total_despues_descuento: fee,
            descuento_aplicado: feeAntesDescuento - fee,
            resultado: fee === 0 ? '✅ Sin cargo adicional (ya pagó todo)' : `✅ Restante a cobrar: $${fee}`
          })
        } else {
          // Si no hay precio acordado pero hay res_codigo, buscar el pago en la tabla de pagos
          // Esto requiere consultar la tabla ocupacion directamente para obtener pag_nro
          console.log('⚠️ No hay ocu_precio_acordado, buscando pago en tabla pagos...')
          
          try {
            console.log('🔍 Consultando tabla ocupacion para obtener pag_nro:', {
              ocu_id: ocupacion.ocu_id
            })
            
            const { data: ocupacionCompleta, error: ocupError } = await supabase
              .from('ocupacion')
              .select('pag_nro, res_codigo')
              .eq('ocu_id', ocupacion.ocu_id || 0)
              .single()
            
            console.log('📋 Resultado consulta ocupacion:', {
              encontrada: !!ocupacionCompleta,
              tiene_pag_nro: !!ocupacionCompleta?.pag_nro,
              pag_nro: ocupacionCompleta?.pag_nro,
              res_codigo: ocupacionCompleta?.res_codigo,
              error: ocupError?.message
            })
            
            if (!ocupError && ocupacionCompleta?.pag_nro) {
              console.log('🔍 Consultando tabla pagos para obtener monto:', {
                pag_nro: ocupacionCompleta.pag_nro
              })
              
              const { data: pagoReserva, error: pagoError } = await supabase
                .from('pagos')
                .select('pag_monto')
                .eq('pag_nro', ocupacionCompleta.pag_nro)
                .single()
              
              console.log('💰 Resultado consulta pagos:', {
                encontrado: !!pagoReserva,
                pag_monto: pagoReserva?.pag_monto,
                error: pagoError?.message
              })
              
              if (!pagoError && pagoReserva?.pag_monto) {
                reservationPaidAmount = pagoReserva.pag_monto
                reservationCode = ocupacionCompleta.res_codigo || undefined
                
                console.log('✅ 🎫 RESERVA CON PAGO DETECTADA - Usando tabla pagos:', {
                  pag_nro: ocupacionCompleta.pag_nro,
                  monto_pagado_reserva: reservationPaidAmount,
                  res_codigo: reservationCode,
                  total_calculado_antes_descuento: fee,
                  metodo: 'tabla_pagos'
                })
                
                // Restar el monto del pago de reserva del total
                const feeAntesDescuento = fee
                fee = Math.max(0, fee - reservationPaidAmount)
                
                console.log('💰 CALCULO DE DESCUENTO DE RESERVA:', {
                  total_original: feeAntesDescuento,
                  monto_pagado_reserva: reservationPaidAmount,
                  total_despues_descuento: fee,
                  descuento_aplicado: feeAntesDescuento - fee,
                  resultado: fee === 0 ? '✅ Sin cargo adicional (ya pagó todo)' : `✅ Restante a cobrar: $${fee}`
                })
              } else {
                console.warn('⚠️ No se encontró pago en tabla pagos:', {
                  pag_nro: ocupacionCompleta.pag_nro,
                  error: pagoError?.message
                })
              }
            } else {
              console.warn('⚠️ Ocupación no tiene pag_nro asociado:', {
                ocu_id: ocupacion.ocu_id,
                error: ocupError?.message
              })
            }
          } catch (error) {
            console.error('❌ Error obteniendo pago de reserva:', error)
          }
        }
      } else {
        console.log('ℹ️ No es reserva o no tiene res_codigo:', {
          tiene_res_codigo: !!ocupacion.res_codigo,
          ocu_duracion_tipo: ocupacion.ocu_duracion_tipo,
          es_reserva: ocupacion.ocu_duracion_tipo === 'reserva'
        })
      }

      // Mapear tipo de vehículo a nombre legible
      const vehicleTypeMap: Record<string, string> = {
        'AUT': 'auto',
        'MOT': 'moto',
        'CAM': 'camioneta',
        'Auto': 'auto',
        'Moto': 'moto',
        'Camioneta': 'camioneta'
      }

      // Mapear duración a nombre legible
      const modalityMap: Record<string, string> = {
        'hora': 'hora',
        'dia': 'día',
        'semana': 'semana',
        'mes': 'mes'
      }

      const vehicleType = ocupacion.vehicle_type || ocupacion.type || 'AUT'
      const vehicleTypeName = vehicleTypeMap[vehicleType] || vehicleType.toLowerCase()
      const modalityName = modalityMap[ocupacion.ocu_duracion_tipo] || ocupacion.ocu_duracion_tipo

      console.log('📊 RESUMEN FINAL DE CÁLCULO:', {
        duracion: duration,
        tarifa_base: baseRate,
        total_final: Math.round(fee),
        tiene_reserva_pagada: reservationPaidAmount > 0,
        monto_reserva_pagada: reservationPaidAmount > 0 ? reservationPaidAmount : 0,
        codigo_reserva: reservationCode,
        total_original: reservationPaidAmount > 0 ? Math.round(originalFee) : Math.round(fee),
        descuento_aplicado: reservationPaidAmount > 0 ? (originalFee - fee) : 0,
        tipo_vehiculo: vehicleTypeName,
        modalidad: modalityName
      })

      setCalculatedData({
        duration,
        rate: baseRate,
        total: Math.round(fee),
        baseRate,
        vehicleType: vehicleTypeName,
        modality: modalityName,
        reservationPaidAmount: reservationPaidAmount > 0 ? reservationPaidAmount : undefined,
        reservationCode: reservationCode,
        originalTotal: reservationPaidAmount > 0 ? Math.round(originalFee) : undefined
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

    // Los datos en BD están en zona horaria de Argentina (timestamp without time zone)
    // Interpretar directamente como Argentina para cálculo
    const entryTime = dayjs.tz(vehicle.entry_time, 'America/Argentina/Buenos_Aires')
    const now = dayjs().tz('America/Argentina/Buenos_Aires')

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

    // Usar tipo del vehículo del prop si está disponible
    const vehicleTypeMap: Record<string, string> = {
      'AUT': 'auto',
      'MOT': 'moto',
      'CAM': 'camioneta',
      'Auto': 'auto',
      'Moto': 'moto',
      'Camioneta': 'camioneta'
    }

    const vehicleTypeName = vehicle.type ? (vehicleTypeMap[vehicle.type] || vehicle.type.toLowerCase()) : 'auto'

    setCalculatedData({
      duration,
      rate: baseRate,
      total,
      baseRate,
      vehicleType: vehicleTypeName,
      modality: 'hora'  // Por defecto hora en cálculo básico
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
      <DialogContent className="sm:max-w-md overflow-hidden">
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
              {/* Fecha y hora de ingreso */}
              <div className="space-y-2">
                <Label htmlFor="ingreso">Fecha y hora de ingreso</Label>
                <div className="relative">
                  <Input
                    id="ingreso"
                    value={formatDateTime(vehicle.entry_time)}
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
                    value={`$${calculatedData.rate} por ${calculatedData.modality}`}
                    readOnly
                    className="bg-muted"
                  />
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Información de reserva pagada (si aplica) */}
              {calculatedData.reservationPaidAmount && calculatedData.reservationPaidAmount > 0 && (
                <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-700 font-medium">💰 Reserva pagada:</span>
                    <span className="text-blue-700 font-semibold">
                      $ {calculatedData.reservationPaidAmount.toLocaleString()}
                    </span>
                  </div>
                  {calculatedData.reservationCode && (
                    <div className="text-xs text-blue-600">
                      Código: {calculatedData.reservationCode}
                    </div>
                  )}
                  {calculatedData.originalTotal && calculatedData.originalTotal > calculatedData.total && (
                    <div className="text-xs text-green-700 mt-1">
                      ✅ Descuento aplicado: $ {(calculatedData.originalTotal - calculatedData.total).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

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
                {calculatedData.reservationPaidAmount && calculatedData.reservationPaidAmount > 0 && calculatedData.originalTotal && (
                  <p className="text-xs text-muted-foreground">
                    Total original: $ {calculatedData.originalTotal.toLocaleString()} (descontado pago de reserva)
                  </p>
                )}
              </div>

              {/* Método de pago */}
              <div className="space-y-2">
                <Label htmlFor="payment-method">Método de pago</Label>
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