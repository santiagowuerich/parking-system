export type VehicleType = "Auto" | "Moto" | "Camioneta"

export interface Vehicle {
  licensePlate: string
  type: VehicleType
  entryTime: Date
}

export interface ParkingHistory extends Vehicle {
  exitTime: Date
  duration: number // en milisegundos
  fee: number
}

export interface Parking {
  capacity: Record<VehicleType, number>
  rates: Record<VehicleType, number>
  parkedVehicles: Vehicle[]
  history: ParkingHistory[]
}

