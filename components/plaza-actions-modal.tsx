"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Vehicle, VehicleType, VehiculoAbonado } from "@/lib/types"
import { useTurnos } from "@/lib/hooks/use-turnos"
import { toast } from "@/components/ui/use-toast"
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

interface PlazaCompleta {
  pla_numero: number
  pla_estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento' | 'Abonado'
  pla_zona: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
  plantillas?: {
    catv_segmento: 'AUT' | 'MOT' | 'CAM'
  }
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

interface PlazaActionsModalProps {
  plaza: PlazaCompleta | null
  vehicle?: Vehicle | null
  reserva?: any
  isOpen: boolean
  onClose: () => void
  onIngreso?: () => void
  onEgreso?: () => void
  onMover?: () => void
  onBloquear?: () => void
  loading?: boolean
}

const getEstadoColor = (estado: string) => {
  switch (estado) {
    case 'Libre':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'Ocupada':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'Reservada':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Mantenimiento':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    case 'Abonado':
      return 'bg-violet-100 text-violet-800 border-violet-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const mapearTipoVehiculo = (segmento: string): VehicleType => {
  switch (segmento) {
    case 'MOT': return 'Moto'
    case 'CAM': return 'Camioneta'
    case 'AUT':
    default: return 'Auto'
  }
}

export default function PlazaActionsModal({
  plaza,
  vehicle,
  reserva,
  isOpen,
  onClose,
  onIngreso,
  onEgreso,
  onMover,
  onBloquear,
  loading = false
}: PlazaActionsModalProps) {
  const { puedeOperar, isEmployee } = useTurnos();

  if (!plaza) return null

  const tipoVehiculo = mapearTipoVehiculo(plaza.catv_segmento)
  const isOcupada = plaza.pla_estado === 'Ocupada'
  const isLibre = plaza.pla_estado === 'Libre'
  const isMantenimiento = plaza.pla_estado === 'Mantenimiento'
  const isReservada = plaza.pla_estado === 'Reservada'
  const isAbonado = plaza.pla_estado === 'Abonado'

  // Verificar si el vehículo actual es un vehículo abonado
  const isVehiculoAbonado = vehicle && plaza.abono?.vehiculos?.some(
    (vehiculoAbono) => vehiculoAbono.veh_patente?.toUpperCase() === vehicle.license_plate?.toUpperCase()
  )

  // Handler para egreso con validación de turno
  const handleEgresoClick = () => {
    if (isEmployee && !puedeOperar()) {
      toast({
        variant: "destructive",
        title: "Turno no iniciado",
        description: "Debes abrir tu turno antes de registrar egresos"
      });
      onClose();
      return;
    }
    if (onEgreso) {
      onEgreso();
    }
  };

  // Handler para ingreso con validación de turno
  const handleIngresoClick = () => {
    if (isEmployee && !puedeOperar()) {
      toast({
        variant: "destructive",
        title: "Turno no iniciado",
        description: "Debes abrir tu turno antes de registrar ingresos"
      });
      onClose();
      return;
    }
    if (onIngreso) {
      onIngreso();
    }
  };

  // Handler para mover con validación de turno
  const handleMoverClick = () => {
    if (isEmployee && !puedeOperar()) {
      toast({
        variant: "destructive",
        title: "Turno no iniciado",
        description: "Debes abrir tu turno antes de mover vehículos"
      });
      onClose();
      return;
    }
    if (onMover) {
      onMover();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm p-0 rounded-2xl shadow-xl border-0 bg-white">
        {/* Header compacto */}
        <div className="px-6 py-4 border-b border-gray-100">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Acciones
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-1 space-y-1">
            <span className="block">
              Plaza {plaza.pla_numero} • {vehicle?.license_plate || (isAbonado ? 'Plaza abonada' : 'Sin vehículo')}
              {vehicle?.entry_time && (
                <>
                  {' '}
                  • Ingreso: {dayjs.tz(vehicle.entry_time, 'America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm')}
                </>
              )}
            </span>
            {!vehicle && isAbonado && plaza.abono?.abonado && (
              <span className="block text-xs text-gray-500">
                Titular: {plaza.abono.abonado.abon_nombre} {plaza.abono.abonado.abon_apellido} ({plaza.abono.abonado.abon_dni})
              </span>
            )}
          </DialogDescription>
        </div>

        {/* Botones principales - Solo Egreso y Mover para plazas ocupadas */}
        <div className="px-6 pb-6">
          {isOcupada && vehicle && (
            <div className="space-y-3">
              {onEgreso && (
                <Button
                  onClick={handleEgresoClick}
                  className="w-full h-12 text-white font-medium rounded-xl bg-red-500 hover:bg-red-600 shadow-sm transition-all duration-200"
                  disabled={loading}
                >
                  Egreso
                </Button>
              )}
              {/* Solo mostrar botón Mover si NO es un vehículo abonado */}
              {onMover && !isVehiculoAbonado && (
                <Button
                  onClick={handleMoverClick}
                  className="w-full h-12 text-white font-medium rounded-xl bg-blue-500 hover:bg-blue-600 shadow-sm transition-all duration-200"
                  disabled={loading}
                >
                  Mover
                </Button>
              )}
            </div>
          )}

          {isAbonado && (
            <div className="space-y-3">
              {onIngreso && (
                <Button
                  onClick={handleIngresoClick}
                  className="w-full h-12 text-white font-medium rounded-xl bg-orange-500 hover:bg-orange-600 shadow-sm transition-all duration-200"
                  disabled={loading}
                >
                  Registrar ingreso abonado
                </Button>
              )}
              <div className="text-xs text-gray-600 border border-orange-200 bg-orange-50 rounded-xl p-3 space-y-1">
                <div className="font-medium text-orange-700">Abono activo</div>
                {plaza.abono?.abonado && (
                  <div>
                    Titular: {plaza.abono.abonado.abon_nombre} {plaza.abono.abonado.abon_apellido} ({plaza.abono.abonado.abon_dni})
                  </div>
                )}
                {plaza.abono?.vehiculos && plaza.abono.vehiculos.length > 0 && (
                  <div>
                    Vehículos habilitados: {plaza.abono.vehiculos.map(v => v.veh_patente).join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Para plazas reservadas */}
          {isReservada && (
            <>
              {loading ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Cargando información de reserva...</span>
                  </div>
                </div>
              ) : reserva ? (
                <div className="space-y-3">
                  {onIngreso && (
                    <Button
                      onClick={handleIngresoClick}
                      className="w-full h-12 text-white font-medium rounded-xl bg-yellow-500 hover:bg-yellow-600 shadow-sm transition-all duration-200"
                      disabled={loading}
                    >
                      Ingresar vehículo
                    </Button>
                  )}
                  <div className="text-xs text-gray-600 border border-yellow-200 bg-yellow-50 rounded-xl p-3 space-y-2">
                    <div className="font-medium text-yellow-700">Reserva confirmada</div>
                    <div>
                      <span className="font-medium">Cliente:</span> {reserva.conductor?.usu_nom} {reserva.conductor?.usu_ape}
                    </div>
                    <div>
                      <span className="font-medium">Teléfono:</span> {reserva.conductor?.usu_tel || 'No disponible'}
                    </div>
                    <div>
                      <span className="font-medium">Email:</span> {reserva.conductor?.usu_email || 'No disponible'}
                    </div>
                    <div>
                      <span className="font-medium">Vehículo:</span> {reserva.veh_patente} ({reserva.vehiculo?.veh_marca} {reserva.vehiculo?.veh_modelo})
                    </div>
                    {reserva.vehiculos && reserva.vehiculos.length > 0 && (
                      <div>
                        <span className="font-medium">Vehículos habilitados:</span> {reserva.vehiculos.map(v => v.veh_patente).join(', ')}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Monto pagado:</span> ${reserva.res_monto?.toFixed(2) || '0.00'}
                    </div>
                    <div>
                      <span className="font-medium">Código:</span> {reserva.res_codigo}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm mb-3">
                    No se encontró información de reserva para esta plaza
                  </p>
                  {onIngreso && (
                    <Button
                      onClick={handleIngresoClick}
                      className="w-full h-12 text-white font-medium rounded-xl bg-yellow-500 hover:bg-yellow-600 shadow-sm transition-all duration-200"
                      disabled={loading}
                    >
                      Ingresar vehículo (sin reserva)
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Para plazas libres o en mantenimiento */}
          {(isLibre || isMantenimiento) && (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">
                {isLibre && 'Plaza libre - Use el formulario de ingreso'}
                {isMantenimiento && 'Plaza en mantenimiento'}
              </p>
              {onBloquear && (
                <Button
                  onClick={onBloquear}
                  variant="outline"
                  className="mt-3 w-full h-10 rounded-xl border-gray-200 hover:bg-gray-50"
                  disabled={loading}
                >
                  {isMantenimiento ? 'Desbloquear' : 'Bloquear'}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
