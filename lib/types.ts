export type VehicleType = "Auto" | "Moto" | "Camioneta"

export interface Vehicle {
  license_plate: string
  type: VehicleType
  entry_time: string
  plaza_number?: number
  duracion_tipo?: string
  precio_acordado?: number
  fecha_limite?: string
}

export interface ParkingHistory extends Omit<Vehicle, 'entry_time'> {
  id: string
  entry_time: string
  exit_time: string
  duration: number // en milisegundos
  fee: number
  payment_method: string
}

export interface Parking {
  capacity: Record<VehicleType, number>
  rates: Record<VehicleType, number>
  parkedVehicles: Vehicle[]
  history: ParkingHistory[]
}

// Tipos para el sistema de plantillas
export interface Caracteristica {
  caracteristica_id: number
  valor: string
  tipo_id: number
  caracteristica_tipos: {
    nombre_tipo: string
  }
}

export interface Plantilla {
  plantilla_id?: number
  nombre_plantilla: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
  est_id: number
  caracteristicas: Record<string, string[]> // Agrupadas por tipo
}

export interface PlantillaForm {
  plantilla_id?: number
  nombre_plantilla: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
  caracteristica_ids: number[]
}

