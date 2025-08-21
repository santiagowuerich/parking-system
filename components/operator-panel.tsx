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
import { ThemeToggle } from "./theme-toggle"
import { useAuth } from "@/lib/auth-context"

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
  onRegisterEntry: (vehicle: Omit<Vehicle, "entry_time"> & { pla_numero?: number | null }) => void
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
  const { estId } = useAuth()
  const [plaNumero, setPlaNumero] = useState<string>("")
  const [plazasStatus, setPlazasStatus] = useState<{ [seg: string]: { total: number, occupied: number, free: number, plazas: { pla_numero: number, occupied: boolean }[] } } | null>(null)
  const [selectedPlazasType, setSelectedPlazasType] = useState<{ pla_numero: number, occupied: boolean }[]>([])

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

  useEffect(() => {
    const loadPlazas = async () => {
      try {
        const res = await fetch(`/api/plazas/status?est_id=${estId}`)
        if (res.ok) {
          const js = await res.json()
          setPlazasStatus(js.byType)
          // También mantener el estado para el selector de plazas
          const seg = selectedType === 'Moto' ? 'MOT' : selectedType === 'Camioneta' ? 'CAM' : 'AUT'
          setSelectedPlazasType(js.byType?.[seg]?.plazas || [])
        }
      } catch {}
    }
    loadPlazas()
  }, [estId, selectedType])

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

    // Elegir plaza: solo si se seleccionó explícitamente, sino NULL (sin plaza asignada)
    const chosen = plaNumero ? Number(plaNumero) : null;
    
    console.log('🏁 Registrando entrada:', {
      license_plate: licensePlate,
      type: selectedType,
      pla_numero: chosen,
      plaNumeroSelected: plaNumero
    });

    onRegisterEntry({
      license_plate: licensePlate,
      type: selectedType,
      pla_numero: chosen,
    })

    setLicensePlate("")
    setSelectedType("Auto")
    setPlaNumero("") // Limpiar selección de plaza
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
    <div className="relative flex flex-col gap-4 p-4">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {/* Disponibilidad */}
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Disponibilidad de Espacios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["Auto", "Moto", "Camioneta"] as VehicleType[]).map((type) => {
              const seg = type === 'Moto' ? 'MOT' : type === 'Camioneta' ? 'CAM' : 'AUT'
              const st = plazasStatus?.[seg]
              return (
                <div key={type} className="p-3 bg-gray-50 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
                  <p className="text-sm text-gray-500 dark:text-zinc-400">{type}s</p>
                  <p className="text-lg font-medium dark:text-zinc-100">
                    {parking.capacity[type] - availableSpaces[type]} ocupados de {parking.capacity[type]}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Libres: {availableSpaces[type]}
                  </p>
                  {st && (
                    <div className="mt-3 grid grid-cols-5 gap-1 text-xs">
                      {st.plazas.map((p, index) => (
                        <span key={`${type}-${p.pla_numero || index}`} className={`w-8 h-8 flex items-center justify-center rounded text-white font-bold text-xs ${p.occupied ? 'bg-red-600' : 'bg-green-600'}`}>
                          {p.pla_numero || 'N/A'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-4 p-3 bg-gray-100 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <p className="text-center font-medium dark:text-zinc-100">
              Total: {parking.parkedVehicles.length} vehículos ocupando {availableSpaces.total.capacity} espacios (
              {availableSpaces.total.capacity - availableSpaces.total.occupied} libres)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de entrada */}
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
              <div className="space-y-2">
                <Label className="dark:text-zinc-400">Plaza (opcional)</Label>
                <Select value={plaNumero} onValueChange={(v)=> setPlaNumero(v)}>
                  <SelectTrigger className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
                    <SelectValue placeholder={selectedPlazasType.filter(p=>!p.occupied).length > 0 ? `Elegir plaza libre (${selectedPlazasType.filter(p=>!p.occupied).length} libres)` : 'Sin plazas libres'} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPlazasType.filter(p=> !p.occupied && p.pla_numero != null).map(p => (
                      <SelectItem key={`plaza-${p.pla_numero}`} value={String(p.pla_numero)}>Plaza #{p.pla_numero}</SelectItem>
                    ))}
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

      {/* Panel de "Salida Registrada" eliminado: usamos solo notificación (toast) */}

      {/* Vehículos estacionados */}
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Vehículos Estacionados</CardTitle>
        </CardHeader>
        <CardContent>
          {parking.parkedVehicles.length === 0 ? (
            <p className="text-center text-gray-500 py-4 dark:text-zinc-500">No hay vehículos estacionados actualmente</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="dark:border-zinc-800">
                  <TableHead className="dark:text-zinc-400">Matrícula</TableHead>
                  <TableHead className="dark:text-zinc-400">Tipo</TableHead>
                  <TableHead className="dark:text-zinc-400">Plaza</TableHead>
                  <TableHead className="dark:text-zinc-400">Hora de Entrada</TableHead>
                  <TableHead className="text-right dark:text-zinc-400">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parking.parkedVehicles
                  .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime())
                  .map((vehicle) => {
                  let formattedTime = formatArgentineTimeWithDayjs(vehicle.entry_time);
                  
                  return (
                    <TableRow key={vehicle.license_plate + vehicle.entry_time} className="dark:border-zinc-800">
                      <TableCell className="dark:text-zinc-100">{vehicle.license_plate}</TableCell>
                      <TableCell className="dark:text-zinc-100">{vehicle.type}</TableCell>
                      <TableCell className="dark:text-zinc-100">
                        {vehicle.plaza_number ? (
                          <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-sm">
                            Plaza {vehicle.plaza_number}
                          </span>
                        ) : (
                          <span className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded text-sm text-yellow-800 dark:text-yellow-200">
                            Sin plaza asignada
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="dark:text-zinc-100">{formattedTime}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleExit(vehicle)}
                          disabled={processingExit === vehicle.license_plate}
                          className="dark:bg-red-600 dark:hover:bg-red-700 dark:text-white"
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
      {/* <OperatorChat /> */}
    </div>
  )
}
