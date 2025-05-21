export type VehicleType = "Auto" | "Moto" | "Camioneta"

export interface Vehicle {
  license_plate: string
  type: VehicleType
  entry_time: string // ISO String Date
  user_id: string
  id?: string // Optional: Could be assigned by the database after insertion
  notes?: string // Optional: For re-entry notes or other info
  _isPendingSync?: boolean // Para marcar entradas que están pendientes de sincronización
}

export interface ParkingHistory extends Vehicle {
  id: string // Aseguramos que el id siempre esté en ParkingHistory
  exit_time: string // ISO String Date
  duration: number // en milisegundos
  fee: number
  payment_method: string
  payment_details?: any // Detalles adicionales del pago
  _isPendingSync?: boolean // Para marcar entradas que están pendientes de sincronización
}

export type Capacity = Record<VehicleType, number>;
export type Rates = Record<VehicleType, number>;

// Representa la información que se muestra después de una salida exitosa
export interface ExitInfo extends Omit<ParkingHistory, 'duration'> {
  duration: string; // Duración formateada para mostrar
}

export interface Parking {
  capacity: Capacity
  rates: Rates
  parkedVehicles: Vehicle[]
  history: ParkingHistory[]
}

// Para las configuraciones del usuario, ej. API keys
export interface UserSettings {
  user_id: string;
  mercadopagoApiKey?: string;
  bankAccountHolder?: string;
  bankAccountCbu?: string;
  bankAccountAlias?: string;
  // ... otras configuraciones
}

