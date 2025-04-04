"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"

import type { Parking, Vehicle, VehicleType } from "@/lib/types"
import { formatCurrency, formatTime } from "@/lib/utils"

interface OperatorPanelProps {
  parking: Parking
  availableSpaces: {
    Auto: number
    Moto: number
    Camioneta: number
    total: {
      capacity: number
      occupied: number
    }
  }
  onRegisterEntry: (vehicle: Omit<Vehicle, "entryTime">) => void
  onRegisterExit: (licensePlate: string) => any
}

export default function OperatorPanel({
  parking,
  availableSpaces,
  onRegisterEntry,
  onRegisterExit,
}: OperatorPanelProps) {
  const [licensePlate, setLicensePlate] = useState("")
  const [vehicleType, setVehicleType] = useState<VehicleType | "">("")
  const [error, setError] = useState("")
  const [exitInfo, setExitInfo] = useState<any>(null)

  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!licensePlate.trim()) {
      setError("La matrícula es obligatoria")
      return
    }

    if (!vehicleType) {
      setError("Debe seleccionar un tipo de vehículo")
      return
    }

    if (parking.parkedVehicles.some((v) => v.licensePlate === licensePlate)) {
      setError("Ya existe un vehículo con esta matrícula en el estacionamiento")
      return
    }

    if (availableSpaces[vehicleType as VehicleType] <= 0) {
      setError(`No hay espacios disponibles para ${vehicleType}`)
      return
    }

    onRegisterEntry({
      licensePlate,
      type: vehicleType as VehicleType,
    })

    setLicensePlate("")
    setVehicleType("")
  }

  const handleExit = (licensePlate: string) => {
    const result = onRegisterExit(licensePlate)
    if (result) {
      setExitInfo(result)
    }
  }

  return (
    <div className="space-y-6">
      {/* Disponibilidad */}
      <Card>
        <CardHeader>
          <CardTitle>Disponibilidad de Espacios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["Auto", "Moto", "Camioneta"] as VehicleType[]).map((type) => (
              <div key={type} className="p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-500">{type}s</p>
                <p className="text-lg font-medium">
                  {parking.capacity[type] - availableSpaces[type]} ocupados de {parking.capacity[type]}
                </p>
                <p className="text-sm text-green-600">Libres: {availableSpaces[type]}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-gray-100 rounded-md">
            <p className="text-center font-medium">
              Total: {availableSpaces.total.occupied} vehículos ocupando {availableSpaces.total.capacity} espacios (
              {availableSpaces.total.capacity - availableSpaces.total.occupied} libres)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de entrada */}
      <Card>
        <CardHeader>
          <CardTitle>Registrar Entrada</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEntrySubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licensePlate">Matrícula</Label>
                <Input
                  id="licensePlate"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="Ej: ABC123"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleType">Tipo de Vehículo</Label>
                <Select
                  value={vehicleType}
                  onValueChange={(value: string) => setVehicleType(value as VehicleType)}
                >
                  <SelectTrigger id="vehicleType">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Auto">Auto</SelectItem>
                    <SelectItem value="Moto">Moto</SelectItem>
                    <SelectItem value="Camioneta">Camioneta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full">
              Registrar Entrada
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Salida */}
      {exitInfo && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle2 className="mr-2 h-5 w-5 text-green-600" />
              Salida Registrada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {exitInfo?.vehicle ? (
                <>
                  <p><strong>Matrícula:</strong> {exitInfo.vehicle.licensePlate}</p>
                  <p><strong>Tipo:</strong> {exitInfo.vehicle.type}</p>
                  <p><strong>Entrada:</strong> {formatTime(exitInfo.vehicle.entryTime)}</p>
                  <p><strong>Salida:</strong> {formatTime(exitInfo.exitTime)}</p>
                  <p><strong>Tiempo estacionado:</strong> {exitInfo.duration}</p>
                  <p className="text-lg font-bold">Total a cobrar: {formatCurrency(exitInfo.fee)}</p>
                  {exitInfo.duration.includes("min") && !exitInfo.duration.includes("h") && (
                    <p className="text-sm text-amber-600">Nota: Se cobra mínimo 1 hora de estacionamiento.</p>
                  )}
                </>
              ) : (
                <p className="text-gray-500">No hay información del vehículo.</p>
              )}
              <Button variant="outline" className="mt-4 w-full" onClick={() => setExitInfo(null)}>
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehículos estacionados */}
      <Card>
        <CardHeader>
          <CardTitle>Vehículos Estacionados</CardTitle>
        </CardHeader>
        <CardContent>
          {parking.parkedVehicles.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No hay vehículos estacionados actualmente</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Matrícula</th>
                    <th className="text-left py-2 px-2">Tipo</th>
                    <th className="text-left py-2 px-2">Hora de Entrada</th>
                    <th className="text-left py-2 px-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {parking.parkedVehicles.map((vehicle) => (
                    <tr key={vehicle.licensePlate} className="border-b">
                      <td className="py-2 px-2">{vehicle.licensePlate}</td>
                      <td className="py-2 px-2">{vehicle.type}</td>
                      <td className="py-2 px-2">{formatTime(vehicle.entryTime)}</td>
                      <td className="py-2 px-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleExit(vehicle.licensePlate)}
                        >
                          Registrar Salida
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
