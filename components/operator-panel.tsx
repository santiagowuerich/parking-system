"use client"

import { createBrowserClient } from "@supabase/ssr"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OperatorChat } from './operator-chat'
import { ThemeToggle } from "./theme-toggle"
import { useAuth } from "@/lib/auth-context"
import { ZonaEstacionamiento } from "./ZonaEstacionamiento"
import { SimpleVehicleList } from "./SimpleVehicleList"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Settings } from 'lucide-react'
import { ParkingDataTable, type Column, type ActionButton } from "@/components/ui/parking-data-table"
import { FormField } from "@/components/ui/form-field"

// Importar dayjs y plugins
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// Extender dayjs con los plugins
dayjs.extend(utc)
dayjs.extend(timezone)

import type { Parking, Vehicle, VehicleType, ParkingHistory, VehicleEntryData } from "@/lib/types"
import { formatCurrency, formatTime } from "@/lib/utils"

interface ExitInfo {
  vehicle: Vehicle
  exitTime: Date
  duration: string
  fee: number
  agreedPrice?: number
  calculatedFee?: number
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
  onRegisterEntry: (vehicle: VehicleEntryData) => void
  onRegisterExit: (licensePlate: string) => Promise<void>
  exitInfo: ExitInfo | null
  setExitInfo: (info: ExitInfo | null) => void
  // Datos del sistema híbrido
  plazasData: any // Datos de la API híbrida
  loadingPlazas: boolean
  fetchPlazasStatus: () => void
  onConfigureZones?: () => void
  // Nuevas props para visualización rica
  plazasCompletas?: any[]
  loadingPlazasCompletas?: boolean
  getEstadoColor?: (estado: string) => string
  getEstadoIcon?: (estado: string) => string
}

