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
  reserva?: {
    res_codigo: string
    res_monto: number
    res_estado: 'confirmada' | 'activa'
    res_fh_ingreso: string
    res_fh_fin: string
    veh_patente: string
    catv_segmento: 'AUT' | 'MOT' | 'CAM'
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
    telefono?: string
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
  const [telefono, setTelefono] = useState<string>("")

  const [matchedAbonoPlaza, setMatchedAbonoPlaza] = useState<PlazaCompleta | null>(null)
  const [matchedReservaPlaza, setMatchedReservaPlaza] = useState<PlazaCompleta | null>(null)
  const [selectedReservaVehicle, setSelectedReservaVehicle] = useState<string>("")
  const [conflictType, setConflictType] = useState<'abono' | 'reserva' | null>(null) // null=sin conflicto, 'abono'=eligió abono, 'reserva'=eligió reserva
  const [ambosDisponibles, setAmbosDisponibles] = useState(false) // true cuando detecta ambos
  const [detectedReservaData, setDetectedReservaData] = useState<any>(null) // Datos de reserva obtenidos por detección
  const [loadingReservaData, setLoadingReservaData] = useState(false)

  // Verificación de turno activo
  const { puedeOperar, isEmployee } = useTurnos()
  const abonoSource = matchedAbonoPlaza?.abono || plaza?.abono || null
  const abonoVehicles: VehiculoAbonado[] = useMemo(() => {
    return (abonoSource?.vehiculos || []).filter(
      (vehiculo): vehiculo is VehiculoAbonado => Boolean(vehiculo?.veh_patente)
    );
  }, [abonoSource])

  // Lógica para reservas - usar detectedReservaData si está disponible (por detección), sino usar prop
  const reservaSource = detectedReservaData || reserva
  const reservaVehicles = useMemo(() => {
    return (reservaSource?.vehiculos || []).filter(
      (vehiculo: any) => Boolean(vehiculo?.veh_patente)
    );
  }, [reservaSource])

  // Cuando hay conflicto (ambos disponibles), el tipo elegido toma precedencia
  // Si no hay conflicto, se usa la lógica original
  const isAbono = ambosDisponibles ? conflictType === 'abono' : abonoVehicles.length > 0
  const isReserva = ambosDisponibles ? conflictType === 'reserva' : Boolean(reservaSource && reservaVehicles.length > 0)

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

    if (isReserva) {
      const sourcePlaza = matchedReservaPlaza || plaza
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
    // VehicleType ya está determinado por la plaza, no por el vehículo seleccionado
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

      // Validar que el vehículo pueda usar la plaza según jerarquía de tamaños
      if (!puedeVehiculoUsarPlaza(tipoVehiculo, tipoPlaza)) {
        toast({
          variant: "destructive",
          title: "Vehículo incompatible con la plaza",
          description: `La plaza es para ${tipoPlaza}, pero el vehículo seleccionado es ${tipoVehiculo}. Verifique la compatibilidad de tamaños.`
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
      setDetectedReservaData(null); // Reset detected reserva data
      setConflictType(null); // Reset conflict selection
      setAmbosDisponibles(false); // Reset conflict state
      setTelefono(""); // Reset teléfono cuando se cierra
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
      // Resetear todos los estados cuando se limpia el campo de patente
      if (matchedAbonoPlaza || matchedReservaPlaza) {
        setMatchedAbonoPlaza(null)
        setMatchedReservaPlaza(null)
        setSelectedAbonoVehicle("")
        setSelectedReservaVehicle("")
        setSelectedPlaza(null)
        setConflictType(null)
        setAmbosDisponibles(false)
        const { defaultModality, defaultPrice } = computeDefaultTariff()
        setSelectedModality(defaultModality)
        setAgreedPrice(defaultPrice)
      }
      return
    }

    // Buscar AMBOS simultáneamente
    const plazaAbono = availablePlazas.find(p =>
      p.abono?.vehiculos?.some(v => v.veh_patente?.toUpperCase() === normalized)
    )

    const plazaReserva = availablePlazas.find(p =>
      p.reserva?.veh_patente?.toUpperCase() === normalized
    )

    // CASO 1: Tiene AMBOS abono y reserva
    if (plazaAbono && plazaReserva && plazaReserva.reserva) {
      setMatchedAbonoPlaza(plazaAbono)
      setMatchedReservaPlaza(plazaReserva)
      setAmbosDisponibles(true)
      setConflictType(null) // Aún no ha elegido
      setSelectedPlaza(null) // No seleccionar plaza automáticamente
      setSelectedAbonoVehicle(normalized)
      setSelectedReservaVehicle(normalized)

      // No autoseleccionar modalidad ni precio - esperar a que elija
      const { defaultModality, defaultPrice } = computeDefaultTariff()
      setSelectedModality(defaultModality)
      setAgreedPrice(defaultPrice)
      return
    }

    // CASO 2: Solo tiene abono
    if (plazaAbono) {
      setMatchedAbonoPlaza(plazaAbono)
      setMatchedReservaPlaza(null)
      setAmbosDisponibles(false)
      setConflictType(null)
      setSelectedPlaza(plazaAbono.pla_numero)
      setSelectedModality("Abono")
      setAgreedPrice(0)
      setSelectedAbonoVehicle(normalized)
      setSelectedReservaVehicle("")

      // Configurar vehicleType basado en la plaza, no en el vehículo seleccionado
      if (plazaAbono.catv_segmento) {
        setVehicleType(mapearTipoVehiculo(plazaAbono.catv_segmento))
      }

      const vehiculoSeleccionado = plazaAbono.abono?.vehiculos?.find(
        v => v.veh_patente?.toUpperCase() === normalized
      )
      // VehicleType ya está determinado por la plaza, no por el vehículo seleccionado
      return
    }

    // CASO 3: Solo tiene reserva
    if (plazaReserva && plazaReserva.reserva) {
      setMatchedReservaPlaza(plazaReserva)
      setMatchedAbonoPlaza(null)
      setAmbosDisponibles(false)
      setConflictType(null)
      setSelectedPlaza(plazaReserva.pla_numero)
      setSelectedModality("Reserva")
      setAgreedPrice(plazaReserva.reserva.res_monto)
      setSelectedReservaVehicle(normalized)
      setSelectedAbonoVehicle("")

      if (plazaReserva.reserva.catv_segmento) {
        setVehicleType(mapearTipoVehiculo(plazaReserva.reserva.catv_segmento))
      }
      return
    }

    // CASO 4: No encontró nada - resetear
    if (matchedAbonoPlaza || matchedReservaPlaza) {
      setMatchedAbonoPlaza(null)
      setMatchedReservaPlaza(null)
      setSelectedAbonoVehicle("")
      setSelectedReservaVehicle("")
      setSelectedPlaza(null)
      setConflictType(null)
      setAmbosDisponibles(false)
      const { defaultModality, defaultPrice } = computeDefaultTariff()
      setSelectedModality(defaultModality)
      setAgreedPrice(defaultPrice)
    }
  }, [licensePlate, availablePlazas, isOpen, plaza])

  // Funciones para elegir entre abono y reserva cuando hay ambos
  const handleChooseAbono = () => {
    if (matchedAbonoPlaza) {
      setConflictType('abono')
      setSelectedPlaza(matchedAbonoPlaza.pla_numero)
      setSelectedModality("Abono")
      setAgreedPrice(0)

      const vehiculoSeleccionado = matchedAbonoPlaza.abono?.vehiculos?.find(
        v => v.veh_patente?.toUpperCase() === licensePlate.trim().toUpperCase()
      )
      // VehicleType ya está determinado por la plaza, no por el vehículo seleccionado
    }
  }

  const handleChooseReserva = async () => {
    if (matchedReservaPlaza && matchedReservaPlaza.reserva) {
      setConflictType('reserva')
      setSelectedPlaza(matchedReservaPlaza.pla_numero)
      setSelectedZona(matchedReservaPlaza.pla_zona || 'A') // Setear zona de la plaza de la reserva
      setSelectedModality("Reserva")
      setAgreedPrice(matchedReservaPlaza.reserva.res_monto)

      if (matchedReservaPlaza.reserva.catv_segmento) {
        setVehicleType(mapearTipoVehiculo(matchedReservaPlaza.reserva.catv_segmento))
      }

      // Obtener datos completos de la reserva por res_codigo
      try {
        setLoadingReservaData(true)
        const response = await fetch(`/api/reservas/${matchedReservaPlaza.reserva.res_codigo}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setDetectedReservaData(data.data)
          }
        }
      } catch (error) {
        console.error('Error obteniendo datos de reserva:', error)
      } finally {
        setLoadingReservaData(false)
      }
    }
  }

  const handleConfirm = async () => {
    if (!selectedPlaza) return
    const trimmedPlate = licensePlate.trim()
    if (!trimmedPlate) return

    try {
      // Determinar si es abono o reserva basado en conflictType o isAbono
      const isAbonoSelected = conflictType === 'abono' || (isAbono && !ambosDisponibles)
      const isReservaSelected = conflictType === 'reserva'

      await onConfirm({
        license_plate: trimmedPlate,
        type: vehicleType,
        plaza_number: selectedPlaza,
        modality: isAbonoSelected ? 'Abono' : (isReservaSelected ? 'Reserva' : selectedModality),
        agreed_price: isAbonoSelected ? 0 : agreedPrice,
        isAbono: isAbonoSelected,
        abono_nro: isAbonoSelected ? abonoSource?.abo_nro : undefined,
        res_codigo: isReservaSelected && matchedReservaPlaza?.reserva ? matchedReservaPlaza.reserva.res_codigo : undefined,
        telefono: telefono.trim() || undefined
      })
      onClose()
    } catch (error) {
      console.error('Error registering entry:', error)
    }
  }

  // Función helper para mapear tipo de vehículo
  const getTipoVehiculo = (segmento: string) => {
    switch (segmento) {
      case 'AUT': return 'Auto';
      case 'MOT': return 'Moto';
      case 'CAM': return 'Camioneta';
      default: return 'Auto';
    }
  };

  // Función de validación de tamaño de vehículo vs plaza
  const puedeVehiculoUsarPlaza = (tipoVehiculo: string, tipoPlaza: string): boolean => {
    // Lógica de compatibilidad:
    // - Plaza Camioneta: acepta Camioneta, Auto, Moto
    // - Plaza Auto: acepta Auto, Moto
    // - Plaza Moto: acepta solo Moto

    if (tipoPlaza === 'Camioneta') {
        return ['Camioneta', 'Auto', 'Moto'].includes(tipoVehiculo);
    } else if (tipoPlaza === 'Auto') {
        return ['Auto', 'Moto'].includes(tipoVehiculo);
    } else if (tipoPlaza === 'Moto') {
        return tipoVehiculo === 'Moto';
    }

    return false;
  };

  // Determinar tipo de vehículo actual
  const currentVehicleType = isAbono && matchedAbonoPlaza?.vehiculos
    ? getTipoVehiculo(matchedAbonoPlaza.vehiculos.find(v => v.veh_patente?.toUpperCase() === selectedAbonoVehicle?.toUpperCase())?.catv_segmento || 'AUT')
    : isReserva && matchedReservaPlaza?.reserva
      ? getTipoVehiculo(matchedReservaPlaza.reserva.catv_segmento || 'AUT')
      : vehicleType

  const availablePlazasForVehicle = getAvailablePlazasForVehicleType(vehicleType)
  const selectedPlazaData = availablePlazas.find(p => p.pla_numero === selectedPlaza)
  const selectedPlazaInfo = isAbono
    ? matchedAbonoPlaza
    : isReserva
      ? matchedReservaPlaza
      : selectedPlazaData || plaza || null

  // Determinar tipo de plaza seleccionada
  const selectedPlazaType = selectedPlazaInfo?.catv_segmento ? getTipoVehiculo(selectedPlazaInfo.catv_segmento) : null

  const isFormValid = isAbono
    ? selectedPlaza !== null && selectedAbonoVehicle.trim().length > 0 &&
      (!selectedPlazaType || !currentVehicleType || puedeVehiculoUsarPlaza(currentVehicleType, selectedPlazaType))
    : isReserva
      ? selectedPlaza !== null && selectedReservaVehicle.trim().length > 0 &&
        (!selectedPlazaType || !currentVehicleType || puedeVehiculoUsarPlaza(currentVehicleType, selectedPlazaType))
      : licensePlate.trim().length > 0 && selectedPlaza !== null &&
        (!selectedPlazaType || !currentVehicleType || puedeVehiculoUsarPlaza(currentVehicleType, selectedPlazaType))

  // Obtener zonas disponibles
  const zonasDisponibles = useMemo(() => {
    return Array.from(new Set(availablePlazasForVehicle.map(p => p.pla_zona || 'A')));
  }, [availablePlazasForVehicle]);

  // Filtrar plazas por zona seleccionada
  const plazasFiltradas = useMemo(() => {
    if (!selectedZona) return availablePlazasForVehicle;
    return availablePlazasForVehicle.filter(p => (p.pla_zona || 'A') === selectedZona);
  }, [availablePlazasForVehicle, selectedZona]);

  // Auto-seleccionar primera zona disponible (pero no para abono/reserva que ya tienen plaza asignada)
  useEffect(() => {
    if (!isAbono && !isReserva && zonasDisponibles.length > 0 && !selectedZona) {
      setSelectedZona(zonasDisponibles[0]);
    }
  }, [zonasDisponibles, isAbono, isReserva, selectedZona]);

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
                {abonoVehicles.map(v => `${v.veh_patente} (${mapearTipoVehiculo(v.catv_segmento || 'AUT')})`).join(', ')}
              </p>
            </div>
          )}

          {isReserva && reservaSource && (
            <div className="p-3 border rounded-lg bg-yellow-50 text-sm space-y-1">
              <p className="font-semibold text-yellow-700">Plaza reservada</p>
              {loadingReservaData && (
                <p className="text-xs text-yellow-600 italic">Cargando datos de reserva...</p>
              )}
              {!loadingReservaData && (
                <>
                  <p>
                    <span className="font-medium">Cliente:</span>{" "}
                    {reservaSource.conductor?.usu_nom} {reservaSource.conductor?.usu_ape}
                  </p>
                  {reservaSource.conductor?.usu_tel && (
                    <p>
                      <span className="font-medium">Teléfono:</span> {reservaSource.conductor.usu_tel}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Vehículos habilitados:</span>{" "}
                    {reservaVehicles.map((v: any) => v.veh_patente).join(', ')}
                  </p>
                  <p>
                    <span className="font-medium">Código:</span> {reservaSource.res_codigo}
                  </p>
                </>
              )}
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
                        {vehiculo.veh_patente?.toUpperCase() || 'Sin patente'} ({mapearTipoVehiculo(vehiculo.catv_segmento || 'AUT')})
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
                        {vehiculo.veh_patente?.toUpperCase()} - {vehiculo.veh_marca} {vehiculo.veh_modelo} ({mapearTipoVehiculo(vehiculo.catv_segmento)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Solo se permiten los vehículos del conductor que hizo la reserva, respetando las reglas de compatibilidad de tamaño.
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

          {/* Selector de conflicto: Abono vs Reserva */}
          {ambosDisponibles && !conflictType && (
            <Alert className="border-yellow-300 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <p className="text-sm text-yellow-800 font-medium mb-3">
                  Esta patente tiene abono y reserva activos. ¿Cuál querés usar?
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleChooseAbono}
                    variant="default"
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Usar Abono
                  </Button>
                  <Button
                    onClick={handleChooseReserva}
                    variant="default"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Usar Reserva
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

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
                <div className="border-2 border-gray-300 rounded-lg bg-gray-50 p-4 overflow-hidden shadow-sm">
                  <div 
                    className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-2" 
                    style={{ 
                      transform: 'none !important',
                      willChange: 'auto',
                      contain: 'layout style paint'
                    }}
                  >
                    {plazasFiltradas.map((plazaItem) => (
                      <div 
                        key={plazaItem.pla_numero}
                        style={{
                          width: '3.5rem',
                          height: '3.5rem',
                          flexShrink: 0,
                          transform: 'none !important'
                        }}
                      >
                        <Plaza
                          numero={plazaItem.pla_numero}
                          ocupado={false}
                          abonado={false}
                          tipo={getTipoVehiculo(plazaItem.catv_segmento)}
                          onClick={() => setSelectedPlaza(plazaItem.pla_numero)}
                          selected={selectedPlaza === plazaItem.pla_numero}
                        />
                      </div>
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
            ) : isReserva ? (
              <Input
                id="modality"
                value="Reserva"
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
            {!isAbono && !isReserva && !selectedPlaza && (
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

          {/* Teléfono opcional */}
          <div className="space-y-2">
            <Label htmlFor="telefono">
              Teléfono (opcional)
            </Label>
            <Input
              id="telefono"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+54 9 11 1234-5678 o 11 1234-5678"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              Se usará para enviar el ticket por WhatsApp al momento del egreso
            </p>
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
