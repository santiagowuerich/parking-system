"use client"

import { createBrowserClient } from "@supabase/ssr"
import { useState, useEffect } from "react"
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
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OperatorChat } from './operator-chat'

// Importar dayjs y plugins
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// Extender dayjs con los plugins
dayjs.extend(utc)
dayjs.extend(timezone)

import type { Parking, Vehicle, VehicleType, ParkingHistory } from "@/lib/types"
import { formatCurrency, formatTime } from "@/lib/utils"

interface ExitInfo {
  vehicle: Vehicle
  exitTime: Date
  duration: string
  fee: number
}

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
  onRegisterEntry: (vehicle: Omit<Vehicle, "entry_time" | "user_id">) => void
  onRegisterExit: (licensePlate: string) => Promise<void>
  exitInfo: ExitInfo | null
  setExitInfo: (info: ExitInfo | null) => void
}

export default function OperatorPanel({
  parking,
  availableSpaces,
  onRegisterEntry,
  onRegisterExit,
  exitInfo,
  setExitInfo,
}: OperatorPanelProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [licensePlate, setLicensePlate] = useState("")
  const [selectedType, setSelectedType] = useState<VehicleType>("Auto")
  const [error, setError] = useState("")
  const [processingExit, setProcessingExit] = useState<string | null>(null)
  const [showExitConfirmation, setShowExitConfirmation] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        toast.error("La sesión ha expirado. Por favor, inicie sesión nuevamente.")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!licensePlate.trim()) {
      setError("La matrícula es obligatoria")
      return
    }

    if (!selectedType) {
      setError("Debe seleccionar un tipo de vehículo")
      return
    }

    if (parking.parkedVehicles.some((v) => v.license_plate === licensePlate)) {
      setError("Ya existe un vehículo con esta matrícula en el estacionamiento")
      return
    }

    if (availableSpaces[selectedType] <= 0) {
      setError(`No hay espacios disponibles para ${selectedType}`)
      return
    }

    onRegisterEntry({
      license_plate: licensePlate,
      type: selectedType,
    })

    setLicensePlate("")
    setSelectedType("Auto")
  }

  const handleExit = async (vehicle: Vehicle) => {
    if (processingExit === vehicle.license_plate) return
    try {
      setProcessingExit(vehicle.license_plate)
      await onRegisterExit(vehicle.license_plate)
    } finally {
      setProcessingExit(null)
    }
  }

  // --- Función auxiliar con Day.js --- 
  const formatArgentineTimeWithDayjs = (dateString: string | Date): string => {
    try {
      // Asegurar que dayjs interprete la fecha como UTC si es un string ISO
      const dateUtc = dayjs.utc(dateString);
      if (!dateUtc.isValid()) {
        return "Fecha inválida";
      }
      // Convertir a la zona horaria de Argentina y formatear
      return dateUtc.tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY hh:mm:ss A');
    } catch (error) {
      console.error("Error formateando fecha con Day.js:", error);
      return "Error de formato";
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
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
              Total: {parking.parkedVehicles.length} vehículos ocupando {availableSpaces.total.capacity} espacios (
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
                  value={selectedType}
                  onValueChange={(value: string) => setSelectedType(value as VehicleType)}
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
              {exitInfo.vehicle ? (
                <>
                  <p><strong>Matrícula:</strong> {exitInfo.vehicle.license_plate}</p>
                  <p><strong>Tipo:</strong> {exitInfo.vehicle.type}</p>
                  <p><strong>Entrada:</strong> {formatArgentineTimeWithDayjs(exitInfo.vehicle.entry_time)}</p>
                  <p><strong>Salida:</strong> {formatArgentineTimeWithDayjs(exitInfo.exitTime)}</p>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Hora de Entrada</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parking.parkedVehicles.map((vehicle) => {
                  let formattedTime = formatArgentineTimeWithDayjs(vehicle.entry_time);
                  
                  return (
                    <TableRow key={vehicle.license_plate + vehicle.entry_time}>
                      <TableCell>{vehicle.license_plate}</TableCell>
                      <TableCell>{vehicle.type}</TableCell>
                      <TableCell>{formattedTime}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleExit(vehicle)}
                          disabled={processingExit === vehicle.license_plate}
                        >
                          {processingExit === vehicle.license_plate ? 'Procesando...' : 'Registrar Salida'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Espacios Disponibles */}
      {/* 
      <Card>
        <CardHeader>
          <CardTitle>Espacios Disponibles</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold">Autos</p>
            <p>{availableSpaces.Auto} / {parking.capacity.Auto}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">Motos</p>
            <p>{availableSpaces.Moto} / {parking.capacity.Moto}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">Camionetas</p>
            <p>{availableSpaces.Camioneta} / {parking.capacity.Camioneta}</p>
          </div>
        </CardContent>
      </Card>
      */}
      <OperatorChat />
    </div>
  )
}
