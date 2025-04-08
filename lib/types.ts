export type VehicleType = "Auto" | "Moto" | "Camioneta"

export interface Vehicle {
  license_plate: string
  type: VehicleType
  entry_time: string
  user_id: string
}

export interface ParkingHistory extends Vehicle {
  id: string
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

