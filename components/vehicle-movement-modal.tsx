"use client"

import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
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
import { Card, CardContent } from "@/components/ui/card"
import { Vehicle, VehicleType } from "@/lib/types"
import { Loader2, MapPin, ArrowRight, CheckCircle } from "lucide-react"

interface PlazaCompleta {
  pla_numero: number
  pla_estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento'
  pla_zona: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
  plantillas?: {
    catv_segmento: 'AUT' | 'MOT' | 'CAM'
  }
}

interface ZoneData {
  nombre: string
  plazas: PlazaCompleta[]
}

interface VehicleMovementModalProps {
  vehicle: Vehicle | null
  currentPlaza: PlazaCompleta | null
  availableZones: ZoneData[]
  plazasDisponibles: PlazaCompleta[]
  isOpen: boolean
  onClose: () => void
  onConfirm: (destino: PlazaCompleta) => Promise<void>
  loading?: boolean
}

const mapearTipoVehiculo = (segmento: string): VehicleType => {
  switch (segmento) {
    case 'MOT': return 'Moto'
    case 'CAM': return 'Camioneta'
    case 'AUT':
    default: return 'Auto'
  }
}

const mapTypeToSegment = (type: VehicleType): 'AUT' | 'MOT' | 'CAM' => {
  switch (type) {
    case 'Moto': return 'MOT'
    case 'Camioneta': return 'CAM'
    case 'Auto':
    default: return 'AUT'
  }
}

export default function VehicleMovementModal({
  vehicle,
  currentPlaza,
  availableZones,
  plazasDisponibles,
  isOpen,
  onClose,
  onConfirm,
  loading = false
}: VehicleMovementModalProps) {
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [availablePlazas, setAvailablePlazas] = useState<PlazaCompleta[]>([])
  const [selectedDestination, setSelectedDestination] = useState<PlazaCompleta | null>(null)

  // Filtrar plazas compatibles por zona y tipo de vehículo
  const filterCompatiblePlazas = useCallback((zone: string) => {
    if (!vehicle || !currentPlaza) return []

    const targetSegment = mapTypeToSegment(vehicle.type)
    const zoneData = availableZones.find(z => z.nombre === zone)
    if (!zoneData) return []

    return zoneData.plazas.filter(plaza =>
      plaza.catv_segmento === targetSegment &&
      plaza.pla_estado === 'Libre' &&
      plaza.pla_numero !== currentPlaza?.pla_numero
    )
  }, [availableZones, currentPlaza, vehicle])

  // Actualizar plazas disponibles cuando cambia la zona
  useEffect(() => {
    if (selectedZone) {
      const filtered = filterCompatiblePlazas(selectedZone)
      setAvailablePlazas(filtered)
      setSelectedDestination(null) // Reset selection
    } else {
      setAvailablePlazas([])
      setSelectedDestination(null)
    }
  }, [selectedZone, filterCompatiblePlazas])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedZone("")
      setAvailablePlazas([])
      setSelectedDestination(null)
    }
  }, [isOpen])

  const handleConfirm = async () => {
    if (!selectedDestination) return

    try {
      await onConfirm(selectedDestination)
      toast.success(`Vehículo movido a plaza ${selectedDestination.pla_numero}`)
      onClose()
    } catch (error) {
      console.error('Error moving vehicle:', error)
      toast.error('Error al mover el vehículo')
    }
  }

  const handleZoneChange = useCallback((zone: string) => {
    setSelectedZone(zone)
    setSelectedDestination(null) // Reset destination when zone changes
  }, [])

  const handleDestinationChange = useCallback((plazaNumero: string) => {
    const plaza = availablePlazas.find(p => p.pla_numero === Number(plazaNumero))
    setSelectedDestination(plaza || null)
  }, [availablePlazas])

  if (!vehicle || !currentPlaza) return null

  // Obtener zonas únicas para el selector (incluir todas las zonas disponibles)
  const uniqueZones = availableZones.map(zone => zone.nombre)



  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg p-0 rounded-2xl shadow-xl border-0 bg-white">
        {/* Header compacto */}
        <div className="px-6 py-4 border-b border-gray-100">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Mover vehículo
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-1">
            Patente: {vehicle.license_plate} • Plaza actual: {currentPlaza.pla_numero}
          </DialogDescription>
        </div>

        <div className="px-6 py-4 space-y-4">

          {/* Zona destino */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Zona destino</Label>
            <Select value={selectedZone} onValueChange={handleZoneChange}>
              <SelectTrigger className="h-12 rounded-xl border-gray-200">
                <SelectValue placeholder="Elegí una zona (A, B, C...)" />
              </SelectTrigger>
              <SelectContent>
                {uniqueZones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    📍 Zona {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grid de plazas disponibles */}
          {selectedZone && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                Plazas disponibles para {vehicle.type}
              </Label>
              {availablePlazas.length > 0 ? (
                <div className="grid grid-cols-6 gap-2">
                  {availablePlazas.map((plaza) => (
                    <button
                      key={plaza.pla_numero}
                      onClick={() => setSelectedDestination(plaza)}
                      className={`
                        aspect-square rounded-xl font-semibold text-white transition-all duration-200
                        ${selectedDestination?.pla_numero === plaza.pla_numero
                          ? 'bg-blue-600 ring-2 ring-blue-300 scale-105'
                          : 'bg-green-500 hover:bg-green-600 hover:scale-105'
                        }
                      `}
                    >
                      {plaza.pla_numero}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No hay plazas disponibles para {vehicle.type} en {selectedZone}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-12 rounded-xl border-gray-200 hover:bg-gray-50"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedDestination || loading}
            className="flex-1 h-12 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-sm transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moviendo...
              </>
            ) : (
              'Confirmar movimiento'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}