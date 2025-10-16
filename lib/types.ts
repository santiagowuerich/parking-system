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

export type TipoAbono = 'semanal' | 'mensual';
export type UnidadDuracion = 'semanas' | 'meses';

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
  precioUnitario: number; // Precio por semana o por mes
  unidad: UnidadDuracion;
  descripcion: string;
}

export const CONFIGURACIONES_ABONOS: Record<TipoAbono, ConfiguracionAbono> = {
  semanal: {
    tipo: 'semanal',
    precioUnitario: 1500, // Precio por semana
    unidad: 'semanas',
    descripcion: 'Abono Semanal'
  },
  mensual: {
    tipo: 'mensual',
    precioUnitario: 5000, // Precio por mes
    unidad: 'meses',
    descripcion: 'Abono Mensual'
  }
};

// ========================================
// INTERFACES PARA SELECCIÓN DE PLAZAS
// ========================================

export interface PlazaInfo {
  pla_numero: number;
  est_id: number;
  pla_estado: 'Libre' | 'Ocupada' | 'Abonado';
  catv_segmento: string; // AUT, MOT, CAM
  zona?: string; // A, B, C, etc
}

export interface ZonaPlazasResponse {
  success: boolean;
  data?: {
    plazas: PlazaInfo[];
    totalLibres: number;
  };
  error?: string;
}

// ========================================
// ACTUALIZACIONES A INTERFACES EXISTENTES
// ========================================

// Actualizar CrearConductorConAbonoRequest para incluir plaza
export interface CrearConductorConAbonoRequestActualizado extends Omit<CrearConductorConAbonoRequest, 'abono'> {
  abono: {
    est_id: number;
    tipoAbono: TipoAbono;
    fechaInicio: string;
    fechaFin: string;
    plaza: {
      pla_numero: number;
      est_id: number;
    };
  };
}

// ===============================
// TIPOS PARA EXTENSIÓN DE ABONOS
// ===============================

export type TipoExtension = 'mensual' | 'bimestral' | 'trimestral' | 'anual'

export interface AbonoData {
  abo_nro: number
  titular: string
  tipoActual: string
  fechaFinActual: string
  zona: string
  codigo: string
  est_id: number
  pla_numero: number
  plantilla_id: number
}

export interface ExtensionState {
  tipoExtension: TipoExtension
  cantidad: number
  desde: string
  nuevoVencimiento: string
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia'
  monto: number
  nota: string
  tarjeta: { numero: string; vencimiento: string; cvv: string }
  loading: boolean
  calculating: boolean
}

// Actualizar CrearConductorConAbonoResponse para incluir plaza asignada
export interface CrearConductorConAbonoResponseActualizado extends Omit<CrearConductorConAbonoResponse, 'data'> {
  data: {
    usuario_id: number;
    conductor_id: number;
    vehiculo_ids: string[];
    abonado_id: number;
    abono_nro: number;
    plaza_asignada: {
      pla_numero: number;
      est_id: number;
    };
    abono: any;
  };
}

