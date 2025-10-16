export type VehicleType = "Auto" | "Moto" | "Camioneta"

export interface Vehicle {
  license_plate: string
  type: VehicleType
  entry_time: string
  plaza_number?: number
  duracion_tipo?: string
  precio_acordado?: number
}

export interface VehicleEntryData extends Omit<Vehicle, 'entry_time'> {
  pla_numero?: number | null
}

export interface ParkingHistory extends Omit<Vehicle, 'entry_time'> {
  id: string
  entry_time: string
  exit_time: string
  duration: number // en milisegundos
  fee: number
  payment_method: 'efectivo' | 'transferencia' | 'link_pago' | 'qr'
  payment_id?: string
  payment_status?: 'pendiente' | 'aprobado' | 'rechazado' | 'expirado' | 'cancelado'
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

// Re-exportar tipos de pago
export * from './types/payment';

// ============================================
// TIPOS PARA ABONOS
// ============================================

export type TipoAbono = 'mensual' | 'trimestral' | 'semestral' | 'anual';
export type UnidadDuracion = 'dias' | 'meses' | 'años';

export interface Conductor {
  con_id: number;
  usu_nom: string;
  usu_ape: string;
  usu_email: string;
  usu_tel?: string;
  usu_dni: string;
  usu_fechareg: string;
  usu_estado: string;
}

export interface ConductorConVehiculos extends Conductor {
  vehiculos: VehiculoDB[];
}

export interface VehiculoDB {
  veh_patente: string;
  con_id: number;
  catv_segmento: 'AUT' | 'MOT' | 'CAM';
  veh_marca: string;
  veh_modelo: string;
  veh_color: string;
}

export interface VehiculoFormData {
  patente: string;
  tipo: 'Auto' | 'Moto' | 'Camioneta';
  marca: string;
  modelo: string;
  color: string;
}

export interface Abonado {
  abon_id: number;
  con_id: number;
  abon_dni: string;
  abon_nombre: string;
  abon_apellido: string;
}

export interface Abono {
  abo_nro: number;
  est_id: number;
  abon_id: number;
  abo_fecha_inicio: string;
  abo_fecha_fin: string;
  pag_nro?: number;
  abo_tipoabono: TipoAbono;
}

export interface AbonoConDetalles extends Abono {
  abonado: Abonado;
  estacionamiento: {
    est_nombre: string;
    est_direc: string;
  };
}

export interface CrearConductorFormData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  dni: string;
  vehiculos: VehiculoFormData[];
}

export interface CrearAbonoFormData {
  tipoAbono: TipoAbono;
  duracion: number;
  unidad: UnidadDuracion;
  fechaInicio?: string;
}

export interface CrearConductorConAbonoRequest {
  conductor: {
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
    dni: string;
  };
  vehiculos: VehiculoFormData[];
  abono: {
    est_id: number;
    tipoAbono: TipoAbono;
    fechaInicio: string;
    fechaFin: string;
  };
}

export interface CrearAbonoExistenteRequest {
  con_id: number;
  est_id: number;
  tipoAbono: TipoAbono;
  fechaInicio: string;
  fechaFin: string;
}

export interface CrearConductorConAbonoResponse {
  success: boolean;
  data?: {
    usuario_id: number;
    conductor_id: number;
    vehiculo_ids: string[];
    abonado_id: number;
    abono_nro: number;
    abono: AbonoConDetalles;
  };
  error?: string;
}

export interface BuscarConductorResponse {
  success: boolean;
  data?: ConductorConVehiculos;
  error?: string;
}

export interface ConfiguracionAbono {
  tipo: TipoAbono;
  duracionMeses: number;
  precioBase: number;
  descripcion: string;
}

export const CONFIGURACIONES_ABONOS: Record<TipoAbono, ConfiguracionAbono> = {
  mensual: {
    tipo: 'mensual',
    duracionMeses: 1,
    precioBase: 5000,
    descripcion: 'Abono válido por 1 mes'
  },
  trimestral: {
    tipo: 'trimestral',
    duracionMeses: 3,
    precioBase: 13500,
    descripcion: 'Abono válido por 3 meses'
  },
  semestral: {
    tipo: 'semestral',
    duracionMeses: 6,
    precioBase: 25500,
    descripcion: 'Abono válido por 6 meses'
  },
  anual: {
    tipo: 'anual',
    duracionMeses: 12,
    precioBase: 48000,
    descripcion: 'Abono válido por 1 año'
  }
};

