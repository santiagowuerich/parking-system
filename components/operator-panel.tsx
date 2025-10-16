"use client"

import { createBrowserClient } from "@supabase/ssr"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ThemeToggle } from "./theme-toggle"
import { useAuth } from "@/lib/auth-context"
import { ZonaEstacionamiento } from "./ZonaEstacionamiento"
import { SimpleVehicleList } from "./SimpleVehicleList"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Settings } from 'lucide-react'
import PlazaActionsModal from "./plaza-actions-modal"
import VehicleMovementModal from "./vehicle-movement-modal"
import IngresoModal from "./ingreso-modal"


import type { Parking, Vehicle, VehicleType, ParkingHistory, VehicleEntryData } from "@/lib/types"
import { formatCurrency, formatTime, formatArgentineTimeWithDayjs } from "@/lib/utils"
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

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
  // Función para refrescar vehículos estacionados
  refreshParkedVehicles?: () => Promise<void>
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
  refreshParkedVehicles,
}: OperatorPanelProps) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { estId } = useAuth();
  const [plazasStatus, setPlazasStatus] = useState<{ [seg: string]: { total: number, occupied: number, free: number, plazas: { pla_numero: number, occupied: boolean }[] } } | null>(null)
  const [selectedPlazasType, setSelectedPlazasType] = useState<{ pla_numero: number, occupied: boolean }[]>([])

  const [processingExit, setProcessingExit] = useState<string | null>(null)

  // Estados para los nuevos modales
  const [showActionsModal, setShowActionsModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [showIngresoModal, setShowIngresoModal] = useState(false)
  const [selectedPlazaForActions, setSelectedPlazaForActions] = useState<any>(null)
  const [selectedVehicleForMove, setSelectedVehicleForMove] = useState<Vehicle | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  // Tarifas disponibles para el modal de ingreso (según plantilla/plaza)
  const [tarifasIngreso, setTarifasIngreso] = useState<any[]>([])

  // Cargar tarifas de una plantilla específica
  const loadTariffsForPlaza = async (plantillaId: number) => {
    try {
      const response = await fetch(`/api/tarifas?est_id=${estId}`)
      const data = await response.json()

      let tariffs: any[] = []

      if (data.tarifas && plantillaId > 0) {
        // Filtrar tarifas por plantilla_id específica
        const plantillaData = data.tarifas.find((p: any) => p.plantilla_id === plantillaId)

        if (plantillaData && plantillaData.tarifas) {
          // Convertir las tarifas numéricas a nombres descriptivos
          tariffs = Object.entries(plantillaData.tarifas).map(([tipo, data]: [string, any]) => ({
            tar_id: parseInt(tipo),
            tar_nombre: mapTariffTypeToName(parseInt(tipo)),
            tar_precio_hora: data.precio
          }))
        }
      }

      // Si no hay tarifas específicas o plantillaId es 0, usar genéricas
      if (tariffs.length === 0) {
        console.log('Usando tarifas genéricas por defecto')
        tariffs = [
          { tar_id: 1, tar_nombre: 'Hora', tar_precio_hora: 1200 },
          { tar_id: 2, tar_nombre: 'Día', tar_precio_hora: 8000 },
          { tar_id: 3, tar_nombre: 'Semana', tar_precio_hora: 40000 },
          { tar_id: 4, tar_nombre: 'Mensual', tar_precio_hora: 150000 }
        ]
      }

      return tariffs
    } catch (error) {
      console.error('Error loading tariffs for plaza:', error)
      return []
    }
  }

  // Función para mapear tipos de tarifa numéricos a nombres descriptivos
  const mapTariffTypeToName = (tipoTarifa: number): string => {
    switch (tipoTarifa) {
      case 1: return 'Hora'
      case 2: return 'Día'
      case 3: return 'Semana'
      case 4: return 'Mensual'
      default: return `Tipo ${tipoTarifa}`
    }
  }

  // Filtros para la tabla de vehículos estacionados
  const [filterPlate, setFilterPlate] = useState<string>("")
  const [filterVehicleType, setFilterVehicleType] = useState<VehicleType | 'Todos'>("Todos")

  // Estado para movimientos recientes
  const [recentMovements, setRecentMovements] = useState<any[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)

  // Estado para forzar re-render de la visualización cuando cambian los vehículos
  const [visualizationKey, setVisualizationKey] = useState(0)

  // El AuthContext ya maneja todos los eventos de autenticación
  // No necesitamos duplicar onAuthStateChange aquí

  // Función para obtener movimientos recientes
  const fetchRecentMovements = async () => {
    setLoadingMovements(true);
    try {
      const response = await fetch(`/api/parking/movements?est_id=${estId}&limit=20`);
      const result = await response.json();

      if (result.success) {
        setRecentMovements(result.data);
      } else {
        console.error('Error fetching movements:', result.error);
      }
    } catch (error) {
      console.error('Error fetching movements:', error);
    } finally {
      setLoadingMovements(false);
    }
  };

  // Función reutilizable para recargar el estado de plazas (ahora usa los datos de props)
  const reloadPlazas = async () => {
    try {
      // Usar fetchPlazasStatus que ahora apunta a fetchDashboardData
      await fetchPlazasStatus();
    } catch (err) {
      console.error('Error recargando plazas:', err)
    }
  }

  // Sincronizar plazasData (prop) con plazasStatus (estado interno)
  useEffect(() => {
    if (plazasData && plazasData.mode === 'simple') {
      // Convertir datos de la API consolidada al formato esperado por OperatorPanel
      const transformedData: { [seg: string]: any } = {};

      // Agrupar plazas por tipo de vehículo
      const plazasPorTipo = plazasData.plazas.reduce((acc: any, plaza: any) => {
        const tipo = plaza.tipo || 'AUT';
        if (!acc[tipo]) acc[tipo] = [];
        acc[tipo].push({
          pla_numero: plaza.numero,
          occupied: plaza.ocupado
        });
        return acc;
      }, {});

      // Crear estadísticas por tipo
      Object.keys(plazasPorTipo).forEach(tipo => {
        const plazas = plazasPorTipo[tipo];
        const ocupadas = plazas.filter((p: any) => p.occupied).length;
        transformedData[tipo] = {
          total: plazas.length,
          occupied: ocupadas,
          free: plazas.length - ocupadas,
          plazas: plazas
        };
      });

      setPlazasStatus(transformedData);

      // Actualizar plazas del tipo seleccionado (simplificado)
      setSelectedPlazasType([]);
    }
  }, [plazasData]);

  // Inicializar estado (ya no se usa availableTariffs)

  // ELIMINADO: Cargar al iniciar (ya se maneja desde operador-simple)
  // Solo se activará manualmente cuando sea necesario

  // El precio acordado se maneja manualmente por el operador

  // ELIMINADO: Refrescar automáticamente cuando cambia la cantidad de vehículos estacionados
  // (ya se maneja desde operador-simple con fetchDashboardData)

  // Cargar movimientos recientes solo al montar el componente
  useEffect(() => {
    if (estId) {
      fetchRecentMovements();
    }
  }, [estId])

  // ELIMINADO: Actualizar movimientos después de operaciones
  // (se maneja manualmente cuando es necesario para evitar polling excesivo)

  // Forzar actualización de la visualización cuando cambian los vehículos estacionados
  useEffect(() => {
    setVisualizationKey(prev => prev + 1);
    console.log('🔄 Actualizando visualización por cambio en vehículos estacionados');
  }, [parking.parkedVehicles])


  const handleExit = async (vehicle: Vehicle) => {
    if (processingExit === vehicle.license_plate) return
    try {
      setProcessingExit(vehicle.license_plate)
      await onRegisterExit(vehicle.license_plate)
    } finally {
      setProcessingExit(null)
    }
  }


  // Obtener plazas libres para el selector
  const getPlazasLibres = () => {
    if (!plazasCompletas || plazasCompletas.length === 0) return [];

    return plazasCompletas.filter(plaza =>
      plaza.pla_estado === 'Libre' && plaza.pla_numero != null
    ).sort((a, b) => a.pla_numero - b.pla_numero);
  };

  // Función para manejar selección de plaza (simplificada, solo para mostrar información)
  const handlePlazaSelection = (plazaNumero: string) => {
    if (plazaNumero) {
      // Encontrar la plaza seleccionada
      const plaza = plazasCompletas.find(p => p.pla_numero === Number(plazaNumero));
      if (plaza) {
        // Solo mostrar información, no cambiar tipos ni activar selectores
        toast.success(`Plaza ${plaza.pla_numero} seleccionada`);
      }
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

  // Calcular zonas disponibles para el modal de movimiento
  const getAvailableZones = () => {
    if (!plazasCompletas || plazasCompletas.length === 0) {
      return [];
    }

    // Agrupar plazas por zona
    const zonasMap = new Map<string, any[]>();

    plazasCompletas.forEach(plaza => {
      const zonaNombre = plaza.pla_zona || 'Sin Zona';
      if (!zonasMap.has(zonaNombre)) {
        zonasMap.set(zonaNombre, []);
      }
      zonasMap.get(zonaNombre)?.push(plaza);
    });

    // Convertir a array de ZoneData
    return Array.from(zonasMap.entries()).map(([nombre, plazas]) => ({
      nombre,
      plazas
    }));
  };

  // Handler para clicks en plazas
  const handlePlazaClick = async (plaza: any) => {
    setSelectedPlazaForActions(plaza);

    if (plaza.pla_estado === 'Ocupada') {
      // Usar la información del vehículo ya sincronizada
      const vehicle = plaza.vehicle_info || parking.parkedVehicles.find(v => v.plaza_number === plaza.pla_numero);
      if (vehicle) {
        setSelectedVehicleForMove(vehicle);
        setShowActionsModal(true);
      } else {
        toast.error('No se encontró vehículo en esta plaza');
      }
    } else if (plaza.pla_estado === 'Libre') {
      // Abrir modal de ingreso para plazas libres
      setSelectedPlazaForActions(plaza);

      // Cargar tarifas de la plantilla de la plaza y guardarlas para el modal
      try {
        let tariffs: any[] = []
        if (plaza.plantillas?.plantilla_id) {
          tariffs = await loadTariffsForPlaza(plaza.plantillas.plantilla_id);
        } else {
          tariffs = await loadTariffsForPlaza(0);
        }
        setTarifasIngreso(tariffs || [])
      } catch (e) {
        console.error('Error obteniendo tarifas para ingreso:', e)
        setTarifasIngreso([])
      }

      setShowIngresoModal(true);
      toast.success(`Plaza ${plaza.pla_numero} seleccionada para ingreso`);
    } else if (plaza.pla_estado === 'Mantenimiento' || plaza.pla_estado === 'Reservada') {
      setShowActionsModal(true); // Para permitir desbloqueo
    }
  };


  const handleEgresoFromModal = async () => {
    setShowActionsModal(false);

    // Usar directamente el sistema de métodos de pago avanzado
    if (selectedVehicleForMove?.license_plate) {
      setModalLoading(true);
      try {
        await onRegisterExit(selectedVehicleForMove.license_plate);
      } finally {
        setModalLoading(false);
        handleCloseModals();
      }
    }
  };

  const handleIngresoFromModal = () => {
    setShowActionsModal(false);
    setShowIngresoModal(true);
  };

  const handleMoverVehiculo = () => {
    setShowActionsModal(false);
    setShowMovementModal(true);
  };

  const handleBloquearPlaza = async () => {
    if (!selectedPlazaForActions) return;

    setModalLoading(true);
    try {
      const nuevoEstado = selectedPlazaForActions.pla_estado === 'Mantenimiento' ? 'Libre' : 'Mantenimiento';

      const response = await fetch(`/api/plazas/${selectedPlazaForActions.pla_numero}/status?est_id=${estId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pla_estado: nuevoEstado,
          razon: nuevoEstado === 'Mantenimiento' ? 'Bloqueo manual' : 'Desbloqueo manual'
        }),
      });

      if (!response.ok) {
        throw new Error('Error al cambiar estado de plaza');
      }

      toast.success(
        nuevoEstado === 'Mantenimiento'
          ? `Plaza ${selectedPlazaForActions.pla_numero} bloqueada`
          : `Plaza ${selectedPlazaForActions.pla_numero} desbloqueada`
      );

      setShowActionsModal(false);
      fetchPlazasStatus(); // Actualizar estado de plazas
    } catch (error) {
      console.error('Error al cambiar estado de plaza:', error);
      toast.error('Error al cambiar estado de la plaza');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmMovement = async (destinoPlaza: any) => {
    if (!selectedVehicleForMove || !selectedPlazaForActions) return;

    setModalLoading(true);
    try {
      const response = await fetch(`/api/parking/move?est_id=${estId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_plate: selectedVehicleForMove.license_plate,
          from_plaza: selectedPlazaForActions.pla_numero,
          to_plaza: destinoPlaza.pla_numero,
          move_time: dayjs().tz('America/Argentina/Buenos_Aires').toISOString(),
          reason: 'Movimiento manual'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al mover vehículo');
      }

      const result = await response.json();

      toast.success(
        `Vehículo ${selectedVehicleForMove.license_plate} movido de plaza ${selectedPlazaForActions.pla_numero} a plaza ${destinoPlaza.pla_numero}`
      );

      setShowMovementModal(false);

      // Actualización inmediata y secuencial para evitar conflicts
      try {
        console.log('🔄 Iniciando actualización post-movimiento...');

        // 1. Actualizar estado de plazas primero
        await fetchPlazasStatus();

        // 2. Actualizar vehículos estacionados
        if (refreshParkedVehicles) {
          await refreshParkedVehicles();
        }

        // 3. ELIMINADO: Actualizar movimientos recientes (para evitar consultas excesivas)
        // Los movimientos se actualizarán con el realtime del operador-simple

        console.log('✅ Actualización post-movimiento completada');

        // 4. Forzar actualización adicional para asegurar consistencia visual
        setTimeout(async () => {
          console.log('🔄 Ejecutando actualización de seguimiento...');
          if (refreshParkedVehicles) {
            await refreshParkedVehicles();
          }
          await fetchPlazasStatus();
        }, 300);

      } catch (updateError) {
        console.warn('❌ Error durante actualización post-movimiento:', updateError);
        // Fallback: recargar página si las actualizaciones fallan
        setTimeout(() => {
          console.log('🔄 Fallback: recargando página...');
          window.location.reload();
        }, 1000);
      }

    } catch (error) {
      console.error('Error al mover vehículo:', error);
      toast.error(error instanceof Error ? error.message : 'Error al mover vehículo');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModals = () => {
    setShowActionsModal(false);
    setShowMovementModal(false);
    setShowIngresoModal(false);
    setSelectedPlazaForActions(null);
    setSelectedVehicleForMove(null);
  };

  const handleConfirmIngreso = async (data: {
    license_plate: string
    type: VehicleType
    plaza_number: number
    modality: string
    agreed_price: number
  }) => {
    if (!selectedPlazaForActions) return;

    setModalLoading(true);
    try {
      await onRegisterEntry({
        license_plate: data.license_plate,
        type: data.type,
        pla_numero: selectedPlazaForActions.pla_numero,
        duracion_tipo: data.modality.toLowerCase(),
        precio_acordado: data.agreed_price
      });

      toast.success(`Vehículo ${data.license_plate} registrado en plaza ${selectedPlazaForActions.pla_numero}`);
      handleCloseModals();

      // Refrescar datos incluyendo movimientos
      // Refrescar datos (sin movimientos para evitar consultas excesivas)
      await fetchPlazasStatus();
      if (refreshParkedVehicles) {
        await refreshParkedVehicles();
      }
    } catch (error) {
      console.error('Error registering entry:', error);
      toast.error('Error al registrar ingreso');
    } finally {
      setModalLoading(false);
    }
  };



  // Crear visualización rica de zonas usando plazasCompletas
  const crearVisualizacionRica = () => {
    if (!plazasCompletas || plazasCompletas.length === 0) return null;

    // Sincronizar el estado de las plazas con los vehículos estacionados actuales
    const plazasActualizadas = plazasCompletas.map(plaza => {
      // Buscar si hay un vehículo en esta plaza
      const vehicleInPlaza = parking.parkedVehicles.find(v => v.plaza_number === plaza.pla_numero);

      // Actualizar el estado basado en la información real de vehículos
      const estadoActual = vehicleInPlaza ? 'Ocupada' :
        (plaza.pla_estado === 'Ocupada' ? 'Libre' : plaza.pla_estado);

      return {
        ...plaza,
        pla_estado: estadoActual,
        vehicle_info: vehicleInPlaza || null
      };
    });

    // Agrupar plazas por zona
    const plazasPorZona = plazasActualizadas.reduce((acc: Record<string, any[]>, plaza: any) => {
      const zonaNombre = plaza.pla_zona || 'Sin Zona';
      if (!acc[zonaNombre]) {
        acc[zonaNombre] = [];
      }
      acc[zonaNombre].push(plaza);
      return acc;
    }, {} as Record<string, any[]>);

    return (
      <TooltipProvider>
        <div key={visualizationKey} className="space-y-6">
          <div className="flex justify-between items-center px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-600"></div>Libre
              </span>
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-600"></div>Ocupado
              </span>
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>Abonado
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
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold dark:text-zinc-100">🅿️ {zonaNombre}</h3>
                    <div className="text-sm text-muted-foreground">
                      Total: {estadisticasZona.total} • Ocupados: {estadisticasZona.ocupadas} • Libres: {estadisticasZona.libres}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={estadisticasZona.ocupadas > estadisticasZona.total * 0.8 ? "destructive" : "secondary"}>
                      {((estadisticasZona.ocupadas / estadisticasZona.total) * 100).toFixed(0)}% ocupación
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  {filas.map((fila, filaIndex) => (
                    <div key={filaIndex} className="flex gap-2 justify-center">
                      {fila.map(plaza => {
                        // Usar la información del vehículo ya sincronizada
                        const vehicleInPlaza = plaza.vehicle_info;

                        return (
                          <Tooltip key={plaza.pla_numero}>
                            <TooltipTrigger asChild>
                              <div
                                className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center text-white font-bold text-xs shadow-md transition-colors duration-200 relative cursor-pointer hover:ring-2 hover:ring-blue-400 ${getEstadoColor ? getEstadoColor(plaza.pla_estado) : 'bg-gray-400'
                                  } ${plaza.plantillas ? 'ring-2 ring-blue-300' : ''}`}
                                onClick={() => handlePlazaClick(plaza)}
                              >
                                {plaza.pla_estado === 'Ocupada' && vehicleInPlaza ? (
                                  // Mostrar patente cuando está ocupada
                                  <span className="text-xs font-semibold text-center leading-tight">
                                    {vehicleInPlaza.license_plate}
                                  </span>
                                ) : (
                                  // Mostrar número de plaza cuando está libre
                                  <span className="text-sm font-bold">{plaza.pla_numero}</span>
                                )}
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
                                {plaza.pla_estado === 'Abonado' && plaza.abono && (
                                  <div className="border-t pt-2 mt-2">
                                    <div className="text-sm font-medium text-orange-600 mb-1">🎫 Abono Asignado</div>
                                    <div className="text-sm">
                                      <span className="font-medium">Titular:</span> {plaza.abono.abonado.abon_nombre} {plaza.abono.abonado.abon_apellido}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-medium">DNI:</span> {plaza.abono.abonado.abon_dni}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-medium">Tipo:</span> {plaza.abono.abo_tipoabono}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-medium">Inicio:</span> {new Date(plaza.abono.abo_fecha_inicio).toLocaleDateString('es-AR')}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-medium">Fin:</span> {new Date(plaza.abono.abo_fecha_fin).toLocaleDateString('es-AR')}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
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
      {/* 1. VISUALIZACIÓN PLAZAS - PRIMERO */}
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
              handlePlazaSelection(String(plaza.numero));
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
                      handlePlazaSelection(String(plaza.numero));
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

      {/* 2. VEHÍCULOS ESTACIONADOS - SEGUNDO */}
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
                  <TableHead className="dark:text-zinc-400">Tarifa Acordada</TableHead>
                  <TableHead className="text-right dark:text-zinc-400">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parking.parkedVehicles
                  .filter(v => (filterVehicleType === 'Todos' || v.type === filterVehicleType) &&
                    (!filterPlate || v.license_plate.toLowerCase().includes(filterPlate.toLowerCase())))
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
                        <TableCell className="dark:text-zinc-100">
                          {/* TODO: Mostrar tarifa acordada cuando esté disponible */}
                          <span className="text-xs text-gray-500">Pendiente</span>
                        </TableCell>
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

      {/* 3. ÚLTIMOS MOVIMIENTOS - ELIMINADO - Se moverá a su propia página */}
      {/*
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="dark:border-zinc-800">
                <TableHead className="dark:text-zinc-400">Fecha/Hora</TableHead>
                <TableHead className="dark:text-zinc-400">Patente</TableHead>
                <TableHead className="dark:text-zinc-400">Acción</TableHead>
                <TableHead className="dark:text-zinc-400">Zona</TableHead>
                <TableHead className="dark:text-zinc-400">Plaza</TableHead>
                <TableHead className="dark:text-zinc-400">Método</TableHead>
                <TableHead className="dark:text-zinc-400">Tarifa</TableHead>
                <TableHead className="text-right dark:text-zinc-400">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingMovements ? (
                <TableRow className="dark:border-zinc-800">
                  <TableCell colSpan={8} className="text-center py-4">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    <span className="ml-2 dark:text-zinc-400">Cargando movimientos...</span>
                  </TableCell>
                </TableRow>
              ) : recentMovements.length === 0 ? (
                <TableRow className="dark:border-zinc-800">
                  <TableCell colSpan={8} className="text-center py-4 dark:text-zinc-400">
                    No hay movimientos recientes
                  </TableCell>
                </TableRow>
              ) : (
                recentMovements.map((movement) => (
                  <TableRow key={movement.id} className="dark:border-zinc-800">
                    <TableCell className="dark:text-zinc-100">{movement.timestamp}</TableCell>
                    <TableCell className="dark:text-zinc-100">{movement.license_plate}</TableCell>
                    <TableCell>
                      <Badge className={
                        movement.action === 'Ingreso'
                          ? "bg-green-100 text-green-800"
                          : movement.action === 'Egreso'
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                      }>
                        {movement.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="dark:text-zinc-100">{movement.zona}</TableCell>
                    <TableCell className="dark:text-zinc-100">{movement.plaza}</TableCell>
                    <TableCell className="dark:text-zinc-100">{movement.method}</TableCell>
                    <TableCell className="dark:text-zinc-100">{movement.tarifa || '$1200/h'}</TableCell>
                    <TableCell className="text-right dark:text-zinc-100">{movement.total}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      */}

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

      {/* Nuevos modales */}
      <PlazaActionsModal
        plaza={selectedPlazaForActions}
        vehicle={selectedVehicleForMove}
        isOpen={showActionsModal}
        onClose={handleCloseModals}
        onIngreso={handleIngresoFromModal}
        onEgreso={handleEgresoFromModal}
        onMover={handleMoverVehiculo}
        onBloquear={handleBloquearPlaza}
        loading={modalLoading}
      />

      <VehicleMovementModal
        vehicle={selectedVehicleForMove}
        currentPlaza={selectedPlazaForActions}
        availableZones={getAvailableZones()}
        plazasDisponibles={plazasCompletas || []}
        isOpen={showMovementModal}
        onClose={handleCloseModals}
        onConfirm={handleConfirmMovement}
        loading={modalLoading}
      />

      {/* Nuevos modales específicos */}
      <IngresoModal
        plaza={selectedPlazaForActions}
        isOpen={showIngresoModal}
        onClose={handleCloseModals}
        onConfirm={handleConfirmIngreso}
        loading={modalLoading}
        tarifas={tarifasIngreso}
        availablePlazas={plazasCompletas}
      />

    </div>
  );
}
