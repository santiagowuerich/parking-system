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
import { VehicleType } from "@/lib/types"
import { Loader2, Lock } from "lucide-react"

interface PlazaCompleta {
  pla_numero: number
  pla_estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento'
  pla_zona: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
}

interface Tarifa {
  tar_id: number
  tar_nombre: string
  tar_precio_hora: number
  tar_descripcion?: string
}

interface IngresoModalProps {
  plaza: PlazaCompleta | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: {
    license_plate: string
    type: VehicleType
    plaza_number: number
    modality: string
    agreed_price: number
  }) => Promise<void>
  loading?: boolean
  tarifas?: Tarifa[]
  availablePlazas?: PlazaCompleta[]
}

const mapearTipoVehiculo = (segmento: string): VehicleType => {
  switch (segmento) {
    case 'MOT': return 'Moto'
    case 'CAM': return 'Camioneta'
    case 'AUT':
    default: return 'Auto'
  }
}

export default function IngresoModal({
  plaza,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  tarifas = [],
  availablePlazas = []
}: IngresoModalProps) {
  const [licensePlate, setLicensePlate] = useState("")
  const [vehicleType, setVehicleType] = useState<VehicleType>("Auto")
  const [selectedPlaza, setSelectedPlaza] = useState<number | null>(null)
  const [selectedModality, setSelectedModality] = useState<string>("Hora")
  const [agreedPrice, setAgreedPrice] = useState<number>(0)

  // Mapear tipo de vehículo a segmento de base de datos
  const mapVehicleTypeToSegment = (type: VehicleType): string => {
    switch (type) {
      case 'Moto': return 'MOT'
      case 'Camioneta': return 'CAM'
      case 'Auto':
      default: return 'AUT'
    }
  }

  // Obtener plazas disponibles para el tipo de vehículo seleccionado
  const getAvailablePlazasForVehicleType = (type: VehicleType): PlazaCompleta[] => {
    const segment = mapVehicleTypeToSegment(type)
    const filteredPlazas = availablePlazas.filter(p =>
      p.pla_estado === 'Libre' &&
      p.catv_segmento === segment
    )

    // Si hay una plaza preseleccionada, asegurar que esté en la lista
    if (plaza && !filteredPlazas.find(p => p.pla_numero === plaza.pla_numero)) {
      filteredPlazas.push(plaza)
    }

    return filteredPlazas
  }

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset all fields
      setLicensePlate("")

      // Si hay una plaza preseleccionada, usar su información
      if (plaza) {
        // Mapear el tipo de vehículo basado en el segmento de la plaza
        const vehicleTypeFromPlaza = mapearTipoVehiculo(plaza.catv_segmento)
        setVehicleType(vehicleTypeFromPlaza)
        setSelectedPlaza(plaza.pla_numero)
      } else {
        // Si no hay plaza preseleccionada, usar valores por defecto
        setVehicleType("Auto")
        setSelectedPlaza(null)
      }

      // Set default modality and price based on available tariffs
      let defaultModality = "Hora"
      let defaultPrice = 200 // Fallback

      if (tarifas && tarifas.length > 0) {
        const horaTarifa = tarifas.find(t => t.tar_nombre.toLowerCase().includes('hora'))
        if (horaTarifa) {
          defaultModality = horaTarifa.tar_nombre
          defaultPrice = horaTarifa.tar_precio_hora
        }
      }

      setSelectedModality(defaultModality)
      setAgreedPrice(defaultPrice)
    }
  }, [isOpen, tarifas, plaza])

  // Update selected plaza when vehicle type changes
  useEffect(() => {
    // Solo resetear la plaza si no hay una plaza preseleccionada
    // o si la plaza preseleccionada no es compatible con el nuevo tipo de vehículo
    if (!plaza || mapearTipoVehiculo(plaza.catv_segmento) !== vehicleType) {
      setSelectedPlaza(null)
    }
  }, [vehicleType, plaza])

  // Update price when modality changes
  useEffect(() => {
    if (tarifas && tarifas.length > 0) {
      // Buscar tarifa por nombre exacto o por coincidencia parcial
      const tarifa = tarifas.find(t => t.tar_nombre === selectedModality) ||
        tarifas.find(t => t.tar_nombre.toLowerCase().includes(selectedModality.toLowerCase()))
      if (tarifa) {
        setAgreedPrice(tarifa.tar_precio_hora)
      }
    }
  }, [selectedModality, tarifas])

  const handleConfirm = async () => {
    if (!licensePlate.trim() || !selectedPlaza) return

    try {
      await onConfirm({
        license_plate: licensePlate.trim(),
        type: vehicleType,
        plaza_number: selectedPlaza,
        modality: selectedModality,
        agreed_price: agreedPrice
      })
      onClose()
    } catch (error) {
      console.error('Error registering entry:', error)
    }
  }

  const isFormValid = licensePlate.trim().length > 0 && selectedPlaza !== null
  const availablePlazasForVehicle = getAvailablePlazasForVehicleType(vehicleType)
  const selectedPlazaData = availablePlazas.find(p => p.pla_numero === selectedPlaza)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Ingreso</DialogTitle>
          <DialogDescription>
            Registrar nuevo vehículo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patente */}
          <div className="space-y-2">
            <Label htmlFor="patente">Patente</Label>
            <Input
              id="patente"
              placeholder="ABC123"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
              maxLength={10}
            />
          </div>

          {/* Tarifa */}
          <div className="space-y-2">
            <Label htmlFor="modality">Modalidad de Tarifa</Label>
            <Select
              value={selectedModality}
              onValueChange={setSelectedModality}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar modalidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hora">Hora</SelectItem>
                <SelectItem value="Día">Día</SelectItem>
                <SelectItem value="Semana">Semana</SelectItem>
                <SelectItem value="Mensual">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de vehículo */}
          <div className="space-y-2">
            <Label htmlFor="vehicle-type">Tipo de vehículo</Label>
            <Select value={vehicleType} onValueChange={(value: VehicleType) => setVehicleType(value)}>
              <SelectTrigger disabled={!!plaza}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Auto">🚗 Auto</SelectItem>
                <SelectItem value="Moto">🏍️ Moto</SelectItem>
                <SelectItem value="Camioneta">🚛 Camioneta</SelectItem>
              </SelectContent>
            </Select>
            {plaza && (
              <p className="text-xs text-muted-foreground">Bloqueado: deriva del tipo de la plaza seleccionada</p>
            )}
          </div>

          {/* Plaza a asignar */}
          <div className="space-y-2">
            <Label htmlFor="plaza-selector">Plaza asignada</Label>
            <Select
              value={selectedPlaza?.toString() || ""}
              onValueChange={(value) => setSelectedPlaza(Number(value))}
            >
              <SelectTrigger disabled={!!plaza}>
                <SelectValue placeholder="Seleccionar plaza disponible..." />
              </SelectTrigger>
              <SelectContent>
                {availablePlazasForVehicle.length > 0 ? (
                  availablePlazasForVehicle.map((plaza) => (
                    <SelectItem key={plaza.pla_numero} value={plaza.pla_numero.toString()}>
                      Plaza {plaza.pla_numero} - {plaza.pla_zona}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-plazas" disabled>
                    No hay plazas disponibles para {vehicleType}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {plaza && (
              <p className="text-xs text-muted-foreground">Bloqueado: ya seleccionaste esta plaza desde el mapa</p>
            )}
            {availablePlazasForVehicle.length === 0 && (
              <p className="text-sm text-red-600">
                No hay plazas libres para vehículos tipo {vehicleType}
              </p>
            )}
          </div>

          {/* Precio aplicado */}
          <div className="space-y-2">
            <Label htmlFor="precio">Precio aplicado ($ por {selectedModality.toLowerCase()})</Label>
            <div className="relative">
              <Input
                id="precio"
                type="number"
                value={agreedPrice}
                placeholder="Ingrese el precio"
                className="pr-10 bg-muted cursor-not-allowed"
                readOnly
                disabled
              />
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {tarifas && tarifas.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Precio estándar: ${tarifas.find(t => t.tar_nombre === selectedModality)?.tar_precio_hora.toLocaleString()} por {selectedModality.toLowerCase()}
              </p>
            )}
            {selectedPlazaData && (
              <p className="text-xs text-blue-600">
                Plaza seleccionada: {selectedPlazaData.pla_numero} - {selectedPlazaData.pla_zona}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isFormValid || loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              "Registrar Ingreso"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}