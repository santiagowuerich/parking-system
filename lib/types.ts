export type VehicleType = "Auto" | "Moto" | "Camioneta"

export interface Vehicle {
  license_plate: string
  type: VehicleType
  entry_time: string
  plaza_number?: number
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

