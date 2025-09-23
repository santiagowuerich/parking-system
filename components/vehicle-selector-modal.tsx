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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Vehicle } from "@/lib/types"
import { Car, Clock } from "lucide-react"

interface VehicleSelectorModalProps {
  vehicles: Vehicle[]
  isOpen: boolean
  onClose: () => void
  onSelectVehicle: (vehicle: Vehicle) => void
}

export default function VehicleSelectorModal({
  vehicles,
  isOpen,
  onClose,
  onSelectVehicle
}: VehicleSelectorModalProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("")

  const handleConfirm = () => {
    const selectedVehicle = vehicles.find(v =>
      `${v.license_plate}-${v.entry_time}` === selectedVehicleId
    )
    if (selectedVehicle) {
      onSelectVehicle(selectedVehicle)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'Moto': return '🏍️'
      case 'Camioneta': return '🚛'
      default: return '🚗'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Seleccionar Vehículo</DialogTitle>
          <DialogDescription>
            Hay {vehicles.length} vehículos estacionados. Selecciona cuál quieres procesar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle-select">Vehículo a procesar</Label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar vehículo..." />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => {
                  const vehicleId = `${vehicle.license_plate}-${vehicle.entry_time}`
                  return (
                    <SelectItem key={vehicleId} value={vehicleId}>
                      <div className="flex items-center gap-3 w-full">
                        <span className="text-lg">{getVehicleIcon(vehicle.type)}</span>
                        <div className="flex flex-col">
                          <span className="font-medium">{vehicle.license_plate}</span>
                          <span className="text-xs text-muted-foreground">
                            {vehicle.type} • Ingreso: {formatTime(vehicle.entry_time)}
                            {vehicle.plaza_number && ` • Plaza ${vehicle.plaza_number}`}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Mostrar información del vehículo seleccionado */}
          {selectedVehicleId && (
            <div className="bg-muted/50 rounded-lg p-3">
              {(() => {
                const selectedVehicle = vehicles.find(v =>
                  `${v.license_plate}-${v.entry_time}` === selectedVehicleId
                )
                if (!selectedVehicle) return null

                const entryTime = new Date(selectedVehicle.entry_time)
                const now = new Date()
                const durationMs = now.getTime() - entryTime.getTime()
                const hours = Math.floor(durationMs / (1000 * 60 * 60))
                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4" />
                      <span className="font-medium">{selectedVehicle.license_plate}</span>
                      <span className="text-sm text-muted-foreground">({selectedVehicle.type})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">
                        Tiempo estacionado: {hours}h {minutes}min
                      </span>
                    </div>
                    {selectedVehicle.plaza_number && (
                      <div className="text-sm text-muted-foreground">
                        Plaza: {selectedVehicle.plaza_number}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedVehicleId}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Procesar Egreso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}