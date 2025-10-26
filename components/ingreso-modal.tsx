"use client"

import { useState, useEffect, useMemo } from "react"
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
import { VehicleType, VehiculoAbonado } from "@/lib/types"
import { Loader2, Lock, AlertCircle } from "lucide-react"
import { Plaza } from "@/components/Plaza"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTurnos } from "@/lib/hooks/use-turnos"
import { toast } from "@/components/ui/use-toast"

interface PlazaCompleta {
  pla_numero: number
  pla_estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento'
  pla_zona: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
  abono?: {
    abo_nro: number
    abo_tipoabono: string
    abonado?: {
      abon_nombre: string
      abon_apellido: string
      abon_dni: string
    }
    vehiculos?: VehiculoAbonado[]
  } | null
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
    isAbono?: boolean
    abono_nro?: number
  }) => Promise<void>
  loading?: boolean
  tarifas?: Tarifa[]
  availablePlazas?: PlazaCompleta[]
  onPlazaChange?: (plantillaId: number | null) => Promise<Tarifa[]>
  reserva?: any | null // ReservaConDetalles - NUEVO para reservas
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
  availablePlazas = [],
  onPlazaChange,
  reserva = null
}: IngresoModalProps) {
  const [licensePlate, setLicensePlate] = useState("")
  const [vehicleType, setVehicleType] = useState<VehicleType>("Auto")
  const [selectedPlaza, setSelectedPlaza] = useState<number | null>(null)
  const [selectedModality, setSelectedModality] = useState<string>("Hora")
  const [agreedPrice, setAgreedPrice] = useState<number>(0)
  const [selectedAbonoVehicle, setSelectedAbonoVehicle] = useState<string>("")
  const [selectedZona, setSelectedZona] = useState<string>("")

  const [matchedAbonoPlaza, setMatchedAbonoPlaza] = useState<PlazaCompleta | null>(null)

  // Estados para manejo de reservas
  const [selectedReservaVehicle, setSelectedReservaVehicle] = useState<string>("")

  // Verificación de turno activo
  const { puedeOperar, isEmployee } = useTurnos()
  const abonoSource = matchedAbonoPlaza?.abono || plaza?.abono || null
  const abonoVehicles: VehiculoAbonado[] = useMemo(() => {
    return (abonoSource?.vehiculos || []).filter(
      (vehiculo): vehiculo is VehiculoAbonado => Boolean(vehiculo?.veh_patente)
    );
  }, [abonoSource])
  const isAbono = abonoVehicles.length > 0

  // Lógica para reservas
  const reservaVehicles = useMemo(() => {
    return (reserva?.vehiculos || []).filter(
      (vehiculo: any) => Boolean(vehiculo?.veh_patente)
    );
  }, [reserva])
  const isReserva = Boolean(reserva && reservaVehicles.length > 0)

  const computeDefaultTariff = () => {
    let defaultModality = "Hora"
    let defaultPrice = 200

    if (tarifas && tarifas.length > 0) {
      const horaTarifa = tarifas.find(t => t.tar_nombre.toLowerCase().includes('hora'))
      if (horaTarifa) {
        defaultModality = horaTarifa.tar_nombre
        defaultPrice = horaTarifa.tar_precio_hora
      } else {
        defaultModality = tarifas[0].tar_nombre
        defaultPrice = tarifas[0].tar_precio_hora
      }
    }

    return { defaultModality, defaultPrice }
  }

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
    if (isAbono) {
      const sourcePlaza = matchedAbonoPlaza || plaza
      return sourcePlaza ? [sourcePlaza] : []
    }

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

  const handleAbonoVehicleSelect = (value: string) => {
    if (value === '__manual__') {
      setMatchedAbonoPlaza(null)
      setSelectedAbonoVehicle("")
      setLicensePlate("")
      setSelectedPlaza(null)
      const { defaultModality, defaultPrice } = computeDefaultTariff()
      setSelectedModality(defaultModality)
      setAgreedPrice(defaultPrice)
      return
    }

    const normalized = value.toUpperCase()
    setSelectedAbonoVehicle(normalized)
    setLicensePlate(normalized)

    const vehiculoSeleccionado = abonoVehicles.find(
      v => v.veh_patente?.toUpperCase() === normalized
    )
    if (vehiculoSeleccionado?.catv_segmento) {
      setVehicleType(mapearTipoVehiculo(vehiculoSeleccionado.catv_segmento))
    }
  }

  // Handler para selección de vehículos de reserva
  const handleReservaVehicleSelect = (value: string) => {
    const normalized = value.toUpperCase()
    setSelectedReservaVehicle(normalized)
    setLicensePlate(normalized)

    const vehiculoSeleccionado = reservaVehicles.find(
      (v: any) => v.veh_patente?.toUpperCase() === normalized
    )

    if (vehiculoSeleccionado?.catv_segmento) {
      const tipoVehiculo = mapearTipoVehiculo(vehiculoSeleccionado.catv_segmento)
      const tipoPlaza = mapearTipoVehiculo(plaza?.catv_segmento || 'AUT')

      // Validar que el tipo de vehículo coincida con la plaza
      if (tipoVehiculo !== tipoPlaza) {
        toast({
          variant: "destructive",
          title: "Tipo de vehículo incompatible",
          description: `La plaza es para ${tipoPlaza}, pero el vehículo seleccionado es ${tipoVehiculo}`
        })
        // Revertir selección
        setSelectedReservaVehicle("")
        setLicensePlate("")
        return
      }

      setVehicleType(tipoVehiculo)
    }
  }

  // Verificar turno activo al abrir modal (solo para empleados)
  useEffect(() => {
    if (isOpen && isEmployee && !puedeOperar()) {
      toast({
        variant: "destructive",
        title: "Turno no iniciado",
        description: "Debes abrir tu turno antes de registrar ingresos"
      });
      onClose();
    }
  }, [isOpen, isEmployee, puedeOperar, onClose]);

  // Initialize when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSelectedZona(""); // Reset zona cuando se cierra
      setSelectedReservaVehicle(""); // Reset reserva vehicle
      return;
    }

    setMatchedAbonoPlaza(null)

    // Inicializar para RESERVAS
    if (reserva && reservaVehicles.length > 0) {
      const defaultVehicle = reservaVehicles.find((v: any) => v.veh_patente === reserva.veh_patente)
        || reservaVehicles[0]
      const defaultPlate = defaultVehicle?.veh_patente?.toUpperCase() || ""
      setSelectedReservaVehicle(defaultPlate)
      setLicensePlate(defaultPlate)

      const segmentoPreferido = defaultVehicle?.catv_segmento || plaza?.catv_segmento || 'AUT'
      setVehicleType(mapearTipoVehiculo(segmentoPreferido))

      setSelectedPlaza(plaza?.pla_numero ?? null)
      setSelectedModality("Hora") // Las reservas usan tarifa normal
      setAgreedPrice(reserva.res_monto || 0)
    }
    // Inicializar para ABONOS
    else if (plaza?.abono) {
      const defaultVehicle = plaza.abono.vehiculos?.[0]
      const defaultPlate = defaultVehicle?.veh_patente?.toUpperCase() || ""
      setSelectedAbonoVehicle(defaultPlate)
      setLicensePlate(defaultPlate)

      const segmentoPreferido = defaultVehicle?.catv_segmento || plaza.catv_segmento || 'AUT'
      setVehicleType(mapearTipoVehiculo(segmentoPreferido))

      setSelectedPlaza(plaza.pla_numero ?? null)
      setSelectedModality("Abono")
      setAgreedPrice(0)
    }
    // Inicializar para INGRESO NORMAL
    else {
      setSelectedAbonoVehicle("")
      setSelectedReservaVehicle("")
      setLicensePlate("")

      if (plaza) {
        const vehicleTypeFromPlaza = mapearTipoVehiculo(plaza.catv_segmento)
        setVehicleType(vehicleTypeFromPlaza)
        setSelectedPlaza(plaza.pla_numero)

        // Si hay plaza preseleccionada, calcular precio
        const { defaultModality, defaultPrice } = computeDefaultTariff()
        setSelectedModality(defaultModality)
        setAgreedPrice(defaultPrice)
      } else {
        setVehicleType("Auto")
        setSelectedPlaza(null)
        // SIN plaza seleccionada = SIN precio
        setSelectedModality("Hora")
        setAgreedPrice(0)
      }
    }
  }, [isOpen, plaza, reserva])

  // Update selected plaza when vehicle type changes
  useEffect(() => {
    if (isAbono || isReserva) return

    // Solo resetear la plaza si no hay una plaza preseleccionada
    // o si la plaza preseleccionada no es compatible con el nuevo tipo de vehículo
    if (!plaza || mapearTipoVehiculo(plaza.catv_segmento) !== vehicleType) {
      setSelectedPlaza(null)
    }
  }, [vehicleType, plaza, isAbono, isReserva])

  // Update price when modality changes
  useEffect(() => {
    if (isAbono || isReserva) return

    if (tarifas && tarifas.length > 0) {
      // Buscar tarifa por nombre exacto o por coincidencia parcial
      const tarifa = tarifas.find(t => t.tar_nombre === selectedModality) ||
        tarifas.find(t => t.tar_nombre.toLowerCase().includes(selectedModality.toLowerCase()))
      if (tarifa) {
        setAgreedPrice(tarifa.tar_precio_hora)
      }
    }
  }, [selectedModality, tarifas, isAbono])

  // Load tariffs when plaza changes
  useEffect(() => {
    if (isAbono || isReserva || !selectedPlaza || !onPlazaChange) return

    const plazaData = availablePlazas.find(p => p.pla_numero === selectedPlaza)
    if (!plazaData) return

    // Obtener plantilla_id de la plaza
    const plantillaId = (plazaData as any).plantillas?.plantilla_id || null

    // Cargar tarifas de esta plantilla
    onPlazaChange(plantillaId).then(newTarifas => {
      // Actualizar precio con la nueva tarifa
      if (newTarifas && newTarifas.length > 0) {
        const tarifa = newTarifas.find(t => t.tar_nombre === selectedModality) ||
          newTarifas.find(t => t.tar_nombre.toLowerCase().includes(selectedModality.toLowerCase()))

        if (tarifa) {
          setAgreedPrice(tarifa.tar_precio_hora)
        } else {
          setAgreedPrice(0)
        }
      } else {
        setAgreedPrice(0)
      }
    })
  }, [selectedPlaza, isAbono, onPlazaChange])

  useEffect(() => {
    if (!isOpen || plaza) return

    const normalized = licensePlate.trim().toUpperCase()
    if (!normalized) {
      if (matchedAbonoPlaza) {
        setMatchedAbonoPlaza(null)
        setSelectedAbonoVehicle("")
        setSelectedPlaza(null)
        const { defaultModality, defaultPrice } = computeDefaultTariff()
        setSelectedModality(defaultModality)
        setAgreedPrice(defaultPrice)
      }
      return
    }

    const plazaAbono = availablePlazas.find(p =>
      p.abono?.vehiculos?.some(v => v.veh_patente?.toUpperCase() === normalized)
    )

    if (plazaAbono) {
      setMatchedAbonoPlaza(plazaAbono)
      setSelectedPlaza(plazaAbono.pla_numero)
      setSelectedModality("Abono")
      setAgreedPrice(0)
      setSelectedAbonoVehicle(normalized)

      const vehiculoSeleccionado = plazaAbono.abono?.vehiculos?.find(
        v => v.veh_patente?.toUpperCase() === normalized
      )
      if (vehiculoSeleccionado?.catv_segmento) {
        setVehicleType(mapearTipoVehiculo(vehiculoSeleccionado.catv_segmento))
      }
    } else if (matchedAbonoPlaza) {
      setMatchedAbonoPlaza(null)
      setSelectedAbonoVehicle("")
      setSelectedPlaza(null)
      const { defaultModality, defaultPrice } = computeDefaultTariff()
      setSelectedModality(defaultModality)
      setAgreedPrice(defaultPrice)
    }
  }, [licensePlate, availablePlazas, isOpen, plaza])

  const handleConfirm = async () => {
    if (!selectedPlaza) return
    const trimmedPlate = licensePlate.trim()
    if (!trimmedPlate) return

    try {
      await onConfirm({
        license_plate: trimmedPlate,
        type: vehicleType,
        plaza_number: selectedPlaza,
        modality: isAbono ? 'Abono' : selectedModality,
        agreed_price: isAbono ? 0 : agreedPrice,
        isAbono,
        abono_nro: abonoSource?.abo_nro
      })
      onClose()
    } catch (error) {
      console.error('Error registering entry:', error)
    }
  }

  const isFormValid = isAbono
    ? selectedPlaza !== null && selectedAbonoVehicle.trim().length > 0
    : isReserva
      ? selectedPlaza !== null && selectedReservaVehicle.trim().length > 0
      : licensePlate.trim().length > 0 && selectedPlaza !== null
  const availablePlazasForVehicle = getAvailablePlazasForVehicleType(vehicleType)
  const selectedPlazaData = availablePlazas.find(p => p.pla_numero === selectedPlaza)
  const selectedPlazaInfo = matchedAbonoPlaza || selectedPlazaData || plaza || null

  // Función helper para mapear tipo de vehículo
  const getTipoVehiculo = (segmento: string) => {
    switch (segmento) {
      case 'AUT': return 'Auto';
      case 'MOT': return 'Moto';
      case 'CAM': return 'Camioneta';
      default: return 'Auto';
    }
  };

  // Obtener zonas disponibles
  const zonasDisponibles = useMemo(() => {
    return Array.from(new Set(availablePlazasForVehicle.map(p => p.pla_zona || 'A')));
  }, [availablePlazasForVehicle]);

  // Filtrar plazas por zona seleccionada
  const plazasFiltradas = useMemo(() => {
    if (!selectedZona) return availablePlazasForVehicle;
    return availablePlazasForVehicle.filter(p => (p.pla_zona || 'A') === selectedZona);
  }, [availablePlazasForVehicle, selectedZona]);

  // Auto-seleccionar primera zona disponible
  useEffect(() => {
    if (!isAbono && zonasDisponibles.length > 0 && !selectedZona) {
      setSelectedZona(zonasDisponibles[0]);
    }
  }, [zonasDisponibles, isAbono, selectedZona]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[95vh] flex flex-col overflow-visible">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Ingreso</DialogTitle>
          <DialogDescription>
            Registrar nuevo vehículo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {isAbono && abonoSource && (
            <div className="p-3 border rounded-lg bg-orange-50 text-sm space-y-1">
              <p className="font-semibold text-orange-700">Plaza abonada</p>
              <p>
                <span className="font-medium">Titular:</span>{" "}
                {abonoSource.abonado
                  ? `${abonoSource.abonado.abon_nombre} ${abonoSource.abonado.abon_apellido}`.trim()
                  : 'Sin datos'}
              </p>
              {abonoSource.abonado?.abon_dni && (
                <p>
                  <span className="font-medium">DNI:</span> {abonoSource.abonado.abon_dni}
                </p>
              )}
              <p>
                <span className="font-medium">Vehículos habilitados:</span>{" "}
                {abonoVehicles.map(v => v.veh_patente).join(', ')}
              </p>
            </div>
          )}

          {isReserva && reserva && (
            <div className="p-3 border rounded-lg bg-yellow-50 text-sm space-y-1">
              <p className="font-semibold text-yellow-700">Plaza reservada</p>
              <p>
                <span className="font-medium">Cliente:</span>{" "}
                {reserva.conductor?.usu_nom} {reserva.conductor?.usu_ape}
              </p>
              {reserva.conductor?.usu_tel && (
                <p>
                  <span className="font-medium">Teléfono:</span> {reserva.conductor.usu_tel}
                </p>
              )}
              <p>
                <span className="font-medium">Vehículos habilitados:</span>{" "}
                {reservaVehicles.map((v: any) => v.veh_patente).join(', ')}
              </p>
              <p>
                <span className="font-medium">Código:</span> {reserva.res_codigo}
              </p>
            </div>
          )}

          {/* Patente / Vehículos abonados / Vehículos de reserva */}
          <div className="space-y-2">
            <Label htmlFor="patente">Patente</Label>
            {isAbono ? (
              <>
                <Select
                  value={selectedAbonoVehicle}
                  onValueChange={handleAbonoVehicleSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar vehículo del abono" />
                  </SelectTrigger>
                  <SelectContent>
                    {!plaza?.abono && matchedAbonoPlaza && (
                      <SelectItem value="__manual__">Ingresar otra patente</SelectItem>
                    )}
                    {abonoVehicles.map(vehiculo => (
                      <SelectItem
                        key={vehiculo.veh_patente}
                        value={vehiculo.veh_patente?.toUpperCase() || ''}
                      >
                        {vehiculo.veh_patente?.toUpperCase() || 'Sin patente'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Solo se permiten los vehículos asociados al abono.
                </p>
              </>
            ) : isReserva ? (
              <>
                <Select
                  value={selectedReservaVehicle}
                  onValueChange={handleReservaVehicleSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar vehículo de la reserva" />
                  </SelectTrigger>
                  <SelectContent>
                    {reservaVehicles.map((vehiculo: any) => (
                      <SelectItem
                        key={vehiculo.veh_patente}
                        value={vehiculo.veh_patente?.toUpperCase() || ''}
                      >
                        {vehiculo.veh_patente?.toUpperCase()} - {vehiculo.veh_marca} {vehiculo.veh_modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Solo se permiten los vehículos del conductor que hizo la reserva.
                </p>
              </>
            ) : (
              <Input
                id="patente"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                maxLength={10}
              />
            )}
          </div>

          {/* Tipo de vehículo */}
          <div className="space-y-2">
            <Label htmlFor="vehicle-type">Tipo de vehículo</Label>
            <Select
              value={vehicleType}
              onValueChange={(value: VehicleType) => {
                if (!isAbono && !isReserva) {
                  setVehicleType(value)
                }
              }}
            >
              <SelectTrigger disabled={!!plaza || isAbono || isReserva}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Auto">🚗 Auto</SelectItem>
                <SelectItem value="Moto">🏍️ Moto</SelectItem>
                <SelectItem value="Camioneta">🚛 Camioneta</SelectItem>
              </SelectContent>
            </Select>
            {(plaza || isAbono || isReserva) && (
              <p className="text-xs text-muted-foreground">Bloqueado: deriva del tipo de la plaza seleccionada</p>
            )}
            {isAbono && (
              <p className="text-xs text-orange-600">Asignado por el abono.</p>
            )}
            {isReserva && (
              <p className="text-xs text-yellow-600">Asignado por la reserva.</p>
            )}
          </div>

          {/* Selector de Zona */}
          {!plaza && !isAbono && !isReserva && zonasDisponibles.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="zona-selector">Zona destino</Label>
              <Select value={selectedZona} onValueChange={setSelectedZona}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir una zona (A, B, C...)" />
                </SelectTrigger>
                <SelectContent>
                  {zonasDisponibles.map((zona) => (
                    <SelectItem key={zona} value={zona}>
                      Zona {zona}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Plaza a asignar - Grid visual */}
          <div className="space-y-2">
            <Label>Plaza asignada</Label>

            {plaza ? (
              <>
                <Input
                  value={`Plaza ${plaza.pla_numero} - Zona ${plaza.pla_zona}`}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">Bloqueado: ya seleccionaste esta plaza desde el mapa</p>
              </>
            ) : plazasFiltradas.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay plazas libres para vehículos tipo {vehicleType} en zona {selectedZona}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Leyenda */}
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                  <span className="font-medium">Plazas disponibles: {plazasFiltradas.length}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-600 rounded"></div>
                    <span className="text-xs">Disponibles</span>
                  </div>
                </div>

                {/* Grid de plazas */}
                <div className="border rounded-lg bg-gray-50 p-4 overflow-hidden">
                  <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-2">
                    {plazasFiltradas.map((plazaItem) => (
                      <Plaza
                        key={plazaItem.pla_numero}
                        numero={plazaItem.pla_numero}
                        ocupado={false}
                        abonado={false}
                        tipo={getTipoVehiculo(plazaItem.catv_segmento)}
                        onClick={() => setSelectedPlaza(plazaItem.pla_numero)}
                        selected={selectedPlaza === plazaItem.pla_numero}
                      />
                    ))}
                  </div>
                </div>

                {/* Plaza seleccionada */}
                {selectedPlaza && selectedPlazaInfo && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mt-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Plaza seleccionada</p>
                        <p className="text-sm text-blue-800 mt-1">
                          Zona {selectedPlazaInfo.pla_zona || 'A'} - Nº {selectedPlazaInfo.pla_numero}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Tipo: {getTipoVehiculo(selectedPlazaInfo.catv_segmento)}
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedPlazaInfo.pla_numero}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Modalidad de Tarifa */}
          <div className="space-y-2">
            <Label htmlFor="modality">Modalidad de Tarifa</Label>
            {isAbono ? (
              <Input
                id="modality"
                value="Abono (sin cargo)"
                readOnly
                className="bg-muted cursor-not-allowed"
              />
            ) : (
              <Select
                value={selectedModality}
                onValueChange={setSelectedModality}
                disabled={!selectedPlaza}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedPlaza ? "Seleccionar modalidad" : "Primero selecciona una plaza"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hora">Hora</SelectItem>
                  <SelectItem value="Día">Día</SelectItem>
                </SelectContent>
              </Select>
            )}
            {!isAbono && !selectedPlaza && (
              <p className="text-xs text-muted-foreground">Selecciona una plaza primero</p>
            )}
          </div>

          {/* Precio aplicado */}
          <div className="space-y-2">
            <Label htmlFor="precio">
              {isAbono ? 'Precio aplicado' : `Precio aplicado ($ por ${selectedModality.toLowerCase()})`}
            </Label>
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
            {isAbono ? (
              <p className="text-xs text-orange-600">
                Ingreso de abono: no genera cobro al momento del egreso.
              </p>
            ) : (tarifas && tarifas.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Precio estándar: ${tarifas.find(t => t.tar_nombre === selectedModality)?.tar_precio_hora.toLocaleString()} por {selectedModality.toLowerCase()}
              </p>
            ))}
            {selectedPlazaInfo && (
              <p className="text-xs text-blue-600">
                Plaza seleccionada: {selectedPlazaInfo.pla_numero} - {selectedPlazaInfo.pla_zona}
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