export default function OperatorPanel({
  parking,
  availableSpaces,
  onRegisterEntry,
  onRegisterExit,
  exitInfo,
  setExitInfo,
  plazasData,
  loadingPlazas,
  fetchPlazasStatus,
  onConfigureZones,
  plazasCompletas = [],
  loadingPlazasCompletas = false,
  getEstadoColor,
  getEstadoIcon,
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
  const [selectedPlaza, setSelectedPlaza] = useState<any>(null)

  // Nueva funcionalidad: Selección de duración mínima
  const [selectedDuration, setSelectedDuration] = useState<string>("hora")
  const [agreedPrice, setAgreedPrice] = useState<number | null>(null)
  const [showDurationSelector, setShowDurationSelector] = useState(false)

  // Filtros para la tabla de vehículos estacionados
  const [filterPlate, setFilterPlate] = useState<string>("")
  const [filterVehicleType, setFilterVehicleType] = useState<VehicleType | 'Todos'>("Todos")

  // El AuthContext ya maneja todos los eventos de autenticación
  // No necesitamos duplicar onAuthStateChange aquí

  // Función reutilizable para recargar el estado de plazas
  const reloadPlazas = async () => {
    try {
      const res = await fetch(`/api/plazas/status?est_id=${estId}`)
      if (res.ok) {
        const js = await res.json()
        setPlazasStatus(js.byType)
        // También mantener el estado para el selector de plazas
        const seg = selectedType === 'Moto' ? 'MOT' : selectedType === 'Camioneta' ? 'CAM' : 'AUT'
        setSelectedPlazasType(js.byType?.[seg]?.plazas || [])
      }
    } catch { }
  }

  // Cargar al iniciar y al cambiar estacionamiento o tipo seleccionado
  useEffect(() => { reloadPlazas() }, [estId, selectedType])

  // Calcular precio acordado cuando cambie duración o tipo de vehículo
  useEffect(() => {
    const calculatePrice = async () => {
      if (selectedType && selectedDuration) {
        const price = await calculateAgreedPrice(selectedDuration, selectedType);
        setAgreedPrice(price);
      }
    };

    calculatePrice();
  }, [selectedDuration, selectedType]);

  // Refrescar automáticamente cuando cambia la cantidad de vehículos estacionados
  useEffect(() => { reloadPlazas() }, [parking.parkedVehicles.length])

  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!licensePlate.trim()) {
      setError("La matrícula es obligatoria")
      return
    }

    if (parking.parkedVehicles.some((v) => v.license_plate === licensePlate)) {
      setError("Ya existe un vehículo con esta matrícula en el estacionamiento")
      return
    }

    // Ahora es obligatorio seleccionar una plaza
    if (!selectedPlaza) {
      setError("Debe seleccionar una plaza")
      return
    }

    // Verificar que la plaza esté realmente libre
    if (selectedPlaza.pla_estado !== 'Libre') {
      setError(`La plaza ${selectedPlaza.pla_numero} ya no está disponible`)
      return
    }

    // El tipo de vehículo se determina automáticamente por la plaza
    const chosen = selectedPlaza.pla_numero;

    if (!chosen || chosen <= 0) {
      setError("Número de plaza inválido")
      return
    }

    console.log('🏁 Registrando entrada:', {
      license_plate: licensePlate,
      type: selectedType,
      pla_numero: chosen,
      plaNumeroSelected: plaNumero,
      selectedPlaza: selectedPlaza
    });

    onRegisterEntry({
      license_plate: licensePlate,
      type: selectedType,
      pla_numero: chosen,
      duracion_tipo: selectedDuration,
      precio_acordado: agreedPrice || 0,
    })

    // Limpiar formulario
    setLicensePlate("")
    setSelectedType("Auto")
    setPlaNumero("")
    setSelectedPlaza(null)
    setShowDurationSelector(false)
    setAgreedPrice(null)
    setSelectedDuration("hora")
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

  // Obtener plazas libres para el selector
  const getPlazasLibres = () => {
    if (!plazasCompletas || plazasCompletas.length === 0) return [];

    return plazasCompletas.filter(plaza =>
      plaza.pla_estado === 'Libre' && plaza.pla_numero != null
    ).sort((a, b) => a.pla_numero - b.pla_numero);
  };

  // Función para manejar selección de plaza
  const handlePlazaSelection = (plazaNumero: string) => {
    setPlaNumero(plazaNumero);

    if (plazaNumero) {
      // Encontrar la plaza seleccionada
      const plaza = plazasCompletas.find(p => p.pla_numero === Number(plazaNumero));
      setSelectedPlaza(plaza);

      if (plaza) {
        // Si la plaza tiene plantilla, usar el tipo de vehículo de la plantilla
        if (plaza.plantillas && plaza.plantillas.catv_segmento) {
          const tipoVehiculo = mapearTipoVehiculo(plaza.plantillas.catv_segmento);
          setSelectedType(tipoVehiculo);
        }
        // Si no tiene plantilla, usar el tipo de vehículo de la plaza
        else if (plaza.catv_segmento) {
          const tipoVehiculo = mapearTipoVehiculo(plaza.catv_segmento);
          setSelectedType(tipoVehiculo);
        }

        // Activar selector de duración cuando se selecciona una plaza
        setShowDurationSelector(true);
      }
    } else {
      setSelectedPlaza(null);
      setShowDurationSelector(false);
      setAgreedPrice(null);
    }
  };

  // Mapear códigos de BD a tipos frontend
  const mapearTipoVehiculo = (segmento: string): VehicleType => {
    switch (segmento) {
      case 'MOT': return 'Moto';
      case 'CAM': return 'Camioneta';
      case 'AUT':
      default: return 'Auto';
    }
  };

  // Calcular precio acordado basado en duración seleccionada
  const calculateAgreedPrice = async (duration: string, vehicleType: VehicleType): Promise<number> => {
    if (!estId) return 0;

    try {
      // Obtener tarifas del estacionamiento
      const { data: rates, error } = await supabase
        .from('tarifas')
        .select('*')
        .eq('est_id', estId);

      if (error || !rates || rates.length === 0) {
        console.error('Error obteniendo tarifas:', error);
        return 0;
      }

      // Mapear tipo de vehículo frontend a BD
      const vehicleTypeMapping = {
        'Auto': 'AUT',
        'Moto': 'MOT',
        'Camioneta': 'CAM'
      };

      const dbVehicleType = vehicleTypeMapping[vehicleType] || 'AUT';

      // Calcular duración en horas
      let durationHours = 1; // mínimo 1 hora
      switch (duration) {
        case 'hora':
          durationHours = 1;
          break;
        case 'dia':
          durationHours = 24;
          break;
        case 'semana':
          durationHours = 24 * 7; // 168 horas
          break;
        case 'mes':
          durationHours = 24 * 30; // 720 horas (aproximado)
          break;
        default:
          durationHours = 1;
      }

      // Buscar tarifa por tipo de vehículo
      const vehicleRate = rates.find((r: any) => {
        const rateSegmento = r.catv_segmento;
        return rateSegmento === dbVehicleType;
      });

      if (!vehicleRate) {
        console.error('No se encontró tarifa para el tipo de vehículo:', dbVehicleType);
        return 0;
      }

      // Calcular precio: precio base + (horas adicionales * precio por fracción)
      const basePrice = parseFloat(vehicleRate.tar_precio) || 0;
      const hourlyRate = parseFloat(vehicleRate.tar_fraccion) || 0;

      let totalPrice = 0;
      if (durationHours <= 1) {
        totalPrice = basePrice;
      } else {
        totalPrice = basePrice + (hourlyRate * (durationHours - 1));
      }

      return Math.max(totalPrice, basePrice); // Asegurar precio mínimo
    } catch (error) {
      console.error('Error calculando precio acordado:', error);
      return 0;
    }
  };

  // Crear visualización rica de zonas usando plazasCompletas
  const crearVisualizacionRica = () => {
    if (!plazasCompletas || plazasCompletas.length === 0) return null;

    // Agrupar plazas por zona
    const plazasPorZona = plazasCompletas.reduce((acc: Record<string, any[]>, plaza: any) => {
      const zonaNombre = plaza.pla_zona || 'Sin Zona';
      if (!acc[zonaNombre]) {
        acc[zonaNombre] = [];
      }
      acc[zonaNombre].push(plaza);
      return acc;
    }, {} as Record<string, any[]>);

    return (
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex justify-between items-center px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-600"></div>Libre
              </span>
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-600"></div>Ocupado
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchPlazasStatus}>
              Actualizar
            </Button>
          </div>

          {Object.entries(plazasPorZona).map(([zonaNombre, plazasZona]) => {
            const plazasPorFila = 10;
            const filas = [];

            // Ordenar plazas por número
            plazasZona.sort((a, b) => a.pla_numero - b.pla_numero);

            for (let i = 0; i < plazasZona.length; i += plazasPorFila) {
              filas.push(plazasZona.slice(i, i + plazasPorFila));
            }

            const estadisticasZona = {
              total: plazasZona.length,
              libres: plazasZona.filter(p => p.pla_estado === 'Libre').length,
              ocupadas: plazasZona.filter(p => p.pla_estado === 'Ocupada').length
            };

            return (
              <div key={zonaNombre} className="border rounded-lg p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold dark:text-zinc-100">🏗️ {zonaNombre}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {estadisticasZona.libres}/{estadisticasZona.total} libres
                    </Badge>
                    <Badge variant="outline">
                      {((estadisticasZona.ocupadas / estadisticasZona.total) * 100).toFixed(0)}% ocupadas
                    </Badge>
                    {onConfigureZones && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/dashboard/configuracion-zona?zona=${encodeURIComponent(zonaNombre)}`}
                        className="flex items-center gap-1"
                      >
                        <Settings className="h-3 w-3" />
                        Configurar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {filas.map((fila, filaIndex) => (
                    <div key={filaIndex} className="flex gap-2 justify-center">
                      {fila.map(plaza => (
                        <Tooltip key={plaza.pla_numero}>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md transition-colors duration-200 relative cursor-pointer ${getEstadoColor ? getEstadoColor(plaza.pla_estado) : 'bg-gray-400'
                                } ${plaza.plantillas ? 'ring-2 ring-blue-300' : ''}`}
                              onClick={() => {
                                if (plaza.pla_estado === 'Libre') {
                                  setPlaNumero(String(plaza.pla_numero));
                                  toast.success(`Plaza ${plaza.pla_numero} seleccionada`, {
                                    description: "Completa la patente y el tipo de vehículo para registrar la entrada.",
                                  });
                                }
                              }}
                            >
                              <span className="text-xs">{plaza.pla_numero}</span>
                              {plaza.plantillas && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">P</span>
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-2">
                              <div className="font-semibold">Plaza #{plaza.pla_numero}</div>
                              <div className="text-sm">
                                <span className="font-medium">Estado:</span> {plaza.pla_estado}
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">Tipo:</span> {plaza.catv_segmento}
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">Zona:</span> {plaza.pla_zona || 'Sin zona'}
                              </div>
                              {plaza.plantillas && (
                                <div className="border-t pt-2 mt-2">
                                  <div className="text-sm font-medium text-blue-600 mb-1">📋 Plantilla Asignada</div>
                                  <div className="text-sm">
                                    <span className="font-medium">Nombre:</span> {plaza.plantillas.nombre_plantilla}
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium">Tipo Vehículo:</span> {plaza.plantillas.catv_segmento}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className="relative flex flex-col gap-4 p-4">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {/* Sistema Híbrido: Vista Simple vs Zonas */}
      {loadingPlazas || loadingPlazasCompletas ? (
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Cargando...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          </CardContent>
        </Card>
      ) : plazasCompletas && plazasCompletas.length > 0 ? (
        // VISTA RICA: Con información completa de plantillas y tooltips
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Visualización de Plazas</CardTitle>
          </CardHeader>
          <CardContent>
            {crearVisualizacionRica()}
          </CardContent>
        </Card>
      ) : plazasData?.mode === 'simple' ? (
        // VISTA SIMPLE: Sin zonas configuradas (fallback)
        <SimpleVehicleList
          stats={plazasData.stats}
          plazas={plazasData.plazas || []}
          vehiculos={plazasData.vehiculos || []}
          onPlazaClick={(plaza) => {
            if (!plaza.ocupado) {
              setPlaNumero(String(plaza.numero));
              toast.success(`Plaza ${plaza.numero} seleccionada`, {
                description: "Completa la patente y el tipo de vehículo para registrar la entrada.",
              });
            }
          }}
          onConfigureZones={onConfigureZones}
          showConfigureButton={true}
        />
      ) : (
        // VISTA POR ZONAS: Zonas configuradas (fallback)
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Disponibilidad por Zonas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-600"></div>Libre
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-600"></div>Ocupado
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={fetchPlazasStatus}>
                  Actualizar
                </Button>
              </div>
              {plazasData?.zonas?.length > 0 ? plazasData.zonas.map((zona: any) => (
                <ZonaEstacionamiento
                  key={zona.nombre}
                  zona={zona}
                  onPlazaClick={(plaza) => {
                    if (plaza.ocupado) {
                      toast.info(`Plaza ${plaza.numero} está ocupada`, {
                        description: "Busca el vehículo en la tabla de abajo para darle salida.",
                      });
                    } else {
                      setPlaNumero(String(plaza.numero));
                      toast.success(`Plaza ${plaza.numero} seleccionada`, {
                        description: "Completa la patente y el tipo de vehículo para registrar la entrada.",
                      });
                    }
                  }}
                />
              )) : (
                <p className="text-center text-zinc-500 py-8">
                  No hay zonas o plazas configuradas para este estacionamiento.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
              <FormField
                id="licensePlate"
                label="Matrícula"
                value={licensePlate}
                onChange={setLicensePlate}
                placeholder="Ej: ABC123"
              />

              <div className="space-y-2">
                <Label className="dark:text-zinc-400">Seleccionar Plaza (determina el tipo de vehículo)</Label>
                <Select value={plaNumero} onValueChange={handlePlazaSelection}>
                  <SelectTrigger className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
                    <SelectValue placeholder={getPlazasLibres().length > 0 ? `Elegir plaza (${getPlazasLibres().length} disponibles)` : 'No hay plazas libres'} />
                  </SelectTrigger>
                  <SelectContent>
                    {getPlazasLibres().map(plaza => (
                      <SelectItem key={`plaza-${plaza.pla_numero}`} value={String(plaza.pla_numero)}>
                        <div className="flex items-center gap-2">
                          <span>Plaza #{plaza.pla_numero}</span>
                          {plaza.plantillas && (
                            <Badge variant="secondary" className="text-xs">
                              {mapearTipoVehiculo(plaza.plantillas.catv_segmento)} - {plaza.plantillas.nombre_plantilla}
                            </Badge>
                          )}
                          {!plaza.plantillas && plaza.catv_segmento && (
                            <Badge variant="outline" className="text-xs">
                              {mapearTipoVehiculo(plaza.catv_segmento)}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPlaza && (
                  <p className="text-xs text-blue-400">
                    Tipo de vehículo: {selectedType}
                    {selectedPlaza.plantillas && ` (plantilla: ${selectedPlaza.plantillas.nombre_plantilla})`}
                  </p>
                )}
              </div>

              {/* Selector de duración mínima */}
              {showDurationSelector && (
                <div className="space-y-2">
                  <Label className="dark:text-zinc-400">Duración Mínima</Label>
                  <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                    <SelectTrigger className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
                      <SelectValue placeholder="Seleccionar duración" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hora">1 Hora</SelectItem>
                      <SelectItem value="dia">1 Día (24 horas)</SelectItem>
                      <SelectItem value="semana">1 Semana (7 días)</SelectItem>
                      <SelectItem value="mes">1 Mes (30 días)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200"
              disabled={!selectedPlaza}
            >
              {selectedPlaza ? `Registrar Entrada en Plaza ${selectedPlaza.pla_numero}` : 'Seleccionar Plaza para Continuar'}
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
          {/* Controles de búsqueda y filtros */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="dark:text-zinc-400">Buscar patente</Label>
              <Input
                value={filterPlate}
                onChange={(e) => setFilterPlate(e.target.value)}
                placeholder="Ej: ABC123"
                className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
              />
            </div>
            <div className="space-y-1">
              <Label className="dark:text-zinc-400">Filtrar por tipo</Label>
              <Select value={filterVehicleType} onValueChange={(v) => setFilterVehicleType(v as any)}>
                <SelectTrigger className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
                  <SelectValue placeholder="Tipo de vehículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="Auto">Auto</SelectItem>
                  <SelectItem value="Moto">Moto</SelectItem>
                  <SelectItem value="Camioneta">Camioneta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ParkingDataTable
            data={parking.parkedVehicles
              .filter(v => (filterVehicleType === 'Todos' || v.type === filterVehicleType) &&
                (!filterPlate || v.license_plate.toLowerCase().includes(filterPlate.toLowerCase())))
              .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime())
              .map(vehicle => ({
                id: vehicle.license_plate + vehicle.entry_time,
                license_plate: vehicle.license_plate,
                type: vehicle.type,
                plaza: vehicle.plaza_number ? (
                  <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-sm">
                    Plaza {vehicle.plaza_number}
                  </span>
                ) : (
                  <span className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded text-sm text-yellow-800 dark:text-yellow-200">
                    Sin plaza asignada
                  </span>
                ),
                entry_time: formatArgentineTimeWithDayjs(vehicle.entry_time),
                tariff: <span className="text-xs text-gray-500">Pendiente</span>
              }))}
            columns={[
              { key: 'license_plate', label: 'Matrícula' },
              { key: 'type', label: 'Tipo' },
              { key: 'plaza', label: 'Plaza' },
              { key: 'entry_time', label: 'Hora de Entrada' },
              { key: 'tariff', label: 'Tarifa Acordada' }
            ]}
            actions={[
              {
                icon: processingExit === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Salida',
                onClick: handleExit,
                title: "Registrar Salida",
                variant: 'destructive',
                className: "dark:bg-red-600 dark:hover:bg-red-700 dark:text-white"
              }
            ]}
            emptyMessage="No hay vehículos estacionados actualmente"
          />
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
