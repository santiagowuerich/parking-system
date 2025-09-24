"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Vehicle } from "@/lib/types"
import { Car, Clock, Search, X } from "lucide-react"
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

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
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Filtrar vehículos por término de búsqueda
  const filteredVehicles = useMemo(() => {
    if (!searchTerm.trim()) {
      return vehicles;
    }
    return vehicles.filter(vehicle =>
      vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [vehicles, searchTerm]);

  const handleConfirm = () => {
    const selectedVehicle = filteredVehicles.find(v =>
      `${v.license_plate}-${v.entry_time}` === selectedVehicleId
    )
    if (selectedVehicle) {
      onSelectVehicle(selectedVehicle)
    }
  }

  const clearSearch = () => {
    setSearchTerm("");
    setSelectedVehicleId("");
  }

  // Reset selection when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSelectedVehicleId(""); // Clear selection when searching
  }

  const formatTime = (dateString: string) => {
    return dayjs.utc(dateString).local().format('HH:mm')
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
            {searchTerm ?
              `${filteredVehicles.length} vehículo${filteredVehicles.length !== 1 ? 's' : ''} encontrado${filteredVehicles.length !== 1 ? 's' : ''} para "${searchTerm}"` :
              `Hay ${vehicles.length} vehículo${vehicles.length !== 1 ? 's' : ''} estacionado${vehicles.length !== 1 ? 's' : ''}. Selecciona cuál quieres procesar.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campo de búsqueda */}
          <div className="space-y-2">
            <Label htmlFor="search-input">Buscar por patente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-input"
                placeholder="Escribir patente..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle-select">Vehículo a procesar</Label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder={filteredVehicles.length === 0 ? "No se encontraron vehículos" : "Seleccionar vehículo..."} />
              </SelectTrigger>
              <SelectContent>
                {filteredVehicles.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {searchTerm ?
                      `No se encontró ningún vehículo con la patente "${searchTerm}"` :
                      "No hay vehículos estacionados"
                    }
                  </div>
                ) : (
                  filteredVehicles.map((vehicle) => {
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
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Mostrar información del vehículo seleccionado */}
          {selectedVehicleId && (
            <div className="bg-muted/50 rounded-lg p-3">
              {(() => {
                const selectedVehicle = filteredVehicles.find(v =>
                  `${v.license_plate}-${v.entry_time}` === selectedVehicleId
                )
                if (!selectedVehicle) return null

                const entryTime = dayjs.utc(selectedVehicle.entry_time).local()
                const now = dayjs()
                const durationMs = Math.max(0, now.diff(entryTime))
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
            disabled={!selectedVehicleId || filteredVehicles.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Procesar Egreso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}