"use client"

import { useState, useEffect, memo } from "react"
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
import { ThemeToggle } from "./theme-toggle"
import { useAuth } from "@/lib/auth-context"

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

import type { Parking, Vehicle, VehicleType, ParkingHistory, Capacity, ExitInfo as GlobalExitInfo } from "@/lib/types"
import { formatCurrency, formatTime } from "@/lib/utils"

interface OperatorPanelProps {
  parking: Parking
  availableSpaces: Capacity
  onRegisterEntry: (vehicle: Omit<Vehicle, "entry_time" | "user_id" | "id">) => void
  onRegisterExit: (licensePlate: string) => Promise<void>
  exitInfo: GlobalExitInfo | null
  setExitInfo: (info: GlobalExitInfo | null) => void
}

function OperatorPanel({
  parking,
  availableSpaces,
  onRegisterEntry,
  onRegisterExit,
  exitInfo,
  setExitInfo,
}: OperatorPanelProps) {
  const { supabase, user } = useAuth()

  const [licensePlate, setLicensePlate] = useState("")
  const [selectedType, setSelectedType] = useState<VehicleType>("Auto")
  const [error, setError] = useState("")
  const [processingExit, setProcessingExit] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
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

    const parkedOfType = parking.parkedVehicles.filter(v => v.type === selectedType).length;
    const capacityForType = parking.capacity[selectedType] || 0;
    const currentAvailableForType = Math.max(0, capacityForType - parkedOfType);

    if (currentAvailableForType <= 0) {
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

  const formatArgentineTimeWithDayjs = (dateString: string | Date): string => {
    try {
      const dateUtc = dayjs.utc(dateString);
      if (!dateUtc.isValid()) {
        return "Fecha inválida";
      }
      return dateUtc.tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm:ss A');
    } catch (error) {
      console.error("Error formateando fecha con Day.js:", error);
      return "Error de formato";
    }
  };

  const totalCapacity = Object.values(parking.capacity).reduce((sum, val) => sum + (val || 0), 0);
  const totalOccupied = parking.parkedVehicles.length;
  const totalAvailable = totalCapacity - totalOccupied;

  return (
    <div className="relative flex flex-col gap-4 p-4">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Disponibilidad de Espacios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["Auto", "Moto", "Camioneta"] as VehicleType[]).map((type) => {
              const capacityForType = parking.capacity[type] || 0;
              const occupiedForType = parking.parkedVehicles.filter(v => v.type === type).length;
              const availableForType = Math.max(0, capacityForType - occupiedForType);
              return (
                <div key={type} className="p-3 bg-gray-50 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
                  <p className="text-sm text-gray-500 dark:text-zinc-400">{type}s</p>
                  <p className="text-lg font-medium dark:text-zinc-100">
                    {occupiedForType} ocupados de {capacityForType}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">Libres: {availableForType}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-gray-100 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <p className="text-center font-medium dark:text-zinc-100">
              Total: {totalOccupied} vehículos ocupando {totalCapacity} espacios (
              {totalAvailable} libres)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Registrar Entrada</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEntrySubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licensePlate" className="dark:text-zinc-400">Matrícula</Label>
                <Input
                  id="licensePlate"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="Ej: ABC123"
                  className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleType" className="dark:text-zinc-400">Tipo de Vehículo</Label>
                <Select
                  value={selectedType}
                  onValueChange={(value: string) => setSelectedType(value as VehicleType)}
                >
                  <SelectTrigger id="vehicleType" className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
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
            <Button type="submit" className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200">
              Registrar Entrada
            </Button>
          </form>
        </CardContent>
      </Card>

      {exitInfo && (
        <Card className="dark:bg-zinc-900 dark:border-green-700">
          <CardHeader>
            <CardTitle className="flex items-center dark:text-green-400">
              <CheckCircle2 className="mr-2 h-5 w-5 text-green-600 dark:text-green-400" />
              Salida Registrada
            </CardTitle>
          </CardHeader>
          <CardContent className="dark:text-zinc-300">
            <div className="space-y-2">
              <p><strong className="dark:text-zinc-100">Matrícula:</strong> {exitInfo.license_plate}</p>
              <p><strong className="dark:text-zinc-100">Tipo:</strong> {exitInfo.type}</p>
              <p><strong className="dark:text-zinc-100">Entrada:</strong> {formatArgentineTimeWithDayjs(exitInfo.entry_time)}</p>
              <p><strong className="dark:text-zinc-100">Salida:</strong> {formatArgentineTimeWithDayjs(exitInfo.exit_time)}</p>
              <p><strong className="dark:text-zinc-100">Tiempo estacionado:</strong> {exitInfo.duration}</p>
              <p className="text-lg font-bold dark:text-white">Total a cobrar: {formatCurrency(exitInfo.fee)}</p>
              <Button onClick={() => setExitInfo(null)} className="mt-2 w-full dark:bg-zinc-700 dark:hover:bg-zinc-600">Cerrar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Vehículos Estacionados ({parking.parkedVehicles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {parking.parkedVehicles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="dark:border-zinc-700">
                  <TableHead className="dark:text-zinc-300">Matrícula</TableHead>
                  <TableHead className="dark:text-zinc-300">Tipo</TableHead>
                  <TableHead className="dark:text-zinc-300">Entrada</TableHead>
                  <TableHead className="dark:text-zinc-300">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parking.parkedVehicles.map((vehicle) => (
                  <TableRow key={vehicle.license_plate} className="dark:border-zinc-800">
                    <TableCell className="dark:text-zinc-100">{vehicle.license_plate}</TableCell>
                    <TableCell className="dark:text-zinc-400">{vehicle.type}</TableCell>
                    <TableCell className="dark:text-zinc-400">
                      {formatArgentineTimeWithDayjs(vehicle.entry_time)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleExit(vehicle)}
                        disabled={processingExit === vehicle.license_plate}
                        className="dark:bg-red-600 dark:hover:bg-red-700 dark:text-white"
                      >
                        {processingExit === vehicle.license_plate ? "Procesando..." : "Registrar Salida"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-gray-500 dark:text-zinc-400">No hay vehículos estacionados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default memo(OperatorPanel)
