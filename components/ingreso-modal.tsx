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
    plaza_type: string
    modality: string
    agreed_price: number
  }) => Promise<void>
  loading?: boolean
  tarifas?: Tarifa[]
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
  tarifas = []
}: IngresoModalProps) {
  const [licensePlate, setLicensePlate] = useState("")
  const [vehicleType, setVehicleType] = useState<VehicleType>("Auto")
  const [selectedModality, setSelectedModality] = useState<string>("Hora")
  const [agreedPrice, setAgreedPrice] = useState<number>(0)

  // Set vehicle type based on plaza and initialize when modal opens
  useEffect(() => {
    if (isOpen && plaza) {
      const defaultType = mapearTipoVehiculo(plaza.catv_segmento)
      setVehicleType(defaultType)

      // Reset other fields
      setLicensePlate("")

      // Set default modality and price based on available tariffs
      let defaultModality = "Hora"
      let defaultPrice = 1200 // Fallback

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
  }, [isOpen, plaza, tarifas])

  // Update price when modality changes
  useEffect(() => {
    if (tarifas && tarifas.length > 0) {
      const tarifa = tarifas.find(t => t.tar_nombre === selectedModality)
      if (tarifa) {
        setAgreedPrice(tarifa.tar_precio_hora)
      }
    }
  }, [selectedModality, tarifas])

  const handleConfirm = async () => {
    if (!licensePlate.trim()) return

    try {
      await onConfirm({
        license_plate: licensePlate.trim(),
        type: vehicleType,
        modality: selectedModality,
        agreed_price: agreedPrice
      })
      onClose()
    } catch (error) {
      console.error('Error registering entry:', error)
    }
  }

  if (!plaza) return null

  const isFormValid = licensePlate.trim().length > 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Ingreso</DialogTitle>
          <DialogDescription>
            Registrar nuevo vehículo en plaza {plaza.pla_numero}
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

          {/* Tipo de vehículo */}
          <div className="space-y-2">
            <Label htmlFor="vehicle-type">Tipo de vehículo</Label>
            <Select value={vehicleType} onValueChange={(value: VehicleType) => setVehicleType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Auto">🚗 Auto</SelectItem>
                <SelectItem value="Moto">🏍️ Moto</SelectItem>
                <SelectItem value="Camioneta">🚛 Camioneta</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Plaza asignada */}
          <div className="space-y-2">
            <Label htmlFor="plaza-assigned">Plaza asignada</Label>
            <div className="relative">
              <Input
                id="plaza-assigned"
                value={`Plaza ${plaza.pla_numero} - ${plaza.pla_zona || 'Sin zona'}`}
                readOnly
                className="bg-muted"
              />
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Precio aplicado */}
          <div className="space-y-2">
            <Label htmlFor="precio">Precio aplicado ($ por {selectedModality.toLowerCase()})</Label>
            <div className="relative">
              <Input
                id="precio"
                type="number"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(parseFloat(e.target.value) || 0)}
                placeholder="Ingrese el precio"
                className="pr-10"
              />
              <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {tarifas && tarifas.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Precio estándar: ${tarifas.find(t => t.tar_nombre === selectedModality)?.tar_precio_hora.toLocaleString()} por {selectedModality.toLowerCase()}
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