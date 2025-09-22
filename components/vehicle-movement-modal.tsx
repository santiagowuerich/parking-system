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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mover Vehículo
          </DialogTitle>
          <DialogDescription>
            Selecciona la nueva ubicación para el vehículo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información del vehículo actual */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg">{vehicle.license_plate}</div>
                  <div className="text-sm text-muted-foreground">{vehicle.type}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Plaza actual</div>
                  <Badge variant="outline" className="font-semibold">
                    {currentPlaza.pla_numero}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selector de zona destino */}
          <div className="space-y-2">
            <Label>Zona de destino</Label>
            <Select value={selectedZone} onValueChange={handleZoneChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una zona" />
              </SelectTrigger>
              <SelectContent>
                {uniqueZones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    📍 {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selector de plaza específica */}
          {selectedZone && (
            <div className="space-y-2">
              <Label>Plaza disponible</Label>
              {availablePlazas.length > 0 ? (
                <Select
                  value={selectedDestination?.pla_numero.toString() || ""}
                  onValueChange={handleDestinationChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la plaza destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlazas.map((plaza) => (
                      <SelectItem key={plaza.pla_numero} value={plaza.pla_numero.toString()}>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Plaza {plaza.pla_numero}
                          <Badge variant="secondary" className="text-xs">
                            {mapearTipoVehiculo(plaza.catv_segmento)}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>No hay plazas disponibles para {vehicle.type} en {selectedZone}</p>
                      <p className="text-xs mt-1">Selecciona otra zona</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Vista previa del movimiento */}
          {selectedDestination && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-center gap-3">
                  <Badge variant="outline">Plaza {currentPlaza.pla_numero}</Badge>
                  <ArrowRight className="h-4 w-4 text-green-600" />
                  <Badge className="bg-green-600">Plaza {selectedDestination.pla_numero}</Badge>
                </div>
                <p className="text-center text-sm text-green-700 mt-2">
                  {currentPlaza.pla_zona} → {selectedDestination.pla_zona}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedDestination || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moviendo...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Confirmar movimiento
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}