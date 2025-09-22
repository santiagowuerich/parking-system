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
import { Vehicle, VehicleType } from "@/lib/types"

interface PlazaCompleta {
  pla_numero: number
  pla_estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento'
  pla_zona: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
  plantillas?: {
    catv_segmento: 'AUT' | 'MOT' | 'CAM'
  }
}

interface PlazaActionsModalProps {
  plaza: PlazaCompleta | null
  vehicle?: Vehicle | null
  isOpen: boolean
  onClose: () => void
  onIngreso?: () => void
  onEgreso?: () => void
  onMover?: () => void
  onBloquear?: () => void
  loading?: boolean
}

const getEstadoColor = (estado: string) => {
  switch (estado) {
    case 'Libre':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'Ocupada':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'Reservada':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Mantenimiento':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const mapearTipoVehiculo = (segmento: string): VehicleType => {
  switch (segmento) {
    case 'MOT': return 'Moto'
    case 'CAM': return 'Camioneta'
    case 'AUT':
    default: return 'Auto'
  }
}

export default function PlazaActionsModal({
  plaza,
  vehicle,
  isOpen,
  onClose,
  onIngreso,
  onEgreso,
  onMover,
  onBloquear,
  loading = false
}: PlazaActionsModalProps) {
  if (!plaza) return null

  const tipoVehiculo = mapearTipoVehiculo(plaza.catv_segmento)
  const isOcupada = plaza.pla_estado === 'Ocupada'
  const isLibre = plaza.pla_estado === 'Libre'
  const isMantenimiento = plaza.pla_estado === 'Mantenimiento'
  const isReservada = plaza.pla_estado === 'Reservada'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Acciones - Plaza {plaza.pla_numero}
            <Badge className={getEstadoColor(plaza.pla_estado)}>
              {plaza.pla_estado}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Zona: {plaza.pla_zona || 'Sin zona'} • Tipo: {tipoVehiculo}
            {vehicle && (
              <span className="font-medium text-foreground block mt-1">
                Vehículo: {vehicle.license_plate}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-4">
          {isLibre && onIngreso && (
            <Button
              onClick={onIngreso}
              className="bg-green-600 hover:bg-green-700 text-white col-span-2"
              disabled={loading}
            >
              Ingreso
            </Button>
          )}

          {isOcupada && vehicle && (
            <>
              {onEgreso && (
                <Button
                  onClick={onEgreso}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={loading}
                >
                  Egreso
                </Button>
              )}
              {onMover && (
                <Button
                  onClick={onMover}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={loading}
                >
                  Mover
                </Button>
              )}
            </>
          )}

          {onBloquear && (
            <Button
              onClick={onBloquear}
              variant="outline"
              className={`${isMantenimiento || isReservada ? 'col-span-2' : ''} border-gray-300 hover:bg-gray-50`}
              disabled={loading}
            >
              {isMantenimiento ? 'Desbloquear' : 'Bloquear'}
            </Button>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}